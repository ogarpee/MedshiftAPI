import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";
import { BackgroundCheckStatus, ClinicalRole, OnboardingStatus } from "@medshift/shared-types";

export type WorkerProfileDocument = HydratedDocument<WorkerProfile>;

@Schema({ _id: false })
class Credential {
  @Prop()
  type?: string;

  @Prop()
  documentUrl?: string;

  @Prop({ default: false })
  isVerified!: boolean;

  @Prop()
  verifiedAt?: Date;
}

@Schema({ _id: false })
class BackgroundCheck {
  @Prop({ enum: BackgroundCheckStatus, default: BackgroundCheckStatus.Pending })
  status!: BackgroundCheckStatus;

  @Prop()
  consentedAt?: Date;

  @Prop()
  completedAt?: Date;
}

@Schema({ _id: false })
class GeoPoint {
  @Prop({ enum: ["Point"], default: "Point" })
  type!: "Point";

  @Prop({ type: [Number], required: true })
  coordinates!: [number, number];
}

@Schema({ _id: false })
class WorkerPreferences {
  @Prop({ default: 25 })
  maxDistanceKm!: number;

  @Prop({ type: [String], default: [] })
  availableDays!: string[];

  @Prop({ type: [String], default: [] })
  preferredShiftTypes!: string[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: "FacilityProfile" }], default: [] })
  preferredFacilities!: Types.ObjectId[];
}

@Schema({ _id: false })
class WorkerStats {
  @Prop({ default: 0 })
  averageRating!: number;

  @Prop({ default: 0 })
  totalShiftsCompleted!: number;
}

@Schema({ _id: false })
class Onboarding {
  @Prop()
  completedAt?: Date;

  @Prop({ enum: OnboardingStatus, default: OnboardingStatus.Incomplete })
  verificationStatus!: OnboardingStatus;

  @Prop()
  rejectedReason?: string;
}

@Schema({ collection: "worker_profiles", timestamps: true })
export class WorkerProfile {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  firstName!: string;

  @Prop({ required: true, trim: true })
  lastName!: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ enum: ClinicalRole, required: true })
  title!: ClinicalRole;

  @Prop({ type: [Credential], default: [] })
  credentials!: Credential[];

  @Prop({ type: BackgroundCheck, default: () => ({}) })
  backgroundCheck!: BackgroundCheck;

  @Prop({ type: GeoPoint, required: true })
  location!: GeoPoint;

  @Prop({ type: WorkerPreferences, default: () => ({}) })
  preferences!: WorkerPreferences;

  @Prop({ type: Onboarding, default: () => ({}) })
  onboarding!: Onboarding;

  @Prop({ type: WorkerStats, default: () => ({}) })
  stats!: WorkerStats;
}

export const WorkerProfileSchema = SchemaFactory.createForClass(WorkerProfile);

WorkerProfileSchema.index({ location: "2dsphere" });
