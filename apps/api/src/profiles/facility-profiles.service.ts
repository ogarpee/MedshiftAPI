import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { OnboardingStatus, UserRole } from "@medshift/shared-types";
import { AuthUser } from "../auth/auth-user";
import { FacilityProfile, FacilityProfileDocument } from "../database/schemas/facility-profile.schema";
import { CreateFacilityProfileDto } from "./dto/create-facility-profile.dto";
import { UpdateFacilityProfileDto } from "./dto/update-facility-profile.dto";

@Injectable()
export class FacilityProfilesService {
  constructor(
    @InjectModel(FacilityProfile.name)
    private readonly facilityProfiles: Model<FacilityProfileDocument>
  ) {}

  async create(currentUser: AuthUser, dto: CreateFacilityProfileDto) {
    const existingProfile = await this.facilityProfiles.exists({ userId: currentUser.sub });

    if (existingProfile) {
      throw new ConflictException("Facility profile already exists for this user");
    }

    const profile = await this.facilityProfiles.create({
      ...dto,
      billingStatus: dto.billingStatus ?? "INACTIVE",
      onboarding: this.buildOnboardingState(dto),
      userId: new Types.ObjectId(currentUser.sub)
    });

    return this.serialize(profile);
  }

  async findAll() {
    const profiles = await this.facilityProfiles.find().sort({ createdAt: -1 }).exec();

    return profiles.map((profile) => this.serialize(profile));
  }

  async findMe(currentUser: AuthUser) {
    const profile = await this.facilityProfiles.findOne({ userId: currentUser.sub }).exec();

    if (!profile) {
      throw new NotFoundException("Facility profile not found");
    }

    return this.serialize(profile);
  }

  async getOnboardingStatus(currentUser: AuthUser) {
    const profile = await this.facilityProfiles.findOne({ userId: currentUser.sub }).exec();

    if (!profile) {
      return {
        role: UserRole.Facility,
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

  async update(currentUser: AuthUser, id: string, dto: UpdateFacilityProfileDto) {
    const profile = await this.findDocument(id);
    this.assertCanManage(currentUser, profile);
    profile.set(dto);
    profile.set({
      billingStatus: dto.billingStatus ?? profile.billingStatus,
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

  private async findDocument(id: string): Promise<FacilityProfileDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException("Facility profile not found");
    }

    const profile = await this.facilityProfiles.findById(id).exec();

    if (!profile) {
      throw new NotFoundException("Facility profile not found");
    }

    return profile;
  }

  private assertCanManage(currentUser: AuthUser, profile: FacilityProfileDocument) {
    if (currentUser.role === UserRole.Admin) {
      return;
    }

    if (profile.userId.toString() !== currentUser.sub) {
      throw new ForbiddenException("You can only manage your own facility profile");
    }
  }

  private serialize(profile: FacilityProfileDocument) {
    const object = profile.toObject({ versionKey: false });

    return {
      ...object,
      id: profile.id,
      _id: undefined
    };
  }

  private serializeOnboardingStatus(profile: FacilityProfileDocument) {
    const onboarding = profile.onboarding ?? { verificationStatus: OnboardingStatus.Incomplete };
    const verificationStatus = onboarding.verificationStatus ?? OnboardingStatus.Incomplete;

    return {
      role: UserRole.Facility,
      profileId: profile.id,
      completed: Boolean(onboarding.completedAt) && verificationStatus === OnboardingStatus.Approved,
      completedAt: onboarding.completedAt ?? null,
      verificationStatus,
      rejectedReason: onboarding.rejectedReason ?? null,
      nextStep: getFacilityNextStep(verificationStatus, Boolean(onboarding.completedAt), profile.billingStatus)
    };
  }

  private buildOnboardingState(source: FacilityOnboardingSource) {
    const hasProfile = Boolean(source.name?.trim() && source.facilityType);
    const hasAddress = Boolean(
      source.address?.street?.trim() &&
        source.address?.city?.trim() &&
        source.address?.province?.trim() &&
        source.address?.postalCode?.trim()
    );
    const hasLocation = source.location?.type === "Point" && source.location.coordinates?.length === 2;
    const hasContact = Boolean(source.contactPerson?.name?.trim() && source.contactPerson?.phone?.trim() && source.contactPerson?.email?.trim());
    const hasBillingReadiness = Boolean(
      source.billingStatus === "ACTIVE" &&
        source.readiness?.billingContactEmail?.trim() &&
        source.readiness?.paymentMethodLabel?.trim() &&
        source.readiness?.staffingContactConfirmed &&
        source.readiness?.acceptedTermsAt
    );
    const isComplete = hasProfile && hasAddress && hasLocation && hasContact && hasBillingReadiness;

    return {
      completedAt: isComplete ? new Date() : undefined,
      verificationStatus: isComplete ? OnboardingStatus.PendingReview : OnboardingStatus.Incomplete
    };
  }
}

type FacilityOnboardingSource = {
  name?: string;
  facilityType?: unknown;
  address?: { street?: string; city?: string; province?: string; postalCode?: string };
  contactPerson?: { name?: string; phone?: string; email?: string };
  billingStatus?: "ACTIVE" | "INACTIVE";
  location?: { type?: string; coordinates?: number[] };
  readiness?: {
    acceptedTermsAt?: string | Date;
    billingContactEmail?: string;
    paymentMethodLabel?: string;
    staffingContactConfirmed?: boolean;
  };
};

function getFacilityNextStep(verificationStatus: OnboardingStatus, hasCompletedProfile: boolean, billingStatus: "ACTIVE" | "INACTIVE") {
  if (!hasCompletedProfile) {
    return "COMPLETE_PROFILE";
  }

  if (billingStatus !== "ACTIVE") {
    return "COMPLETE_BILLING";
  }

  if (verificationStatus === OnboardingStatus.PendingReview) {
    return "WAIT_FOR_REVIEW";
  }

  if (verificationStatus === OnboardingStatus.Rejected) {
    return "RESUBMIT_REGISTRATION";
  }

  if (verificationStatus === OnboardingStatus.Approved) {
    return "ROSTER";
  }

  return "SUBMIT_FOR_REVIEW";
}
