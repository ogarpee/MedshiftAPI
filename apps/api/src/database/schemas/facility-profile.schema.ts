import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";
import { FacilityType, OnboardingStatus } from "@medshift/shared-types";

export type FacilityProfileDocument = HydratedDocument<FacilityProfile>;

@Schema({ _id: false })
class Address {
  @Prop()
  street?: string;

  @Prop()
  city?: string;

  @Prop()
  province?: string;

  @Prop()
  postalCode?: string;

  @Prop({ default: "CA" })
  country!: string;
}

@Schema({ _id: false })
class GeoPoint {
  @Prop({ enum: ["Point"], default: "Point" })
  type!: "Point";

  @Prop({ type: [Number], required: true })
  coordinates!: [number, number];
}

@Schema({ _id: false })
class ContactPerson {
  @Prop()
  name?: string;

  @Prop()
  phone?: string;

  @Prop()
  email?: string;
}

@Schema({ _id: false })
class FacilityStats {
  @Prop({ default: 0 })
  averageRating!: number;
}

@Schema({ _id: false })
class Readiness {
  @Prop()
  billingContactEmail?: string;

  @Prop()
  paymentMethodLabel?: string;

  @Prop({ default: false })
  staffingContactConfirmed!: boolean;

  @Prop()
  acceptedTermsAt?: Date;
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

@Schema({ collection: "facility_profiles", timestamps: true })
export class FacilityProfile {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ enum: FacilityType })
  facilityType?: FacilityType;

  @Prop({ type: Address, default: () => ({}) })
  address!: Address;

  @Prop({ type: GeoPoint, required: true })
  location!: GeoPoint;

  @Prop({ type: ContactPerson, default: () => ({}) })
  contactPerson!: ContactPerson;

  @Prop({ enum: ["ACTIVE", "INACTIVE"], default: "INACTIVE" })
  billingStatus!: "ACTIVE" | "INACTIVE";

  @Prop({ type: Readiness, default: () => ({}) })
  readiness!: Readiness;

  @Prop({ type: Onboarding, default: () => ({}) })
  onboarding!: Onboarding;

  @Prop({ type: FacilityStats, default: () => ({}) })
  stats!: FacilityStats;
}

export const FacilityProfileSchema = SchemaFactory.createForClass(FacilityProfile);
