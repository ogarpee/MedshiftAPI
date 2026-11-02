import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";

export type WorkerOnboardingDraftDocument = HydratedDocument<WorkerOnboardingDraft>;

@Schema({ collection: "worker_onboarding_drafts", timestamps: true })
export class WorkerOnboardingDraft {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "WorkerProfile" })
  profileId?: Types.ObjectId;

  @Prop({ min: 0, max: 4, default: 0 })
  currentStep!: number;

  @Prop({ default: 1 })
  schemaVersion!: number;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true, default: () => ({}) })
  data!: Record<string, unknown>;

  createdAt!: Date;
  updatedAt!: Date;
}

export const WorkerOnboardingDraftSchema = SchemaFactory.createForClass(WorkerOnboardingDraft);
