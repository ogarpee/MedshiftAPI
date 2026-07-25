import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { UserRole } from "@medshift/shared-types";

export type WaitlistSignupDocument = HydratedDocument<WaitlistSignup>;

@Schema({ collection: "waitlist_signups", timestamps: true })
export class WaitlistSignup {
  @Prop({ required: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, enum: [UserRole.Worker, UserRole.Facility] })
  role!: UserRole;

  @Prop()
  confirmationEmailSentAt?: Date;

  @Prop()
  lastRequestedAt?: Date;
}

export const WaitlistSignupSchema = SchemaFactory.createForClass(WaitlistSignup);

WaitlistSignupSchema.index({ email: 1, role: 1 }, { unique: true });
