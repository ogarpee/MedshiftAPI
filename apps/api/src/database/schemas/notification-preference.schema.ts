import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";
import { NotificationCategory } from "@medshift/shared-types";

export type NotificationPreferenceDocument = HydratedDocument<NotificationPreference>;

@Schema({ collection: "notification_preferences", timestamps: true })
export class NotificationPreference {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Object, default: {} })
  categories!: Partial<Record<NotificationCategory, { inApp: boolean; email: boolean }>>;
}

export const NotificationPreferenceSchema = SchemaFactory.createForClass(NotificationPreference);
