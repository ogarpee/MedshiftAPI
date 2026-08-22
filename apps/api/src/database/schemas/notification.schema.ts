import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";
import { NotificationType } from "@medshift/shared-types";

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ collection: "notifications", timestamps: true })
export class Notification {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ enum: NotificationType, required: true })
  type!: NotificationType;

  @Prop({ required: true, trim: true, maxlength: 120 })
  title!: string;

  @Prop({ required: true, trim: true, maxlength: 320 })
  body!: string;

  @Prop({ type: String, trim: true })
  href?: string;

  @Prop({ type: Map, of: String, default: {} })
  metadata!: Map<string, string>;

  @Prop({ type: Date, default: null })
  readAt?: Date | null;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: -1 });
