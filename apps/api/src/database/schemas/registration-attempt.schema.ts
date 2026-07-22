import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { UserRole } from "@medshift/shared-types";

export type RegistrationAttemptDocument = HydratedDocument<RegistrationAttempt>;

@Schema({ collection: "registration_attempts", timestamps: true })
export class RegistrationAttempt {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, enum: [UserRole.Worker, UserRole.Facility] })
  role!: UserRole;

  @Prop({ required: true })
  otpHash!: string;

  @Prop({ required: true })
  otpExpiresAt!: Date;

  @Prop({ required: true })
  otpSentAt!: Date;

  @Prop({ default: 0 })
  otpAttempts!: number;

  @Prop()
  verifiedAt?: Date;

  @Prop({ index: true, sparse: true })
  completionTokenHash?: string;

  @Prop()
  completionTokenExpiresAt?: Date;
}

export const RegistrationAttemptSchema = SchemaFactory.createForClass(RegistrationAttempt);
