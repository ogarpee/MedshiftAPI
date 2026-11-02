import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";
import {
  AttendanceEventType,
  DisputeStatus,
  ShiftApplicationStatus,
  ShiftAssignmentStatus,
  ShiftInvitationStatus,
  TimesheetStatus
} from "@medshift/shared-types";

export type ShiftApplicationDocument = HydratedDocument<ShiftApplication>;
export type ShiftInvitationDocument = HydratedDocument<ShiftInvitation>;
export type ShiftAssignmentDocument = HydratedDocument<ShiftAssignment>;
export type AttendanceEventDocument = HydratedDocument<AttendanceEvent>;
export type TimesheetDocument = HydratedDocument<Timesheet>;
export type DisputeDocument = HydratedDocument<Dispute>;
export type AuditEventDocument = HydratedDocument<AuditEvent>;

@Schema({ collection: "shift_applications", timestamps: true })
export class ShiftApplication {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Shift", required: true, index: true })
  shiftId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "WorkerProfile", required: true, index: true })
  workerId!: Types.ObjectId;

  @Prop({ enum: ShiftApplicationStatus, default: ShiftApplicationStatus.Applied })
  status!: ShiftApplicationStatus;

  @Prop({ min: 0, max: 100 })
  matchScore?: number;

  @Prop()
  message?: string;

  @Prop({ default: Date.now })
  appliedAt!: Date;

  @Prop()
  reviewedAt?: Date;

  @Prop()
  selectedAt?: Date;
}

@Schema({ collection: "shift_invitations", timestamps: true })
export class ShiftInvitation {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Shift", required: true, index: true })
  shiftId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "WorkerProfile", required: true, index: true })
  workerId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true })
  invitedBy!: Types.ObjectId;

  @Prop({ enum: ShiftInvitationStatus, default: ShiftInvitationStatus.Pending })
  status!: ShiftInvitationStatus;

  @Prop()
  message?: string;

  @Prop()
  respondedAt?: Date;
}

@Schema({ collection: "shift_assignments", timestamps: true })
export class ShiftAssignment {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Shift", required: true, index: true })
  shiftId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "WorkerProfile", required: true, index: true })
  workerId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "ShiftApplication" })
  applicationId?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "ShiftInvitation" })
  invitationId?: Types.ObjectId;

  @Prop({ enum: ShiftAssignmentStatus, default: ShiftAssignmentStatus.Confirmed })
  status!: ShiftAssignmentStatus;

  @Prop({ default: Date.now })
  confirmedAt!: Date;

  @Prop()
  completedAt?: Date;

  @Prop()
  cancelledAt?: Date;
}

@Schema({ _id: false })
class AttendanceLocation {
  @Prop({ enum: ["Point"], default: "Point" })
  type!: "Point";

  @Prop({ type: [Number], required: true })
  coordinates!: [number, number];
}

@Schema({ _id: false })
class AttendanceVerification {
  @Prop({ enum: ["VERIFIED", "OUTSIDE_GEOFENCE", "MISSING"] })
  status!: "VERIFIED" | "OUTSIDE_GEOFENCE" | "MISSING";

  @Prop({ min: 0 })
  distanceMeters?: number;
}

@Schema({ collection: "attendance_events", timestamps: true })
export class AttendanceEvent {
  @Prop({ required: true, unique: true })
  idempotencyKey!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Shift", required: true, index: true })
  shiftId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "WorkerProfile", required: true, index: true })
  workerId!: Types.ObjectId;

  @Prop({ enum: AttendanceEventType, required: true })
  eventType!: AttendanceEventType;

  @Prop({ required: true })
  occurredAt!: Date;

  @Prop({ type: AttendanceLocation })
  location?: AttendanceLocation;

  @Prop({ type: AttendanceVerification })
  verification?: AttendanceVerification;

  @Prop()
  notes?: string;
}

@Schema({ collection: "timesheets", timestamps: true })
export class Timesheet {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Shift", required: true, index: true })
  shiftId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "WorkerProfile", required: true, index: true })
  workerId!: Types.ObjectId;

  @Prop({ enum: TimesheetStatus, default: TimesheetStatus.Draft })
  status!: TimesheetStatus;

  @Prop()
  scheduledStartTime?: Date;

  @Prop()
  scheduledEndTime?: Date;

  @Prop()
  actualStartTime?: Date;

  @Prop()
  actualEndTime?: Date;

  @Prop({ default: 0 })
  breakMinutes!: number;

  @Prop({ default: 0 })
  workedMinutes!: number;

  @Prop()
  notes?: string;

  @Prop()
  facilityNotes?: string;

  @Prop()
  submittedAt?: Date;

  @Prop()
  reviewedAt?: Date;
}

@Schema({ collection: "disputes", timestamps: true })
export class Dispute {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Shift" })
  shiftId?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Timesheet" })
  timesheetId?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Review" })
  reviewId?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "ShiftAssignment" })
  assignmentId?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true })
  openedBy!: Types.ObjectId;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: "User" }], default: [] })
  participantUserIds!: Types.ObjectId[];

  @Prop({ enum: DisputeStatus, default: DisputeStatus.Open })
  status!: DisputeStatus;

  @Prop({ required: true })
  reason!: string;

  @Prop()
  resolutionNotes?: string;

  @Prop()
  resolvedAt?: Date;
}

@Schema({ collection: "audit_events", timestamps: true })
export class AuditEvent {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User" })
  actorUserId?: Types.ObjectId;

  @Prop({ required: true })
  action!: string;

  @Prop()
  entityType?: string;

  @Prop()
  entityId?: string;

  @Prop({ type: Map, of: String, default: {} })
  metadata!: Map<string, string>;
}

export const ShiftApplicationSchema = SchemaFactory.createForClass(ShiftApplication);
export const ShiftInvitationSchema = SchemaFactory.createForClass(ShiftInvitation);
export const ShiftAssignmentSchema = SchemaFactory.createForClass(ShiftAssignment);
export const AttendanceEventSchema = SchemaFactory.createForClass(AttendanceEvent);
export const TimesheetSchema = SchemaFactory.createForClass(Timesheet);
export const DisputeSchema = SchemaFactory.createForClass(Dispute);
export const AuditEventSchema = SchemaFactory.createForClass(AuditEvent);

ShiftApplicationSchema.index({ shiftId: 1, workerId: 1 }, { unique: true });
ShiftInvitationSchema.index({ shiftId: 1, workerId: 1 }, { unique: true });
ShiftAssignmentSchema.index({ shiftId: 1, workerId: 1 }, { unique: true });
TimesheetSchema.index({ shiftId: 1, workerId: 1 }, { unique: true });
AttendanceEventSchema.index({ location: "2dsphere" });
AttendanceEventSchema.index({ workerId: 1, shiftId: 1, occurredAt: 1 });
ShiftAssignmentSchema.index({ workerId: 1, status: 1, confirmedAt: -1 });
DisputeSchema.index({ participantUserIds: 1, status: 1, createdAt: -1 });
