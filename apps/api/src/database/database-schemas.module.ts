import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { FacilityProfile, FacilityProfileSchema } from "./schemas/facility-profile.schema";
import {
  AttendanceEvent,
  AttendanceEventSchema,
  AuditEvent,
  AuditEventSchema,
  Dispute,
  DisputeSchema,
  ShiftApplication,
  ShiftApplicationSchema,
  ShiftAssignment,
  ShiftAssignmentSchema,
  ShiftInvitation,
  ShiftInvitationSchema,
  Timesheet,
  TimesheetSchema
} from "./schemas/marketplace.schema";
import { Notification, NotificationSchema } from "./schemas/notification.schema";
import { RegistrationAttempt, RegistrationAttemptSchema } from "./schemas/registration-attempt.schema";
import { Review, ReviewSchema } from "./schemas/review.schema";
import { Shift, ShiftSchema } from "./schemas/shift.schema";
import { User, UserSchema } from "./schemas/user.schema";
import { WaitlistSignup, WaitlistSignupSchema } from "./schemas/waitlist-signup.schema";
import { WorkerProfile, WorkerProfileSchema } from "./schemas/worker-profile.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RegistrationAttempt.name, schema: RegistrationAttemptSchema },
      { name: WorkerProfile.name, schema: WorkerProfileSchema },
      { name: FacilityProfile.name, schema: FacilityProfileSchema },
      { name: Shift.name, schema: ShiftSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: WaitlistSignup.name, schema: WaitlistSignupSchema },
      { name: ShiftApplication.name, schema: ShiftApplicationSchema },
      { name: ShiftInvitation.name, schema: ShiftInvitationSchema },
      { name: ShiftAssignment.name, schema: ShiftAssignmentSchema },
      { name: AttendanceEvent.name, schema: AttendanceEventSchema },
      { name: Timesheet.name, schema: TimesheetSchema },
      { name: Dispute.name, schema: DisputeSchema },
      { name: AuditEvent.name, schema: AuditEventSchema }
    ])
  ],
  exports: [MongooseModule]
})
export class DatabaseSchemasModule {}
