import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";
import { SessionClientType, TwoFactorMethod } from "@medshift/shared-types";

export type TwoFactorCredentialDocument = HydratedDocument<TwoFactorCredential>;
export type TwoFactorChallengeDocument = HydratedDocument<TwoFactorChallenge>;
export type TrustedDeviceDocument = HydratedDocument<TrustedDevice>;

@Schema({ collection: "two_factor_credentials", timestamps: true })
export class TwoFactorCredential {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ enum: TwoFactorMethod, required: true })
  method!: TwoFactorMethod;

  @Prop() encryptedSecret?: string;
  @Prop() secretIv?: string;
  @Prop() secretTag?: string;
  @Prop({ type: [String], default: [] }) recoveryCodeHashes!: string[];
  @Prop({ required: true }) enabledAt!: Date;
  @Prop() managementCodeHash?: string;
  @Prop() managementCodeExpiresAt?: Date;
  @Prop() managementCodeSentAt?: Date;
}

@Schema({ collection: "two_factor_challenges", timestamps: true })
export class TwoFactorChallenge {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true, index: true }) userId!: Types.ObjectId;
  @Prop({ enum: ["LOGIN", "SETUP"], required: true }) purpose!: "LOGIN" | "SETUP";
  @Prop({ enum: TwoFactorMethod, required: true }) method!: TwoFactorMethod;
  @Prop({ enum: SessionClientType }) clientType?: SessionClientType;
  @Prop() codeHash?: string;
  @Prop() pendingEncryptedSecret?: string;
  @Prop() pendingSecretIv?: string;
  @Prop() pendingSecretTag?: string;
  @Prop() currentFactorVerified?: boolean;
  @Prop({ default: 0 }) attempts!: number;
  @Prop() sentAt?: Date;
  @Prop({ required: true, index: true }) expiresAt!: Date;
  @Prop() consumedAt?: Date;
  @Prop() userAgent?: string;
  @Prop() ipAddress?: string;
}

export const TwoFactorCredentialSchema = SchemaFactory.createForClass(TwoFactorCredential);
export const TwoFactorChallengeSchema = SchemaFactory.createForClass(TwoFactorChallenge);
TwoFactorChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

@Schema({ collection: "trusted_devices", timestamps: true })
export class TrustedDevice {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true, index: true }) userId!: Types.ObjectId;
  @Prop({ required: true, unique: true, index: true }) tokenHash!: string;
  @Prop({ enum: SessionClientType, required: true }) clientType!: SessionClientType;
  @Prop({ required: true }) label!: string;
  @Prop() userAgent?: string;
  @Prop() ipAddress?: string;
  @Prop({ required: true }) lastUsedAt!: Date;
  @Prop({ required: true, index: true }) expiresAt!: Date;
  @Prop() revokedAt?: Date;
}

export const TrustedDeviceSchema = SchemaFactory.createForClass(TrustedDevice);
TrustedDeviceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
TrustedDeviceSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });
