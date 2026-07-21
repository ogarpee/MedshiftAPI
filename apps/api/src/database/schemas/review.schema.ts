import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";

export type ReviewDocument = HydratedDocument<Review>;

@Schema({ collection: "reviews", timestamps: { createdAt: true, updatedAt: false } })
export class Review {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Shift", required: true })
  shiftId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true })
  reviewerId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true })
  revieweeId!: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  rating!: number;

  @Prop()
  comment?: string;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

ReviewSchema.index({ shiftId: 1, reviewerId: 1 }, { unique: true });
