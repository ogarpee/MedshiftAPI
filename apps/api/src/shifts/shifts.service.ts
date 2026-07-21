import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { ShiftStatus, UserRole } from "@medshift/shared-types";
import { AuthUser } from "../auth/auth-user";
import { FacilityProfile, FacilityProfileDocument } from "../database/schemas/facility-profile.schema";
import { Shift, ShiftDocument } from "../database/schemas/shift.schema";
import { WorkerProfile, WorkerProfileDocument } from "../database/schemas/worker-profile.schema";
import { User, UserDocument } from "../database/schemas/user.schema";
import { NotificationService } from "../notifications/notification.service";
import { ShiftsGateway } from "../realtime/shifts.gateway";
import { CreateShiftDto } from "./dto/create-shift.dto";
import { UpdateShiftDto } from "./dto/update-shift.dto";

@Injectable()
export class ShiftsService {
  constructor(
    @InjectModel(Shift.name) private readonly shifts: Model<ShiftDocument>,
    @InjectModel(FacilityProfile.name) private readonly facilityProfiles: Model<FacilityProfileDocument>,
    @InjectModel(WorkerProfile.name) private readonly workerProfiles: Model<WorkerProfileDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly notificationService: NotificationService,
    private readonly shiftsGateway: ShiftsGateway
  ) {}

  async create(currentUser: AuthUser, dto: CreateShiftDto) {
    this.assertValidShiftWindow(dto.startTime, dto.endTime);
    const facility = await this.resolveFacilityForCreate(currentUser, dto.facilityId);
    const shift = await this.shifts.create({
      roleRequired: dto.roleRequired,
      startTime: dto.startTime,
      endTime: dto.endTime,
      hourlyRate: dto.hourlyRate,
      description: dto.description,
      location: dto.location,
      facilityId: facility._id,
      status: ShiftStatus.Open
    });

    const serialized = this.serialize(shift);
    this.shiftsGateway.emitShiftCreated(serialized);

    return serialized;
  }

  async findAll(currentUser: AuthUser) {
    const filter =
      currentUser.role === UserRole.Admin
        ? {}
        : { facilityId: (await this.resolveCurrentFacility(currentUser))._id };

    const shifts = await this.shifts.find(filter).sort({ startTime: 1 }).exec();

    return shifts.map((shift) => this.serialize(shift));
  }

  async findOne(currentUser: AuthUser, id: string) {
    const shift = await this.findDocument(id);
    await this.assertCanManage(currentUser, shift);

    return this.serialize(shift);
  }

  async update(currentUser: AuthUser, id: string, dto: UpdateShiftDto) {
    const shift = await this.findDocument(id);
    await this.assertCanManage(currentUser, shift);

    const nextStartTime = dto.startTime ?? shift.startTime;
    const nextEndTime = dto.endTime ?? shift.endTime;
    this.assertValidShiftWindow(nextStartTime, nextEndTime);

    if (dto.facilityId) {
      shift.facilityId = (await this.resolveFacilityForCreate(currentUser, dto.facilityId))._id;
    }

    shift.set({
      roleRequired: dto.roleRequired,
      startTime: dto.startTime,
      endTime: dto.endTime,
      hourlyRate: dto.hourlyRate,
      location: dto.location,
      description: dto.description,
      status: dto.status,
      matchedWorkerId: dto.matchedWorkerId ? new Types.ObjectId(dto.matchedWorkerId) : undefined
    });

    return this.serialize(await shift.save());
  }

  async remove(currentUser: AuthUser, id: string) {
    const shift = await this.findDocument(id);
    await this.assertCanManage(currentUser, shift);
    await shift.deleteOne();

    return { deleted: true };
  }

  async accept(currentUser: AuthUser, id: string) {
    const worker = await this.resolveWorkerForAccept(currentUser);

    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException("Shift not found");
    }

    const shift = await this.shifts
      .findOneAndUpdate(
        { _id: id, status: ShiftStatus.Open },
        { status: ShiftStatus.Matched, matchedWorkerId: worker._id },
        { new: true }
      )
      .exec();

    if (!shift) {
      throw new BadRequestException("Shift is not available for acceptance");
    }

    const serialized = this.serialize(shift);
    this.shiftsGateway.emitShiftAccepted(shift.facilityId.toString(), serialized);
    await this.sendShiftConfirmation(shift, worker);

    return serialized;
  }

  async metrics(currentUser: AuthUser) {
    const shifts = await this.findAll(currentUser);
    const now = Date.now();
    const activeStatuses = new Set<ShiftStatus>([ShiftStatus.Open, ShiftStatus.Matched, ShiftStatus.InProgress]);
    const activeShifts = shifts.filter((shift) => activeStatuses.has(shift.status)).length;
    const upcomingShifts = shifts.filter((shift) => new Date(shift.startTime).getTime() > now).length;
    const completedShifts = shifts.filter((shift) => shift.status === ShiftStatus.Completed).length;

    return {
      activeShifts,
      upcomingShifts,
      completedShifts,
      averageFillTimeMinutes: null
    };
  }

  private async resolveFacilityForCreate(currentUser: AuthUser, facilityId?: string): Promise<FacilityProfileDocument> {
    if (currentUser.role === UserRole.Admin && facilityId) {
      return this.findFacility(facilityId);
    }

    if (currentUser.role !== UserRole.Facility) {
      throw new ForbiddenException("Only facilities can post shifts");
    }

    return this.resolveCurrentFacility(currentUser);
  }

  private async resolveCurrentFacility(currentUser: AuthUser): Promise<FacilityProfileDocument> {
    const facility = await this.facilityProfiles.findOne({ userId: currentUser.sub }).exec();

    if (!facility) {
      throw new NotFoundException("Facility profile is required before posting shifts");
    }

    return facility;
  }

  private async resolveWorkerForAccept(currentUser: AuthUser): Promise<WorkerProfileDocument> {
    if (currentUser.role !== UserRole.Worker) {
      throw new ForbiddenException("Only workers can accept shifts");
    }

    const worker = await this.workerProfiles.findOne({ userId: currentUser.sub }).exec();

    if (!worker) {
      throw new NotFoundException("Worker profile is required before accepting shifts");
    }

    return worker;
  }

  private async sendShiftConfirmation(shift: ShiftDocument, worker: WorkerProfileDocument) {
    const facility = await this.facilityProfiles.findById(shift.facilityId).exec();
    const [workerUser, facilityUser] = await Promise.all([
      this.users.findById(worker.userId).exec(),
      facility ? this.users.findById(facility.userId).exec() : Promise.resolve(null)
    ]);

    await this.notificationService.sendShiftConfirmation({
      workerEmail: workerUser?.email,
      facilityEmail: facilityUser?.email,
      facilityName: facility?.name,
      roleRequired: shift.roleRequired,
      startTime: shift.startTime,
      endTime: shift.endTime
    });
  }

  private async findFacility(id: string): Promise<FacilityProfileDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException("Facility profile not found");
    }

    const facility = await this.facilityProfiles.findById(id).exec();

    if (!facility) {
      throw new NotFoundException("Facility profile not found");
    }

    return facility;
  }

  private async findDocument(id: string): Promise<ShiftDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException("Shift not found");
    }

    const shift = await this.shifts.findById(id).exec();

    if (!shift) {
      throw new NotFoundException("Shift not found");
    }

    return shift;
  }

  private async assertCanManage(currentUser: AuthUser, shift: ShiftDocument) {
    if (currentUser.role === UserRole.Admin) {
      return;
    }

    if (currentUser.role !== UserRole.Facility) {
      throw new ForbiddenException("Only facilities can manage shifts");
    }

    const facility = await this.resolveCurrentFacility(currentUser);

    if (shift.facilityId.toString() !== facility.id) {
      throw new ForbiddenException("You can only manage shifts for your facility");
    }
  }

  private assertValidShiftWindow(startTime: Date, endTime: Date) {
    if (endTime.getTime() <= startTime.getTime()) {
      throw new BadRequestException("Shift endTime must be after startTime");
    }
  }

  private serialize(shift: ShiftDocument) {
    const object = shift.toObject({ versionKey: false });

    return {
      ...object,
      id: shift.id,
      _id: undefined
    };
  }
}
