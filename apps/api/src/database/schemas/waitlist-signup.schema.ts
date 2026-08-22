import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { FacilityType, UserRole, WaitlistAvailability, WaitlistProfessionalRole } from "@medshift/shared-types";

export type WaitlistSignupDocument = HydratedDocument<WaitlistSignup>;

@Schema({ collection: "waitlist_signups", timestamps: true })
export class WaitlistSignup {
  @Prop({ required: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, enum: [UserRole.Worker, UserRole.Facility] })
  role!: UserRole;

  @Prop({
    type: {
      fullName: { type: String, trim: true },
      clinicalRole: { type: String, enum: Object.values(WaitlistProfessionalRole) },
      phone: { type: String, trim: true },
      city: { type: String, trim: true },
      availability: { type: String, enum: Object.values(WaitlistAvailability) }
    },
    _id: false
  })
  workerDetails?: {
    fullName?: string;
    clinicalRole?: WaitlistProfessionalRole;
    phone?: string;
    city?: string;
    availability?: WaitlistAvailability;
  };

  @Prop({
    type: {
      facilityName: { type: String, trim: true },
      phone: { type: String, trim: true },
      facilityType: { type: String, enum: Object.values(FacilityType) },
      city: { type: String, trim: true },
      province: { type: String, trim: true }
    },
    _id: false
  })
  facilityDetails?: {
    facilityName?: string;
    phone?: string;
    facilityType?: FacilityType;
    city?: string;
    province?: string;
  };

  @Prop()
  confirmationEmailSentAt?: Date;

  @Prop()
  lastRequestedAt?: Date;
}

export const WaitlistSignupSchema = SchemaFactory.createForClass(WaitlistSignup);

WaitlistSignupSchema.index({ email: 1, role: 1 }, { unique: true });
