import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { AccountStatus, BackgroundCheckStatus, ShiftStatus } from "@medshift/shared-types";
import { FacilityProfile, FacilityProfileDocument } from "../database/schemas/facility-profile.schema";
import { Shift, ShiftDocument } from "../database/schemas/shift.schema";
import { User, UserDocument } from "../database/schemas/user.schema";
import { WorkerProfile, WorkerProfileDocument } from "../database/schemas/worker-profile.schema";
import { ShiftsGateway } from "../realtime/shifts.gateway";

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(WorkerProfile.name) private readonly workerProfiles: Model<WorkerProfileDocument>,
    @InjectModel(FacilityProfile.name) private readonly facilityProfiles: Model<FacilityProfileDocument>,
    @InjectModel(Shift.name) private readonly shifts: Model<ShiftDocument>,
    private readonly shiftsGateway: ShiftsGateway
  ) {}

  async overview() {
    const [users, workers, facilities, shifts] = await Promise.all([
      this.users.find().sort({ createdAt: -1 }).lean().exec(),
      this.workerProfiles.find().sort({ createdAt: -1 }).lean().exec(),
      this.facilityProfiles.find().sort({ createdAt: -1 }).lean().exec(),
      this.shifts.find().sort({ startTime: 1 }).lean().exec()
    ]);

    return {
      users: users.map((user) => this.serializeLean(user)),
      workers: workers.map((worker) => this.serializeLean(worker)),
      facilities: facilities.map((facility) => this.serializeLean(facility)),
      shifts: shifts.map((shift) => this.serializeLean(shift)),
      metrics: this.computeMetrics(users, workers, facilities, shifts)
    };
  }

  async usersList() {
    const users = await this.users.find().sort({ createdAt: -1 }).lean().exec();

    return users.map((user) => this.serializeLean(user));
  }

  async facilitiesList() {
    const facilities = await this.facilityProfiles.find().sort({ createdAt: -1 }).lean().exec();

    return facilities.map((facility) => this.serializeLean(facility));
  }

  async shiftsList() {
    const shifts = await this.shifts.find().sort({ startTime: 1 }).lean().exec();

    return shifts.map((shift) => this.serializeLean(shift));
  }

  async verificationQueue() {
    const workers = await this.workerProfiles.find().sort({ createdAt: -1 }).lean().exec();

    return workers
      .filter((worker) =>
        worker.backgroundCheck?.status !== BackgroundCheckStatus.Passed ||
        worker.credentials.some((credential) => !credential.isVerified)
      )
      .map((worker) => this.serializeLean(worker));
  }

  async reviewCredential(workerId: string, credentialIndex: number, approved: boolean) {
    if (!Types.ObjectId.isValid(workerId)) {
      throw new NotFoundException("Worker profile not found");
    }

    const worker = await this.workerProfiles.findById(workerId).exec();

    if (!worker || !worker.credentials[credentialIndex]) {
      throw new NotFoundException("Credential not found");
    }

    worker.credentials[credentialIndex].isVerified = approved;
    worker.credentials[credentialIndex].verifiedAt = approved ? new Date() : undefined;

    if (approved && worker.credentials.every((credential) => credential.isVerified)) {
      worker.backgroundCheck.status = BackgroundCheckStatus.Passed;
    }

    return this.serializeDocument(await worker.save());
  }

  private computeMetrics(
    users: Array<User & { _id: Types.ObjectId }>,
    workers: Array<WorkerProfile & { _id: Types.ObjectId }>,
    facilities: Array<FacilityProfile & { _id: Types.ObjectId }>,
    shifts: Array<Shift & { _id: Types.ObjectId }>
  ) {
    const activeStatuses = new Set<ShiftStatus>([ShiftStatus.Open, ShiftStatus.Matched, ShiftStatus.InProgress]);
    const verifiedWorkers = workers.filter((worker) => worker.backgroundCheck?.status === BackgroundCheckStatus.Passed).length;
    const completedShifts = shifts.filter((shift) => shift.status === ShiftStatus.Completed).length;

    return {
      totalUsers: users.length,
      totalFacilities: facilities.length,
      totalWorkers: workers.length,
      activeShifts: shifts.filter((shift) => activeStatuses.has(shift.status)).length,
      openShifts: shifts.filter((shift) => shift.status === ShiftStatus.Open).length,
      completedShifts,
      pendingApprovals: users.filter((user) => user.status === AccountStatus.Pending).length,
      verifiedWorkerRate: workers.length ? Math.round((verifiedWorkers / workers.length) * 100) : 0,
      activeSocketConnections: this.shiftsGateway.getActiveConnectionCount(),
      averageFillTimeMinutes: null
    };
  }

  private serializeDocument(document: WorkerProfileDocument) {
    const object = document.toObject({ versionKey: false });

    return this.serializeLean(object);
  }

  private serializeLean<T extends { _id: Types.ObjectId; passwordHash?: string }>(object: T) {
    const { _id, passwordHash: _passwordHash, ...rest } = object;

    return {
      ...rest,
      id: _id.toString()
    };
  }
}
