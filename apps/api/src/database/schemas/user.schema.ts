import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { AccountStatus, UserRole } from "@medshift/shared-types";

export type UserDocument = HydratedDocument<User>;

@Schema({ collection: "users", timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ required: true, enum: UserRole })
  role!: UserRole;

  @Prop({ enum: AccountStatus, default: AccountStatus.Pending })
  status!: AccountStatus;

  @Prop({ default: false })
  emailVerified!: boolean;

  @Prop()
  emailVerifiedAt?: Date;

  @Prop({ index: true, sparse: true })
  emailVerificationTokenHash?: string;

  @Prop()
  emailVerificationTokenExpiresAt?: Date;

  @Prop()
  emailVerificationSentAt?: Date;

  @Prop({ index: true, sparse: true })
  passwordResetTokenHash?: string;

  @Prop()
  passwordResetTokenExpiresAt?: Date;

  @Prop()
  passwordResetSentAt?: Date;

  @Prop()
  passwordChangedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ emailVerified: 1, status: 1 });
