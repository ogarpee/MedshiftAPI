import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { BackgroundCheckStatus, OnboardingStatus, UserRole } from "@medshift/shared-types";
import { WorkerProfile, WorkerProfileDocument } from "../database/schemas/worker-profile.schema";
import { AuthUser } from "../auth/auth-user";
import { CreateWorkerProfileDto } from "./dto/create-worker-profile.dto";
import { UpdateWorkerProfileDto } from "./dto/update-worker-profile.dto";

@Injectable()
export class WorkerProfilesService {
  constructor(
    @InjectModel(WorkerProfile.name)
    private readonly workerProfiles: Model<WorkerProfileDocument>
  ) {}

  async create(currentUser: AuthUser, dto: CreateWorkerProfileDto) {
    const existingProfile = await this.workerProfiles.exists({ userId: currentUser.sub });

    if (existingProfile) {
      throw new ConflictException("Worker profile already exists for this user");
    }

    const profile = await this.workerProfiles.create({
      ...dto,
      backgroundCheck: {
        status: dto.backgroundCheck?.status ?? BackgroundCheckStatus.Pending,
        consentedAt: dto.backgroundCheck?.consentedAt
      },
      onboarding: this.buildOnboardingState(dto),
      userId: new Types.ObjectId(currentUser.sub)
    });

    return this.serialize(profile);
  }

  async findAll() {
    const profiles = await this.workerProfiles.find().sort({ createdAt: -1 }).exec();

    return profiles.map((profile) => this.serialize(profile));
  }

  async findMe(currentUser: AuthUser) {
    const profile = await this.workerProfiles.findOne({ userId: currentUser.sub }).exec();

    if (!profile) {
      throw new NotFoundException("Worker profile not found");
    }

    return this.serialize(profile);
  }

  async getOnboardingStatus(currentUser: AuthUser) {
    const profile = await this.workerProfiles.findOne({ userId: currentUser.sub }).exec();

    if (!profile) {
      return {
        role: UserRole.Worker,
        profileId: null,
        completed: false,
        verificationStatus: OnboardingStatus.Incomplete,
        rejectedReason: null,
        nextStep: "COMPLETE_PROFILE"
      };
    }

    return this.serializeOnboardingStatus(profile);
  }

  async findOne(currentUser: AuthUser, id: string) {
    const profile = await this.findDocument(id);
    this.assertCanManage(currentUser, profile);

    return this.serialize(profile);
  }

  async update(currentUser: AuthUser, id: string, dto: UpdateWorkerProfileDto) {
    const profile = await this.findDocument(id);
    this.assertCanManage(currentUser, profile);
    profile.set(dto);
    profile.set({
      backgroundCheck: {
        ...profile.backgroundCheck,
        status: profile.backgroundCheck?.status ?? BackgroundCheckStatus.Pending
      },
      onboarding: this.buildOnboardingState(profile)
    });

    return this.serialize(await profile.save());
  }

  async remove(currentUser: AuthUser, id: string) {
    const profile = await this.findDocument(id);
    this.assertCanManage(currentUser, profile);
    await profile.deleteOne();

    return { deleted: true };
  }

  private async findDocument(id: string): Promise<WorkerProfileDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException("Worker profile not found");
    }

    const profile = await this.workerProfiles.findById(id).exec();

    if (!profile) {
      throw new NotFoundException("Worker profile not found");
    }

    return profile;
  }

  private assertCanManage(currentUser: AuthUser, profile: WorkerProfileDocument) {
    if (currentUser.role === UserRole.Admin) {
      return;
    }

    if (profile.userId.toString() !== currentUser.sub) {
      throw new ForbiddenException("You can only manage your own worker profile");
    }
  }

  private serialize(profile: WorkerProfileDocument) {
    const object = profile.toObject({ versionKey: false });

    return {
      ...object,
      id: profile.id,
      _id: undefined
    };
  }

  private serializeOnboardingStatus(profile: WorkerProfileDocument) {
    const onboarding = profile.onboarding ?? { verificationStatus: OnboardingStatus.Incomplete };
    const verificationStatus = onboarding.verificationStatus ?? OnboardingStatus.Incomplete;

    return {
      role: UserRole.Worker,
      profileId: profile.id,
      completed: Boolean(onboarding.completedAt) && verificationStatus === OnboardingStatus.Approved,
      completedAt: onboarding.completedAt ?? null,
      verificationStatus,
      rejectedReason: onboarding.rejectedReason ?? null,
      nextStep: getWorkerNextStep(verificationStatus, Boolean(onboarding.completedAt))
    };
  }

  private buildOnboardingState(source: WorkerOnboardingSource) {
    const hasIdentity = Boolean(source.firstName?.trim() && source.lastName?.trim() && source.title);
    const hasLocation = source.location?.type === "Point" && source.location.coordinates?.length === 2;
    const hasPreferences = Boolean(source.preferences?.maxDistanceKm && source.preferences?.availableDays?.length);
    const hasCredential = Boolean(source.credentials?.some((credential) => credential.type?.trim() && credential.documentUrl?.trim()));
    const hasBackgroundConsent = Boolean(source.backgroundCheck?.consentedAt);
    const isComplete = hasIdentity && hasLocation && hasPreferences && hasCredential && hasBackgroundConsent;

    return {
      completedAt: isComplete ? new Date() : undefined,
      verificationStatus: isComplete ? OnboardingStatus.PendingReview : OnboardingStatus.Incomplete
    };
  }
}

type WorkerOnboardingSource = {
  firstName?: string;
  lastName?: string;
  title?: unknown;
  credentials?: Array<{ type?: string; documentUrl?: string }>;
  backgroundCheck?: { consentedAt?: string | Date };
  location?: { type?: string; coordinates?: number[] };
  preferences?: { availableDays?: string[]; maxDistanceKm?: number };
};

function getWorkerNextStep(verificationStatus: OnboardingStatus, hasCompletedProfile: boolean) {
  if (!hasCompletedProfile) {
    return "COMPLETE_PROFILE";
  }

  if (verificationStatus === OnboardingStatus.PendingReview) {
    return "WAIT_FOR_REVIEW";
  }

  if (verificationStatus === OnboardingStatus.Rejected) {
    return "RESUBMIT_CREDENTIALS";
  }

  if (verificationStatus === OnboardingStatus.Approved) {
    return "SHIFT_BOARD";
  }

  return "SUBMIT_FOR_REVIEW";
}
