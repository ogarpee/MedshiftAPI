import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";
import { SessionClientType } from "@medshift/shared-types";

export type SessionDocument = HydratedDocument<Session>;

@Schema({ collection: "sessions", timestamps: true })
export class Session {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  familyId!: string;

  @Prop({ enum: SessionClientType, required: true })
  clientType!: SessionClientType;

  @Prop({ required: true })
  refreshTokenHash!: string;

  @Prop({ required: true, index: true })
  refreshExpiresAt!: Date;

  @Prop()
  revokedAt?: Date;

  @Prop()
  revocationReason?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Session" })
  replacedBySessionId?: Types.ObjectId;

  @Prop()
  userAgent?: string;

  @Prop()
  ipAddress?: string;

  @Prop({ default: Date.now })
  lastUsedAt!: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

SessionSchema.index({ userId: 1, revokedAt: 1, refreshExpiresAt: 1 });
SessionSchema.index({ familyId: 1, revokedAt: 1 });
