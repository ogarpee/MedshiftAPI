import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { AccountStatus, BackgroundCheckStatus, OnboardingStatus, ShiftStatus } from "@medshift/shared-types";
import { FacilityProfile, FacilityProfileDocument } from "../database/schemas/facility-profile.schema";
import { Shift, ShiftDocument } from "../database/schemas/shift.schema";
import { User, UserDocument } from "../database/schemas/user.schema";
import { WorkerProfile, WorkerProfileDocument } from "../database/schemas/worker-profile.schema";
import { NotificationService } from "../notifications/notification.service";
import { ShiftsGateway } from "../realtime/shifts.gateway";
import { ReviewOnboardingDto } from "./dto/review-onboarding.dto";

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(WorkerProfile.name) private readonly workerProfiles: Model<WorkerProfileDocument>,
    @InjectModel(FacilityProfile.name) private readonly facilityProfiles: Model<FacilityProfileDocument>,
    @InjectModel(Shift.name) private readonly shifts: Model<ShiftDocument>,
    private readonly notificationService: NotificationService,
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
    const [workers, facilities] = await Promise.all([
      this.workerProfiles.find().sort({ createdAt: -1 }).lean().exec(),
      this.facilityProfiles.find().sort({ createdAt: -1 }).lean().exec()
    ]);

    return {
      workers: workers
        .filter((worker) => this.isWorkerPendingReview(worker))
        .map((worker) => this.serializeLean(worker)),
      facilities: facilities
        .filter((facility) => this.isFacilityPendingReview(facility))
        .map((facility) => this.serializeLean(facility))
    };
  }

  async updateUserStatus(userId: string, status: AccountStatus) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException("User not found");
    }

    const user = await this.users.findById(userId).exec();

    if (!user) {
      throw new NotFoundException("User not found");
    }

    user.status = status;

    return this.serializeLean((await user.save()).toObject({ versionKey: false }));
  }

  async updateShiftStatus(shiftId: string, status: ShiftStatus) {
    if (!Types.ObjectId.isValid(shiftId)) {
      throw new NotFoundException("Shift not found");
    }

    const shift = await this.shifts.findById(shiftId).exec();

    if (!shift) {
      throw new NotFoundException("Shift not found");
    }

    shift.status = status;

    if (status === ShiftStatus.Open) {
      shift.matchedWorkerId = null;
    }

    return this.serializeLean((await shift.save()).toObject({ versionKey: false }));
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

  async reviewWorkerOnboarding(workerId: string, dto: ReviewOnboardingDto) {
    if (!Types.ObjectId.isValid(workerId)) {
      throw new NotFoundException("Worker profile not found");
    }

    const worker = await this.workerProfiles.findById(workerId).exec();

    if (!worker) {
      throw new NotFoundException("Worker profile not found");
    }

    const user = await this.users.findById(worker.userId).exec();

    if (!user) {
      throw new NotFoundException("Worker user not found");
    }

    const now = new Date();
    worker.onboarding.verificationStatus = dto.approved ? OnboardingStatus.Approved : OnboardingStatus.Rejected;
    worker.onboarding.rejectedReason = dto.approved ? undefined : dto.rejectedReason;

    if (dto.approved) {
      worker.credentials.forEach((credential) => {
        credential.isVerified = true;
        credential.verifiedAt = credential.verifiedAt ?? now;
      });
      worker.backgroundCheck.status = BackgroundCheckStatus.Passed;
      worker.backgroundCheck.completedAt = worker.backgroundCheck.completedAt ?? now;
      user.status = AccountStatus.Active;
    } else {
      worker.backgroundCheck.status = BackgroundCheckStatus.Failed;
      user.status = AccountStatus.Pending;
    }

    const [savedWorker] = await Promise.all([worker.save(), user.save()]);
    await this.notificationService.sendOnboardingReviewResult({
      approved: dto.approved,
      email: user.email,
      rejectedReason: dto.rejectedReason,
      role: user.role
    });

    return this.serializeDocument(savedWorker);
  }

  async reviewFacilityOnboarding(facilityId: string, dto: ReviewOnboardingDto) {
    if (!Types.ObjectId.isValid(facilityId)) {
      throw new NotFoundException("Facility profile not found");
    }

    const facility = await this.facilityProfiles.findById(facilityId).exec();

    if (!facility) {
      throw new NotFoundException("Facility profile not found");
    }

    const user = await this.users.findById(facility.userId).exec();

    if (!user) {
      throw new NotFoundException("Facility user not found");
    }

    facility.onboarding.verificationStatus = dto.approved ? OnboardingStatus.Approved : OnboardingStatus.Rejected;
    facility.onboarding.rejectedReason = dto.approved ? undefined : dto.rejectedReason;
    facility.billingStatus = dto.approved ? "ACTIVE" : "INACTIVE";
    user.status = dto.approved ? AccountStatus.Active : AccountStatus.Pending;

    const [savedFacility] = await Promise.all([facility.save(), user.save()]);
    await this.notificationService.sendOnboardingReviewResult({
      approved: dto.approved,
      email: user.email,
      rejectedReason: dto.rejectedReason,
      role: user.role
    });

    return this.serializeFacilityDocument(savedFacility);
  }

  private computeMetrics(
    users: Array<User & { _id: Types.ObjectId }>,
    workers: Array<WorkerProfile & { _id: Types.ObjectId }>,
    facilities: Array<FacilityProfile & { _id: Types.ObjectId }>,
    shifts: Array<Shift & { _id: Types.ObjectId }>
  ) {
    const activeStatuses = new Set<ShiftStatus>([ShiftStatus.Open, ShiftStatus.Matched, ShiftStatus.InProgress]);
    const verifiedWorkers = workers.filter((worker) => worker.backgroundCheck?.status === BackgroundCheckStatus.Passed).length;
    const pendingWorkerApprovals = workers.filter((worker) => this.isWorkerPendingReview(worker)).length;
    const pendingFacilityApprovals = facilities.filter((facility) => this.isFacilityPendingReview(facility)).length;
    const completedShifts = shifts.filter((shift) => shift.status === ShiftStatus.Completed).length;

    return {
      totalUsers: users.length,
      totalFacilities: facilities.length,
      totalWorkers: workers.length,
      activeShifts: shifts.filter((shift) => activeStatuses.has(shift.status)).length,
      openShifts: shifts.filter((shift) => shift.status === ShiftStatus.Open).length,
      completedShifts,
      pendingApprovals: users.filter((user) => user.status === AccountStatus.Pending).length + pendingWorkerApprovals + pendingFacilityApprovals,
      verifiedWorkerRate: workers.length ? Math.round((verifiedWorkers / workers.length) * 100) : 0,
      activeSocketConnections: this.shiftsGateway.getActiveConnectionCount(),
      averageFillTimeMinutes: null
    };
  }

  private serializeDocument(document: WorkerProfileDocument) {
    const object = document.toObject({ versionKey: false });

    return this.serializeLean(object);
  }

  private serializeFacilityDocument(document: FacilityProfileDocument) {
    const object = document.toObject({ versionKey: false });

    return this.serializeLean(object);
  }

  private isWorkerPendingReview(worker: Pick<WorkerProfile, "backgroundCheck" | "credentials" | "onboarding">) {
    return (
      worker.onboarding?.verificationStatus === OnboardingStatus.PendingReview ||
      worker.backgroundCheck?.status !== BackgroundCheckStatus.Passed ||
      worker.credentials.some((credential) => !credential.isVerified)
    );
  }

  private isFacilityPendingReview(facility: Pick<FacilityProfile, "onboarding">) {
    return facility.onboarding?.verificationStatus === OnboardingStatus.PendingReview;
  }

  private serializeLean<T extends { _id: Types.ObjectId; passwordHash?: string }>(object: T) {
    const { _id, passwordHash: _passwordHash, ...rest } = object;

    return {
      ...rest,
      id: _id.toString()
    };
  }
}
