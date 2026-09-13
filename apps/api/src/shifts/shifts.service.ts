import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, PipelineStage, Types } from "mongoose";
import { OnboardingStatus, ShiftStatus, UserRole } from "@medshift/shared-types";
import { AuthUser } from "../auth/auth-user";
import { FacilityProfile, FacilityProfileDocument } from "../database/schemas/facility-profile.schema";
import { Shift, ShiftDocument } from "../database/schemas/shift.schema";
import { WorkerProfile, WorkerProfileDocument } from "../database/schemas/worker-profile.schema";
import { User, UserDocument } from "../database/schemas/user.schema";
import { NotificationService } from "../notifications/notification.service";
import { ShiftsGateway } from "../realtime/shifts.gateway";
import { CreateShiftDto } from "./dto/create-shift.dto";
import { UpdateShiftDto } from "./dto/update-shift.dto";

type ShiftWithFacility = Shift & {
  _id: Types.ObjectId;
  facility?: FacilityProfile & { _id: Types.ObjectId };
};

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

    const matchingShiftPayload = {
      facilityName: facility.name,
      hourlyRate: shift.hourlyRate,
      location: shift.location,
      roleRequired: shift.roleRequired,
      shiftId: shift.id,
      startTime: shift.startTime
    };

    const matchingWorkerUserIds = await this.notificationService.findMatchingWorkerUserIdsForShift(matchingShiftPayload);
    await this.notificationService.notifyMatchingWorkersForShift(matchingShiftPayload);
    const serialized = this.serialize(shift);
    this.shiftsGateway.emitShiftCreatedToWorkers(matchingWorkerUserIds, serialized);

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

  async findMineForWorker(currentUser: AuthUser) {
    const worker = await this.resolveWorkerForDashboard(currentUser);
    const pipeline: PipelineStage[] = [
      {
        $match: {
          matchedWorkerId: worker._id,
          status: { $in: [ShiftStatus.Matched, ShiftStatus.InProgress, ShiftStatus.Completed] }
        }
      },
      {
        $lookup: {
          from: "facility_profiles",
          localField: "facilityId",
          foreignField: "_id",
          as: "facility"
        }
      },
      { $unwind: { path: "$facility", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          sortBucket: {
            $cond: [{ $gte: ["$startTime", new Date()] }, 0, 1]
          },
          sortCompletedTime: {
            $cond: [{ $lt: ["$startTime", new Date()] }, "$startTime", null]
          },
          sortUpcomingTime: {
            $cond: [{ $gte: ["$startTime", new Date()] }, "$startTime", null]
          }
        }
      },
      { $sort: { sortBucket: 1, sortUpcomingTime: 1, sortCompletedTime: -1 } },
      { $limit: 100 }
    ];
    const shifts = await this.shifts.aggregate<ShiftWithFacility>(pipeline);

    return shifts.map((shift) => this.serializeMatchedShift(shift));
  }

  async update(currentUser: AuthUser, id: string, dto: UpdateShiftDto) {
    const shift = await this.findDocument(id);
    await this.assertCanManage(currentUser, shift);
    const previousStatus = shift.status;

    const nextStartTime = dto.startTime ?? shift.startTime;
    const nextEndTime = dto.endTime ?? shift.endTime;
    this.assertValidShiftWindow(nextStartTime, nextEndTime);

    if (dto.facilityId) {
      shift.facilityId = (await this.resolveFacilityForCreate(currentUser, dto.facilityId))._id;
    }

    if (dto.roleRequired !== undefined) {
      shift.roleRequired = dto.roleRequired;
    }

    if (dto.startTime !== undefined) {
      shift.startTime = dto.startTime;
    }

    if (dto.endTime !== undefined) {
      shift.endTime = dto.endTime;
    }

    if (dto.hourlyRate !== undefined) {
      shift.hourlyRate = dto.hourlyRate;
    }

    if (dto.location !== undefined) {
      shift.location = dto.location;
    }

    if (dto.description !== undefined) {
      shift.description = dto.description;
    }

    if (dto.status !== undefined) {
      shift.status = dto.status;
    }

    if (dto.matchedWorkerId !== undefined) {
      shift.matchedWorkerId = dto.matchedWorkerId ? new Types.ObjectId(dto.matchedWorkerId) : undefined;
    }

    const savedShift = await shift.save();
    await this.notifyReviewAvailableIfCompleted(savedShift, previousStatus);

    return this.serialize(savedShift);
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
    await this.sendShiftConfirmation(shift, worker);
    this.shiftsGateway.emitShiftAccepted(shift.facilityId.toString(), serialized);
    this.shiftsGateway.emitWorkerShiftAccepted(serialized);

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
      const facility = await this.findFacility(facilityId);
      this.assertOnboardingApproved(facility.onboarding, "Facility onboarding must be approved before posting shifts");

      return facility;
    }

    if (currentUser.role !== UserRole.Facility) {
      throw new ForbiddenException("Only facilities can post shifts");
    }

    const facility = await this.resolveCurrentFacility(currentUser);
    this.assertOnboardingApproved(facility.onboarding, "Facility onboarding must be approved before posting shifts");

    return facility;
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

    this.assertOnboardingApproved(worker.onboarding, "Worker onboarding must be approved before accepting shifts");

    return worker;
  }

  private async resolveWorkerForDashboard(currentUser: AuthUser): Promise<WorkerProfileDocument> {
    if (currentUser.role !== UserRole.Worker) {
      throw new ForbiddenException("Only workers can view their shifts");
    }

    const worker = await this.workerProfiles.findOne({ userId: currentUser.sub }).exec();

    if (!worker) {
      throw new NotFoundException("Worker profile is required before viewing worker shifts");
    }

    return worker;
  }

  private assertOnboardingApproved(onboarding: { verificationStatus?: OnboardingStatus } | undefined, message: string) {
    if (onboarding?.verificationStatus !== OnboardingStatus.Approved) {
      throw new ForbiddenException({
        code: "ONBOARDING_APPROVAL_REQUIRED",
        message
      });
    }
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
    await this.notificationService.notifyShiftAccepted({
      facilityName: facility?.name,
      facilityUserId: facility?.userId,
      roleRequired: shift.roleRequired,
      shiftId: shift.id,
      startTime: shift.startTime,
      workerUserId: worker.userId
    });
  }

  private async notifyReviewAvailableIfCompleted(shift: ShiftDocument, previousStatus: ShiftStatus) {
    if (previousStatus === ShiftStatus.Completed || shift.status !== ShiftStatus.Completed || !shift.matchedWorkerId) {
      return;
    }

    const [facility, worker] = await Promise.all([
      this.facilityProfiles.findById(shift.facilityId).exec(),
      this.workerProfiles.findById(shift.matchedWorkerId).exec()
    ]);

    await this.notificationService.notifyReviewAvailable({
      facilityUserId: facility?.userId,
      roleRequired: shift.roleRequired,
      shiftId: shift.id,
      startTime: shift.startTime,
      workerUserId: worker?.userId
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

  private serializeMatchedShift(shift: ShiftWithFacility) {
    return {
      id: shift._id.toString(),
      facilityId: shift.facilityId?.toString(),
      roleRequired: shift.roleRequired,
      startTime: shift.startTime,
      endTime: shift.endTime,
      hourlyRate: shift.hourlyRate,
      status: shift.status,
      matchedWorkerId: shift.matchedWorkerId?.toString() ?? null,
      location: shift.location,
      description: shift.description,
      facility: shift.facility
        ? {
            id: shift.facility._id?.toString(),
            name: shift.facility.name,
            facilityType: shift.facility.facilityType,
            address: shift.facility.address,
            stats: shift.facility.stats
          }
        : undefined
    };
  }
}
