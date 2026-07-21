import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";
import { ClinicalRole, ShiftStatus } from "@medshift/shared-types";

export type ShiftDocument = HydratedDocument<Shift>;

@Schema({ _id: false })
class GeoPoint {
  @Prop({ enum: ["Point"], default: "Point" })
  type!: "Point";

  @Prop({ type: [Number], required: true })
  coordinates!: [number, number];
}

@Schema({ collection: "shifts", timestamps: true })
export class Shift {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "FacilityProfile", required: true })
  facilityId!: Types.ObjectId;

  @Prop({ enum: ClinicalRole, required: true })
  roleRequired!: ClinicalRole;

  @Prop({ required: true })
  startTime!: Date;

  @Prop({ required: true })
  endTime!: Date;

  @Prop({ required: true, min: 0 })
  hourlyRate!: number;

  @Prop({ enum: ShiftStatus, default: ShiftStatus.Open })
  status!: ShiftStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "WorkerProfile", default: null })
  matchedWorkerId?: Types.ObjectId | null;

  @Prop({ type: GeoPoint, required: true })
  location!: GeoPoint;

  @Prop()
  description?: string;
}

export const ShiftSchema = SchemaFactory.createForClass(Shift);

ShiftSchema.index({ location: "2dsphere" });
ShiftSchema.index({ status: 1, startTime: 1 });
