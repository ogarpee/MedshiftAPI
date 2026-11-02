import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  BackgroundCheckStatus,
  OnboardingStatus,
  RequiredWorkerDocumentCategories,
  UserRole,
  VerificationDocumentStatus,
  WorkerDocumentCategory
} from "@medshift/shared-types";
import { WorkerProfile, WorkerProfileDocument } from "../database/schemas/worker-profile.schema";
import { WorkerOnboardingDraft, WorkerOnboardingDraftDocument } from "../database/schemas/worker-onboarding-draft.schema";
import { AuthUser } from "../auth/auth-user";
import { CreateWorkerProfileDto } from "./dto/create-worker-profile.dto";
import { UpdateWorkerProfileDto } from "./dto/update-worker-profile.dto";

@Injectable()
export class WorkerProfilesService {
  constructor(
    @InjectModel(WorkerProfile.name)
    private readonly workerProfiles: Model<WorkerProfileDocument>,
    @InjectModel(WorkerOnboardingDraft.name)
    private readonly onboardingDrafts: Model<WorkerOnboardingDraftDocument>
  ) {}

  async saveMine(currentUser: AuthUser, dto: CreateWorkerProfileDto) {
    const existingProfile = await this.workerProfiles.findOne({ userId: currentUser.sub }).exec();
    if (existingProfile) return this.updateDocument(currentUser, existingProfile, dto);

    try {
      const profile = await this.workerProfiles.create({
        ...dto,
        documents: this.normalizeDocuments(currentUser, dto.documents ?? []),
        backgroundCheck: {
          status: dto.backgroundCheck?.status ?? BackgroundCheckStatus.Pending,
          consentedAt: dto.backgroundCheck?.consentedAt
        },
        onboarding: this.buildOnboardingState(dto),
        userId: new Types.ObjectId(currentUser.sub)
      });
      await this.onboardingDrafts.deleteOne({ userId: profile.userId }).exec();
      return this.serialize(profile);
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const racedProfile = await this.workerProfiles.findOne({ userId: currentUser.sub }).exec();
      if (!racedProfile) throw error;
      return this.updateDocument(currentUser, racedProfile, dto);
    }
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
    return this.updateDocument(currentUser, profile, dto);
  }

  private async updateDocument(currentUser: AuthUser, profile: WorkerProfileDocument, dto: UpdateWorkerProfileDto) {
    const shouldResetReview = this.shouldResetApprovedReview(profile, dto);
    profile.set({
      ...dto,
      ...(dto.documents ? { documents: this.normalizeDocuments(currentUser, dto.documents, profile) } : {})
    });
    profile.set({
      backgroundCheck: {
        ...profile.backgroundCheck,
        status: profile.backgroundCheck?.status ?? BackgroundCheckStatus.Pending
      },
      onboarding: this.buildOnboardingState(profile, {
        preserveApproved: profile.onboarding?.verificationStatus === OnboardingStatus.Approved && !shouldResetReview
      })
    });

    const saved = await profile.save();
    await this.onboardingDrafts.deleteOne({ userId: profile.userId }).exec();
    return this.serialize(saved);
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

  private buildOnboardingState(source: WorkerOnboardingSource, options: { preserveApproved?: boolean } = {}) {
    const hasIdentity = Boolean(source.firstName?.trim() && source.lastName?.trim() && source.title);
    const hasLocation = source.location?.type === "Point" && source.location.coordinates?.length === 2;
    const hasPreferences = Boolean(source.preferences?.maxDistanceKm && source.preferences?.availableDays?.length);
    const uploadedCategories = new Set(source.documents?.filter(isUsableDocument).map((document) => document.category));
    const hasRequiredDocuments = RequiredWorkerDocumentCategories.every((category) => uploadedCategories.has(category));
    const isComplete = hasIdentity && hasLocation && hasPreferences && hasRequiredDocuments;
    const currentOnboarding = source.onboarding;

    if (options.preserveApproved && isComplete) {
      return {
        completedAt: currentOnboarding?.completedAt ?? new Date(),
        rejectedReason: undefined,
        verificationStatus: OnboardingStatus.Approved
      };
    }

    return {
      completedAt: isComplete ? currentOnboarding?.completedAt ?? new Date() : undefined,
      verificationStatus: isComplete ? OnboardingStatus.PendingReview : OnboardingStatus.Incomplete
    };
  }

  private shouldResetApprovedReview(profile: WorkerProfileDocument, dto: UpdateWorkerProfileDto) {
    if (profile.onboarding?.verificationStatus !== OnboardingStatus.Approved) {
      return false;
    }

    if (dto.title !== undefined && dto.title !== profile.title) return true;
    if (dto.documents === undefined) return false;

    const existingRequired = new Map(
      profile.documents
        .filter((document) => RequiredWorkerDocumentCategories.includes(document.category))
        .map((document) => [document.category, document.id])
    );
    const submittedRequired = new Map(
      dto.documents
        .filter((document) => RequiredWorkerDocumentCategories.includes(document.category))
        .map((document) => [document.category, document.id])
    );

    return RequiredWorkerDocumentCategories.some(
      (category) => existingRequired.get(category) !== submittedRequired.get(category)
    );
  }

  private normalizeDocuments(
    currentUser: AuthUser,
    documents: NonNullable<CreateWorkerProfileDto["documents"]>,
    existingProfile?: WorkerProfileDocument
  ) {
    if (documents.length > 10) throw new BadRequestException("A worker profile can contain at most 10 documents");
    const existingById = new Map(existingProfile?.documents.map((document) => [document.id, document]) ?? []);
    const seen = new Set<string>();

    return documents.map((document) => {
      if (seen.has(document.id)) throw new BadRequestException("Worker document IDs must be unique");
      seen.add(document.id);
      const existing = existingById.get(document.id);
      if (existing) return existing;
      const legacy = Boolean(document.documentUrl && !document.cloudinaryPublicId);
      if (legacy && currentUser.role !== UserRole.Admin) {
        throw new BadRequestException("Manual worker document URLs are not allowed");
      }
      if (!legacy && currentUser.role !== UserRole.Admin && !document.cloudinaryPublicId?.startsWith(`medshift/workers/${currentUser.sub}/`)) {
        throw new BadRequestException("Worker document upload is invalid");
      }
      if (!legacy && (!document.cloudinaryPublicId || !document.version || !document.format || !document.originalFilename || !document.bytes)) {
        throw new BadRequestException("Worker document upload metadata is incomplete");
      }
      return { ...document, verificationStatus: VerificationDocumentStatus.Pending };
    });
  }
}

type WorkerOnboardingSource = {
  firstName?: string;
  lastName?: string;
  title?: unknown;
  documents?: Array<{
    id?: string;
    category?: WorkerDocumentCategory;
    documentUrl?: string;
    cloudinaryPublicId?: string;
  }>;
  location?: { type?: string; coordinates?: number[] };
  onboarding?: { completedAt?: string | Date; verificationStatus?: OnboardingStatus; rejectedReason?: string };
  preferences?: { availableDays?: string[]; maxDistanceKm?: number };
};

function isUsableDocument(document: NonNullable<WorkerOnboardingSource["documents"]>[number]) {
  return Boolean(document.id && document.category && (document.cloudinaryPublicId || document.documentUrl));
}

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

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === 11000);
}
