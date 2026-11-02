import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  AttendanceEventType,
  DisputeStatus,
  NotificationType,
  OnboardingStatus,
  ShiftApplicationStatus,
  ShiftAssignmentStatus,
  ShiftInvitationStatus,
  ShiftStatus,
  ShiftVisibility,
  TimesheetStatus,
  UserRole
} from "@medshift/shared-types";
import { AuthUser } from "../auth/auth-user";
import {
  AttendanceEvent,
  AttendanceEventDocument,
  AuditEvent,
  AuditEventDocument,
  Dispute,
  DisputeDocument,
  ShiftApplication,
  ShiftApplicationDocument,
  ShiftAssignment,
  ShiftAssignmentDocument,
  ShiftInvitation,
  ShiftInvitationDocument,
  Timesheet,
  TimesheetDocument
} from "../database/schemas/marketplace.schema";
import { Shift, ShiftDocument } from "../database/schemas/shift.schema";
import { WorkerProfile, WorkerProfileDocument } from "../database/schemas/worker-profile.schema";
import { FacilityProfile, FacilityProfileDocument } from "../database/schemas/facility-profile.schema";
import { NotificationService } from "../notifications/notification.service";
import {
  AssignShiftDto,
  AttendanceEventDto,
  CreateDisputeDto,
  CreateShiftApplicationDto,
  CreateShiftInvitationDto,
  CreateTimesheetDto,
  UpdateDisputeDto,
  UpdateShiftApplicationStatusDto,
  UpdateShiftInvitationStatusDto,
  UpdateTimesheetDto
} from "./dto/marketplace.dto";

@Injectable()
export class MarketplaceService {
  constructor(
    @InjectModel(Shift.name) private readonly shifts: Model<ShiftDocument>,
    @InjectModel(WorkerProfile.name) private readonly workers: Model<WorkerProfileDocument>,
    @InjectModel(FacilityProfile.name) private readonly facilities: Model<FacilityProfileDocument>,
    @InjectModel(ShiftApplication.name) private readonly applications: Model<ShiftApplicationDocument>,
    @InjectModel(ShiftInvitation.name) private readonly invitations: Model<ShiftInvitationDocument>,
    @InjectModel(ShiftAssignment.name) private readonly assignments: Model<ShiftAssignmentDocument>,
    @InjectModel(AttendanceEvent.name) private readonly attendanceEvents: Model<AttendanceEventDocument>,
    @InjectModel(Timesheet.name) private readonly timesheets: Model<TimesheetDocument>,
    @InjectModel(Dispute.name) private readonly disputes: Model<DisputeDocument>,
    @InjectModel(AuditEvent.name) private readonly auditEvents: Model<AuditEventDocument>,
    private readonly notificationService: NotificationService
  ) {}

  async getMatches(currentUser: AuthUser, shiftId: string) {
    const shift = await this.findShiftForFacility(currentUser, shiftId);
    const workers = await this.workers
      .find({
        "onboarding.verificationStatus": "APPROVED",
        title: shift.roleRequired,
        ...(shift.requirements?.minimumExperienceYears ? { yearsExperience: { $gte: shift.requirements.minimumExperienceYears } } : {})
      })
      .limit(50)
      .exec();

    return workers.filter((worker) => this.workerMeetsShiftRequirements(worker, shift)).map((worker) => ({
      workerId: worker.id,
      firstName: worker.firstName,
      lastName: worker.lastName,
      title: worker.title,
      matchScore: this.calculateMatchScore(worker, shift),
      skills: worker.skills ?? [],
      yearsExperience: worker.yearsExperience ?? 0,
      reliabilityScore: worker.stats?.reliabilityScore ?? 0,
      rating: worker.stats?.averageRating ?? 0
    }));
  }

  async listApplications(currentUser: AuthUser, shiftId: string) {
    await this.findShiftForParticipant(currentUser, shiftId);
    const filter: Record<string, unknown> = { shiftId: this.toObjectId(shiftId, "Shift not found") };
    if (currentUser.role === UserRole.Worker) filter.workerId = (await this.resolveCurrentWorker(currentUser))._id;
    const applications = await this.applications.find(filter).sort({ createdAt: -1 }).exec();
    return applications.map((application) => this.serialize(application));
  }

  async listMyApplications(currentUser: AuthUser) {
    if (currentUser.role === UserRole.Admin) {
      const applications = await this.applications.find().sort({ createdAt: -1 }).limit(200).exec();
      return applications.map((application) => this.serialize(application));
    }
    const worker = await this.resolveCurrentWorker(currentUser);
    const applications = await this.applications.find({ workerId: worker._id }).sort({ createdAt: -1 }).exec();
    return applications.map((application) => this.serialize(application));
  }

  async applyToShift(currentUser: AuthUser, shiftId: string, dto: CreateShiftApplicationDto) {
    const worker = await this.resolveCurrentWorker(currentUser);
    this.assertApprovedWorker(worker);
    const shift = await this.findShift(shiftId);
    this.assertShiftAcceptsApplications(shift);
    if (!this.workerMeetsShiftRequirements(worker, shift)) {
      throw new BadRequestException("Worker profile does not meet this shift's requirements");
    }
    await this.assertNoScheduleConflict(worker._id, shift);
    const application = await this.applications.findOneAndUpdate(
      { shiftId: this.toObjectId(shiftId, "Shift not found"), workerId: worker._id },
      { $setOnInsert: { appliedAt: new Date() }, $set: { message: dto.message, status: ShiftApplicationStatus.Applied } },
      { new: true, upsert: true }
    ).exec();
    const facility = await this.facilities.findById(shift.facilityId).exec();
    if (facility?.userId) {
      await this.notify(facility.userId, NotificationType.MarketplaceApplication, "New shift application", `${worker.firstName} ${worker.lastName} applied for ${shift.title ?? shift.roleRequired} coverage.`, "/facility/marketplace", {
        applicationId: application.id,
        shiftId
      });
    }
    await this.audit(currentUser, "shift.application.submitted", "ShiftApplication", application.id);
    return this.serialize(application);
  }

  async updateApplicationStatus(currentUser: AuthUser, id: string, dto: UpdateShiftApplicationStatusDto) {
    const application = await this.findApplication(id);
    if (currentUser.role === UserRole.Worker) {
      const worker = await this.resolveCurrentWorker(currentUser);
      if (!application.workerId.equals(worker._id)) throw new ForbiddenException("You can only withdraw your own applications");
      if (dto.status !== ShiftApplicationStatus.Withdrawn) throw new ForbiddenException("Workers can only withdraw applications");
    } else {
      await this.findShiftForFacility(currentUser, application.shiftId.toString());
    }
    this.assertApplicationTransition(application.status, dto.status, currentUser.role);
    if (dto.status === ShiftApplicationStatus.Selected || dto.status === ShiftApplicationStatus.Confirmed) {
      await this.createAssignment(currentUser, application.shiftId, application.workerId, { applicationId: application._id });
    }
    application.status = dto.status;
    application.matchScore = dto.matchScore ?? application.matchScore;
    application.reviewedAt = new Date();
    if (dto.status === ShiftApplicationStatus.Selected || dto.status === ShiftApplicationStatus.Confirmed) {
      application.selectedAt = application.selectedAt ?? new Date();
    }
    const saved = await application.save();
    const worker = await this.workers.findById(application.workerId).exec();
    if (worker?.userId) {
      await this.notify(worker.userId, NotificationType.MarketplaceApplication, "Application updated", `Your shift application is now ${dto.status.replaceAll("_", " ").toLowerCase()}.`, "/worker/marketplace", {
        applicationId: saved.id,
        shiftId: saved.shiftId.toString(),
        status: dto.status
      });
    }
    await this.audit(currentUser, "shift.application.status_updated", "ShiftApplication", saved.id, { status: dto.status });
    return this.serialize(saved);
  }

  async listInvitations(currentUser: AuthUser, shiftId: string) {
    await this.findShiftForParticipant(currentUser, shiftId);
    const filter: Record<string, unknown> = { shiftId: this.toObjectId(shiftId, "Shift not found") };
    if (currentUser.role === UserRole.Worker) filter.workerId = (await this.resolveCurrentWorker(currentUser))._id;
    const invitations = await this.invitations.find(filter).sort({ createdAt: -1 }).exec();
    return invitations.map((invitation) => this.serialize(invitation));
  }

  async listMyInvitations(currentUser: AuthUser) {
    if (currentUser.role === UserRole.Admin) {
      const invitations = await this.invitations.find().sort({ createdAt: -1 }).limit(200).exec();
      return invitations.map((invitation) => this.serialize(invitation));
    }
    const worker = await this.resolveCurrentWorker(currentUser);
    const invitations = await this.invitations.find({ workerId: worker._id }).sort({ createdAt: -1 }).exec();
    return invitations.map((invitation) => this.serialize(invitation));
  }

  async inviteWorker(currentUser: AuthUser, shiftId: string, dto: CreateShiftInvitationDto) {
    const shift = await this.findShiftForFacility(currentUser, shiftId);
    this.assertShiftAcceptsInvitations(shift);
    const worker = await this.findWorker(dto.workerId);
    this.assertApprovedWorker(worker);
    if (!this.workerMeetsShiftRequirements(worker, shift)) {
      throw new BadRequestException("Worker profile does not meet this shift's requirements");
    }
    await this.assertNoScheduleConflict(worker._id, shift);
    const invitation = await this.invitations.findOneAndUpdate(
      { shiftId: this.toObjectId(shiftId, "Shift not found"), workerId: worker._id },
      { invitedBy: new Types.ObjectId(currentUser.sub), message: dto.message, status: ShiftInvitationStatus.Pending },
      { new: true, upsert: true }
    ).exec();
    await this.notify(worker.userId, NotificationType.MarketplaceInvitation, "New shift invitation", `You were invited to ${shift.title ?? shift.roleRequired} coverage.`, "/worker/marketplace", {
      invitationId: invitation.id,
      shiftId
    });
    await this.audit(currentUser, "shift.invitation.created", "ShiftInvitation", invitation.id);
    return this.serialize(invitation);
  }

  async updateInvitationStatus(currentUser: AuthUser, id: string, dto: UpdateShiftInvitationStatusDto) {
    const invitation = await this.findInvitation(id);
    if (currentUser.role === UserRole.Worker) {
      const worker = await this.resolveCurrentWorker(currentUser);
      if (!invitation.workerId.equals(worker._id)) throw new ForbiddenException("You can only respond to your own invitations");
      if (!new Set<ShiftInvitationStatus>([ShiftInvitationStatus.Accepted, ShiftInvitationStatus.Declined]).has(dto.status)) {
        throw new ForbiddenException("Workers can only accept or decline invitations");
      }
    } else {
      await this.findShiftForFacility(currentUser, invitation.shiftId.toString());
      if (currentUser.role === UserRole.Facility && dto.status !== ShiftInvitationStatus.Cancelled) {
        throw new ForbiddenException("Facilities can only cancel pending invitations");
      }
    }
    if (invitation.status !== ShiftInvitationStatus.Pending) throw new BadRequestException("Invitation has already been resolved");
    if (dto.status === ShiftInvitationStatus.Accepted) {
      await this.createAssignment(currentUser, invitation.shiftId, invitation.workerId, { invitationId: invitation._id });
    }
    invitation.status = dto.status;
    invitation.respondedAt = new Date();
    const saved = await invitation.save();
    const shift = await this.findShift(invitation.shiftId.toString());
    const facility = await this.facilities.findById(shift.facilityId).exec();
    if (facility?.userId) {
      await this.notify(facility.userId, NotificationType.MarketplaceInvitation, "Invitation response", `A worker ${dto.status.toLowerCase()} your shift invitation.`, "/facility/marketplace", {
        invitationId: saved.id,
        shiftId: saved.shiftId.toString(),
        status: dto.status
      });
    }
    await this.audit(currentUser, "shift.invitation.status_updated", "ShiftInvitation", saved.id, { status: dto.status });
    return this.serialize(saved);
  }

  async assignWorker(currentUser: AuthUser, shiftId: string, dto: AssignShiftDto) {
    const shift = await this.findShiftForFacility(currentUser, shiftId);
    const worker = await this.findWorker(dto.workerId);
    this.assertApprovedWorker(worker);
    await this.assertNoScheduleConflict(worker._id, shift);
    if (dto.applicationId) {
      const application = await this.findApplication(dto.applicationId);
      if (!application.shiftId.equals(shift._id) || !application.workerId.equals(worker._id)) throw new BadRequestException("Application does not belong to this shift and worker");
    }
    if (dto.invitationId) {
      const invitation = await this.findInvitation(dto.invitationId);
      if (!invitation.shiftId.equals(shift._id) || !invitation.workerId.equals(worker._id)) throw new BadRequestException("Invitation does not belong to this shift and worker");
    }
    const assignment = await this.createAssignment(currentUser, shift._id, worker._id, {
      applicationId: dto.applicationId ? new Types.ObjectId(dto.applicationId) : undefined,
      invitationId: dto.invitationId ? new Types.ObjectId(dto.invitationId) : undefined
    });
    return this.serialize(assignment);
  }

  async quickAccept(currentUser: AuthUser, shiftId: string) {
    const worker = await this.resolveCurrentWorker(currentUser);
    this.assertApprovedWorker(worker);
    const shift = await this.findShift(shiftId);
    this.assertShiftAcceptsApplications(shift);
    if (!this.workerMeetsShiftRequirements(worker, shift)) throw new BadRequestException("Worker profile does not meet this shift's requirements");
    return this.createAssignment(currentUser, shift._id, worker._id);
  }

  async listAssignments(currentUser: AuthUser) {
    const filter = await this.buildAssignmentFilter(currentUser);
    const assignments = await this.assignments.find(filter).sort({ createdAt: -1 }).exec();
    return assignments.map((assignment) => this.serialize(assignment));
  }

  async listAttendance(currentUser: AuthUser) {
    const filter = await this.buildAssignmentFilter(currentUser);
    const assignments = await this.assignments.find(filter).select("shiftId workerId").exec();
    if (!assignments.length) return [];
    const attendanceEvents = await this.attendanceEvents
      .find({ $or: assignments.map((assignment) => ({ shiftId: assignment.shiftId, workerId: assignment.workerId })) })
      .sort({ occurredAt: -1 })
      .limit(300)
      .exec();
    return attendanceEvents.map((event) => this.serialize(event));
  }

  async recordAttendance(currentUser: AuthUser, eventType: AttendanceEventType, dto: AttendanceEventDto) {
    const worker = await this.resolveCurrentWorker(currentUser);
    const shift = await this.findShift(dto.shiftId);
    const assignment = await this.findConfirmedAssignment(shift._id, worker._id);
    await this.assertAttendanceSequence(worker._id, shift._id, eventType);
    if (Math.abs(dto.occurredAt.getTime() - Date.now()) > 15 * 60 * 1000) throw new BadRequestException("Attendance time must be within 15 minutes of the current time");
    const existingEvent = await this.attendanceEvents.findOne({ idempotencyKey: dto.idempotencyKey }).exec();
    if (existingEvent) {
      if (!existingEvent.shiftId.equals(shift._id) || !existingEvent.workerId.equals(worker._id) || existingEvent.eventType !== eventType) {
        throw new BadRequestException("Attendance idempotency key is already in use");
      }
      return this.serialize(existingEvent);
    }
    const verification = attendanceVerification(dto.location?.coordinates, shift.location.coordinates);
    const event = await this.attendanceEvents.create({
        idempotencyKey: dto.idempotencyKey,
        shiftId: new Types.ObjectId(dto.shiftId),
        workerId: worker._id,
        eventType,
        occurredAt: dto.occurredAt,
        location: dto.location,
        verification,
        notes: dto.notes
      });
    if (eventType === AttendanceEventType.ClockIn) assignment.status = ShiftAssignmentStatus.InProgress;
    if (eventType === AttendanceEventType.ClockOut) {
      assignment.status = ShiftAssignmentStatus.Completed;
      assignment.completedAt = new Date();
    }
    await assignment.save();
    if (eventType === AttendanceEventType.ClockIn) {
      shift.status = ShiftStatus.InProgress;
      await shift.save();
    }
    if (eventType === AttendanceEventType.ClockOut) await this.recomputeShiftStatus(shift);
    const facility = await this.facilities.findById(shift.facilityId).exec();
    if (facility?.userId) {
      await this.notify(facility.userId, NotificationType.MarketplaceAttendance, "Attendance updated", `Worker attendance recorded: ${eventType.replaceAll("_", " ").toLowerCase()}.`, "/facility/marketplace", {
        shiftId: dto.shiftId,
        eventId: event.id,
        eventType
      });
    }
    await this.audit(currentUser, `attendance.${eventType.toLowerCase()}`, "AttendanceEvent", event.id);
    return this.serialize(event);
  }

  async listTimesheets(currentUser: AuthUser) {
    const filter = await this.buildTimesheetFilter(currentUser);
    const timesheets = await this.timesheets.find(filter).sort({ createdAt: -1 }).exec();
    return timesheets.map((timesheet) => this.serialize(timesheet));
  }

  async createTimesheet(currentUser: AuthUser, dto: CreateTimesheetDto) {
    const worker = await this.resolveCurrentWorker(currentUser);
    const shift = await this.findShift(dto.shiftId);
    await this.findConfirmedAssignment(shift._id, worker._id);
    const existingTimesheet = await this.timesheets.findOne({ shiftId: shift._id, workerId: worker._id }).exec();
    if (existingTimesheet && new Set<TimesheetStatus>([TimesheetStatus.Approved, TimesheetStatus.Disputed]).has(existingTimesheet.status)) {
      throw new BadRequestException("Approved or disputed timesheets cannot be resubmitted");
    }
    const clockOut = await this.attendanceEvents.findOne({ shiftId: shift._id, workerId: worker._id, eventType: AttendanceEventType.ClockOut }).exec();
    if (!clockOut && (!dto.actualStartTime || !dto.actualEndTime)) {
      throw new BadRequestException("Clock out or manual actual times are required before submitting a timesheet");
    }
    const actualStartTime = dto.actualStartTime ?? (await this.findFirstAttendanceTime(worker._id, shift._id, AttendanceEventType.ClockIn)) ?? shift.startTime;
    const actualEndTime = dto.actualEndTime ?? clockOut?.occurredAt ?? shift.endTime;
    if (actualEndTime.getTime() <= actualStartTime.getTime()) throw new BadRequestException("Timesheet end time must be after start time");
    const durationMinutes = Math.round((actualEndTime.getTime() - actualStartTime.getTime()) / 60000);
    if ((dto.breakMinutes ?? 0) >= durationMinutes) throw new BadRequestException("Break time must be shorter than the worked interval");
    const timesheet = await this.timesheets.findOneAndUpdate(
      { shiftId: shift._id, workerId: worker._id },
      {
        scheduledStartTime: shift.startTime,
        scheduledEndTime: shift.endTime,
        actualStartTime,
        actualEndTime,
        breakMinutes: dto.breakMinutes ?? 0,
        workedMinutes: Math.max(0, Math.round((actualEndTime.getTime() - actualStartTime.getTime()) / 60000) - (dto.breakMinutes ?? 0)),
        notes: dto.notes,
        status: TimesheetStatus.Submitted,
        submittedAt: new Date()
      },
      { new: true, upsert: true }
    ).exec();
    const facility = await this.facilities.findById(shift.facilityId).exec();
    if (facility?.userId) {
      await this.notify(facility.userId, NotificationType.MarketplaceTimesheet, "Timesheet submitted", "A worker submitted a timesheet for review.", "/facility/marketplace", {
        shiftId: dto.shiftId,
        timesheetId: timesheet.id
      });
    }
    await this.audit(currentUser, "timesheet.submitted", "Timesheet", timesheet.id);
    shift.status = ShiftStatus.TimesheetSubmitted;
    await this.recomputeShiftStatus(shift);
    return this.serialize(timesheet);
  }

  async updateTimesheet(currentUser: AuthUser, id: string, dto: UpdateTimesheetDto) {
    const timesheet = await this.findTimesheet(id);
    if (currentUser.role !== UserRole.Admin) {
      await this.findShiftForFacility(currentUser, timesheet.shiftId.toString());
    }
    const allowedStatuses = new Set<TimesheetStatus>([TimesheetStatus.Approved, TimesheetStatus.Rejected, TimesheetStatus.CorrectionRequested, TimesheetStatus.Disputed]);
    if (dto.status && currentUser.role !== UserRole.Admin && !allowedStatuses.has(dto.status)) throw new BadRequestException("Invalid facility timesheet transition");
    if (timesheet.status !== TimesheetStatus.Submitted && dto.status !== TimesheetStatus.Disputed) throw new BadRequestException("Only submitted timesheets can be reviewed");
    timesheet.status = dto.status ?? timesheet.status;
    timesheet.facilityNotes = dto.facilityNotes ?? timesheet.facilityNotes;
    timesheet.notes = dto.notes ?? timesheet.notes;
    timesheet.reviewedAt = new Date();
    const saved = await timesheet.save();
    const worker = await this.workers.findById(timesheet.workerId).exec();
    if (worker?.userId) {
      await this.notify(worker.userId, NotificationType.MarketplaceTimesheet, "Timesheet updated", `Your timesheet is now ${(saved.status ?? "").replaceAll("_", " ").toLowerCase()}.`, "/worker/marketplace", {
        shiftId: saved.shiftId.toString(),
        timesheetId: saved.id,
        status: saved.status
      });
    }
    await this.audit(currentUser, "timesheet.status_updated", "Timesheet", saved.id, { status: saved.status });
    const shift = await this.findShift(saved.shiftId.toString());
    await this.recomputeShiftStatus(shift);
    return this.serialize(saved);
  }

  async createDispute(currentUser: AuthUser, dto: CreateDisputeDto) {
    if (!dto.shiftId && !dto.timesheetId && !dto.reviewId && !dto.assignmentId) throw new BadRequestException("A dispute must reference a marketplace record");
    const context = await this.resolveDisputeContext(currentUser, dto);
    const dispute = await this.disputes.create({
      shiftId: context.shift._id,
      timesheetId: dto.timesheetId ? new Types.ObjectId(dto.timesheetId) : undefined,
      reviewId: dto.reviewId ? new Types.ObjectId(dto.reviewId) : undefined,
      assignmentId: context.assignment?._id,
      openedBy: new Types.ObjectId(currentUser.sub),
      participantUserIds: context.participantUserIds,
      reason: dto.reason,
      status: DisputeStatus.Open
    });
    await this.notifyDisputeParties(currentUser, dispute);
    await this.audit(currentUser, "dispute.created", "Dispute", dispute.id);
    return this.serialize(dispute);
  }

  async updateDispute(currentUser: AuthUser, id: string, dto: UpdateDisputeDto) {
    const dispute = await this.disputes.findById(id).exec();
    if (!dispute) throw new NotFoundException("Dispute not found");
    if (currentUser.role !== UserRole.Admin && !(await this.canAccessDispute(currentUser, dispute))) {
      throw new ForbiddenException("You can only update disputes connected to your marketplace records");
    }
    if (currentUser.role !== UserRole.Admin && dto.status && dto.status !== DisputeStatus.Cancelled) {
      throw new ForbiddenException("Only admins can resolve or reject disputes");
    }
    dispute.status = dto.status ?? dispute.status;
    dispute.resolutionNotes = dto.resolutionNotes ?? dispute.resolutionNotes;
    if (dto.status === DisputeStatus.Resolved || dto.status === DisputeStatus.Rejected) dispute.resolvedAt = new Date();
    const saved = await dispute.save();
    await this.audit(currentUser, "dispute.status_updated", "Dispute", saved.id, { status: saved.status });
    return this.serialize(saved);
  }

  async listDisputes(currentUser: AuthUser) {
    const filter = await this.buildDisputeFilter(currentUser);
    const disputes = await this.disputes.find(filter).sort({ createdAt: -1 }).exec();
    return disputes.map((dispute) => this.serialize(dispute));
  }

  async listAuditEvents() {
    const events = await this.auditEvents.find().sort({ createdAt: -1 }).limit(200).exec();
    return events.map((event) => this.serialize(event));
  }

  async getMarketplaceOverview(currentUser: AuthUser) {
    const shiftIds = await this.resolveMarketplaceShiftIds(currentUser);
    const shiftFilter = shiftIds ? { shiftId: { $in: shiftIds } } : {};
    const [
      applications,
      pendingApplications,
      invitations,
      pendingInvitations,
      assignments,
      activeAssignments,
      attendanceEvents,
      submittedTimesheets,
      openDisputes
    ] = await Promise.all([
      this.applications.countDocuments(shiftFilter),
      this.applications.countDocuments({ ...shiftFilter, status: { $in: [ShiftApplicationStatus.Applied, ShiftApplicationStatus.UnderReview] } }),
      this.invitations.countDocuments(shiftFilter),
      this.invitations.countDocuments({ ...shiftFilter, status: ShiftInvitationStatus.Pending }),
      this.assignments.countDocuments(shiftFilter),
      this.assignments.countDocuments({ ...shiftFilter, status: { $in: [ShiftAssignmentStatus.Confirmed, ShiftAssignmentStatus.InProgress] } }),
      this.attendanceEvents.countDocuments(shiftFilter),
      this.timesheets.countDocuments({ ...shiftFilter, status: TimesheetStatus.Submitted }),
      this.disputes.countDocuments(shiftIds ? { $or: [{ shiftId: { $in: shiftIds } }, { openedBy: new Types.ObjectId(currentUser.sub) }], status: { $in: [DisputeStatus.Open, DisputeStatus.UnderReview] } } : { status: { $in: [DisputeStatus.Open, DisputeStatus.UnderReview] } })
    ]);
    return { applications, pendingApplications, invitations, pendingInvitations, assignments, activeAssignments, attendanceEvents, submittedTimesheets, openDisputes };
  }

  private calculateMatchScore(worker: WorkerProfileDocument, shift: ShiftDocument) {
    const requirements = shift.requirements;
    let score = 50;
    if ((worker.yearsExperience ?? 0) >= (requirements?.minimumExperienceYears ?? 0)) score += 15;
    if (requirements?.requiredSkills?.length) {
      const workerSkills = new Set((worker.skills ?? []).map((skill) => skill.toLowerCase()));
      score += Math.min(20, requirements.requiredSkills.filter((skill) => workerSkills.has(skill.toLowerCase())).length * 5);
    }
    score += Math.min(15, worker.stats?.reliabilityScore ?? 0);
    return Math.min(100, score);
  }

  private workerMeetsShiftRequirements(worker: WorkerProfileDocument, shift: ShiftDocument) {
    const requirements = shift.requirements;
    if (!requirements) return true;
    if ((worker.yearsExperience ?? 0) < (requirements.minimumExperienceYears ?? 0)) return false;
    if (!this.includesAll(worker.skills ?? [], requirements.requiredSkills ?? [])) return false;
    if (!this.includesAll(this.credentialTypes(worker.qualifications), requirements.requiredQualifications ?? [])) return false;
    if (!this.includesAll(this.credentialTypes(worker.certifications), requirements.requiredCertifications ?? [])) return false;
    return true;
  }

  private includesAll(workerValues: string[], requiredValues: string[]) {
    if (!requiredValues.length) return true;
    const values = new Set(workerValues.map((value) => value.toLowerCase().trim()).filter(Boolean));
    return requiredValues.every((value) => values.has(value.toLowerCase().trim()));
  }

  private credentialTypes(credentials?: Array<{ type?: string; verificationStatus?: string; isVerified?: boolean }>) {
    return (credentials ?? [])
      .filter((credential) => credential.isVerified || credential.verificationStatus === "VERIFIED")
      .map((credential) => credential.type ?? "")
      .filter(Boolean);
  }

  private assertApprovedWorker(worker: WorkerProfileDocument) {
    if (worker.onboarding?.verificationStatus !== OnboardingStatus.Approved) {
      throw new ForbiddenException("Worker onboarding must be approved for marketplace actions");
    }
  }

  private assertApplicationTransition(current: ShiftApplicationStatus, next: ShiftApplicationStatus, role: UserRole) {
    if (current === next) return;
    if (role === UserRole.Worker) {
      if (next === ShiftApplicationStatus.Withdrawn && new Set<ShiftApplicationStatus>([ShiftApplicationStatus.Applied, ShiftApplicationStatus.UnderReview]).has(current)) return;
      throw new BadRequestException("Application can no longer be withdrawn");
    }
    const allowed = new Map<ShiftApplicationStatus, Set<ShiftApplicationStatus>>([
      [ShiftApplicationStatus.Applied, new Set([ShiftApplicationStatus.UnderReview, ShiftApplicationStatus.Selected, ShiftApplicationStatus.Declined])],
      [ShiftApplicationStatus.UnderReview, new Set([ShiftApplicationStatus.Selected, ShiftApplicationStatus.Declined])],
      [ShiftApplicationStatus.Selected, new Set([ShiftApplicationStatus.Confirmed])]
    ]);
    if (!allowed.get(current)?.has(next)) throw new BadRequestException(`Invalid application transition from ${current} to ${next}`);
  }

  private assertShiftCanReceiveMarketplaceAction(shift: ShiftDocument) {
    const openStatuses = new Set<ShiftStatus>([ShiftStatus.Open, ShiftStatus.Published, ShiftStatus.Matching]);
    if (!openStatuses.has(shift.status)) {
      throw new BadRequestException("Shift is not open for marketplace interest");
    }
  }

  private assertShiftAcceptsApplications(shift: ShiftDocument) {
    this.assertShiftCanReceiveMarketplaceAction(shift);
    const applicationVisibilities = new Set<ShiftVisibility | undefined>([ShiftVisibility.Open, ShiftVisibility.Both, undefined]);
    if (!applicationVisibilities.has(shift.visibility)) {
      throw new BadRequestException("Shift is invitation-only and cannot receive open applications");
    }
  }

  private assertShiftAcceptsInvitations(shift: ShiftDocument) {
    this.assertShiftCanReceiveMarketplaceAction(shift);
    if (![ShiftVisibility.Recommended, ShiftVisibility.Both, ShiftVisibility.Open, undefined].includes(shift.visibility)) {
      throw new BadRequestException("Shift cannot receive invitations");
    }
  }

  private async assertNoScheduleConflict(workerId: Types.ObjectId, shift: ShiftDocument) {
    const assignments = await this.assignments.find({ workerId, status: { $in: [ShiftAssignmentStatus.Confirmed, ShiftAssignmentStatus.InProgress] } }).exec();
    const shiftIds = assignments.map((assignment) => assignment.shiftId).filter((shiftId) => !shiftId.equals(shift._id));
    if (!shiftIds.length) return;
    const conflict = await this.shifts.findOne({
      _id: { $in: shiftIds },
      startTime: { $lt: shift.endTime },
      endTime: { $gt: shift.startTime },
      status: { $nin: [ShiftStatus.Cancelled, ShiftStatus.Completed] }
    }).exec();
    if (conflict) throw new BadRequestException("Worker already has an assignment that overlaps this shift");
  }

  private async createAssignment(currentUser: AuthUser, shiftId: Types.ObjectId, workerId: Types.ObjectId, links: { applicationId?: Types.ObjectId; invitationId?: Types.ObjectId } = {}) {
    const shift = await this.findShift(shiftId.toString());
    const worker = await this.findWorker(workerId.toString());
    this.assertApprovedWorker(worker);
    await this.assertNoScheduleConflict(worker._id, shift);
    const transaction = await this.shifts.db.startSession();
    const transactionResult: { assignment?: ShiftAssignmentDocument } = {};
    try {
      await transaction.withTransaction(async () => {
        const existing = await this.assignments.findOne({ shiftId, workerId }).session(transaction).exec();
        if (existing && new Set<ShiftAssignmentStatus>([ShiftAssignmentStatus.Confirmed, ShiftAssignmentStatus.InProgress, ShiftAssignmentStatus.Completed]).has(existing.status)) {
          transactionResult.assignment = existing;
          return;
        }
        const reservedShift = await this.shifts.findOneAndUpdate(
          {
            _id: shiftId,
            status: { $in: [ShiftStatus.Open, ShiftStatus.Published, ShiftStatus.Matching] },
            $expr: { $lt: [{ $ifNull: ["$activeAssignmentCount", 0] }, "$caregiversRequired"] }
          },
          { $inc: { activeAssignmentCount: 1 } },
          { new: true, session: transaction }
        ).exec();
        if (!reservedShift) throw new BadRequestException("Shift staffing requirement is already filled");
        transactionResult.assignment = await this.assignments.findOneAndUpdate(
          { shiftId, workerId },
          {
            applicationId: links.applicationId,
            invitationId: links.invitationId,
            status: ShiftAssignmentStatus.Confirmed,
            confirmedAt: new Date(),
            completedAt: undefined,
            cancelledAt: undefined
          },
          { new: true, upsert: true, session: transaction }
        ).exec();
        reservedShift.matchedWorkerId = reservedShift.matchedWorkerId ?? workerId;
        if (reservedShift.activeAssignmentCount >= (reservedShift.caregiversRequired ?? 1)) {
          reservedShift.status = ShiftStatus.Assigned;
          reservedShift.filledAt = reservedShift.filledAt ?? new Date();
        }
        await reservedShift.save({ session: transaction });
      });
    } catch (error) {
      if (!isTransactionUnsupported(error)) throw error;
      transactionResult.assignment = await this.createAssignmentWithoutTransaction(shift, workerId, links);
    } finally {
      await transaction.endSession();
    }
    const assignment = transactionResult.assignment;
    if (!assignment) throw new BadRequestException("Assignment could not be created");
    if (worker?.userId) {
      await this.notify(worker.userId, NotificationType.MarketplaceAssignment, "Shift assignment confirmed", `You are confirmed for ${shift.title ?? shift.roleRequired} coverage.`, "/worker/marketplace", {
        assignmentId: assignment.id,
        shiftId: shift.id
      });
    }
    await this.audit(currentUser, "shift.assignment.created", "ShiftAssignment", assignment.id);
    return assignment;
  }

  private async createAssignmentWithoutTransaction(shift: ShiftDocument, workerId: Types.ObjectId, links: { applicationId?: Types.ObjectId; invitationId?: Types.ObjectId }) {
    const existing = await this.assignments.findOne({ shiftId: shift._id, workerId }).exec();
    if (existing && new Set<ShiftAssignmentStatus>([ShiftAssignmentStatus.Confirmed, ShiftAssignmentStatus.InProgress, ShiftAssignmentStatus.Completed]).has(existing.status)) return existing;
    const reservedShift = await this.shifts.findOneAndUpdate(
      {
        _id: shift._id,
        status: { $in: [ShiftStatus.Open, ShiftStatus.Published, ShiftStatus.Matching] },
        $expr: { $lt: [{ $ifNull: ["$activeAssignmentCount", 0] }, "$caregiversRequired"] }
      },
      { $inc: { activeAssignmentCount: 1 } },
      { new: true }
    ).exec();
    if (!reservedShift) throw new BadRequestException("Shift staffing requirement is already filled");
    try {
      let assignment: ShiftAssignmentDocument | null;
      if (existing) {
        const reactivated = await this.assignments.updateOne(
          { _id: existing._id, status: { $in: [ShiftAssignmentStatus.Cancelled, ShiftAssignmentStatus.NoShow] } },
          { $set: { applicationId: links.applicationId, invitationId: links.invitationId, status: ShiftAssignmentStatus.Confirmed, confirmedAt: new Date() }, $unset: { completedAt: 1, cancelledAt: 1 } }
        ).exec();
        if (!reactivated.modifiedCount) {
          await this.releaseReservedCapacity(shift._id);
          assignment = await this.assignments.findOne({ shiftId: shift._id, workerId }).exec();
          if (!assignment) throw new BadRequestException("Assignment could not be created");
          return assignment;
        }
        assignment = await this.assignments.findById(existing._id).exec();
      } else {
        try {
          assignment = await this.assignments.create({
            shiftId: shift._id,
            workerId,
            applicationId: links.applicationId,
            invitationId: links.invitationId,
            status: ShiftAssignmentStatus.Confirmed,
            confirmedAt: new Date()
          });
        } catch (error) {
          if (!isDuplicateKeyError(error)) throw error;
          await this.releaseReservedCapacity(shift._id);
          assignment = await this.assignments.findOne({ shiftId: shift._id, workerId }).exec();
          if (!assignment) throw error;
          return assignment;
        }
      }
      if (!assignment) throw new BadRequestException("Assignment could not be created");
      reservedShift.matchedWorkerId = reservedShift.matchedWorkerId ?? workerId;
      if (reservedShift.activeAssignmentCount >= (reservedShift.caregiversRequired ?? 1)) {
        reservedShift.status = ShiftStatus.Assigned;
        reservedShift.filledAt = reservedShift.filledAt ?? new Date();
      }
      await reservedShift.save();
      return assignment;
    } catch (error) {
      await this.releaseReservedCapacity(shift._id);
      throw error;
    }
  }

  private async releaseReservedCapacity(shiftId: Types.ObjectId) {
    await this.shifts.updateOne({ _id: shiftId, activeAssignmentCount: { $gt: 0 } }, { $inc: { activeAssignmentCount: -1 } }).exec();
  }

  private async findConfirmedAssignment(shiftId: Types.ObjectId, workerId: Types.ObjectId) {
    const assignment = await this.assignments.findOne({ shiftId, workerId, status: { $in: [ShiftAssignmentStatus.Confirmed, ShiftAssignmentStatus.InProgress, ShiftAssignmentStatus.Completed] } }).exec();
    if (!assignment) throw new ForbiddenException("Confirmed assignment required for this marketplace action");
    return assignment;
  }

  private async assertAttendanceSequence(workerId: Types.ObjectId, shiftId: Types.ObjectId, eventType: AttendanceEventType) {
    const events = await this.attendanceEvents.find({ workerId, shiftId }).sort({ occurredAt: 1 }).exec();
    const hasClockIn = events.some((event) => event.eventType === AttendanceEventType.ClockIn);
    const hasOpenBreak = events.filter((event) => event.eventType === AttendanceEventType.BreakStart).length > events.filter((event) => event.eventType === AttendanceEventType.BreakEnd).length;
    const hasClockOut = events.some((event) => event.eventType === AttendanceEventType.ClockOut);
    if (hasClockOut) throw new BadRequestException("Attendance is already clocked out for this shift");
    if (eventType !== AttendanceEventType.ClockIn && !hasClockIn) throw new BadRequestException("Clock in before recording break or clock out");
    if (eventType === AttendanceEventType.ClockIn && hasClockIn) throw new BadRequestException("Attendance is already clocked in for this shift");
    if (eventType === AttendanceEventType.BreakStart && hasOpenBreak) throw new BadRequestException("Break is already in progress");
    if (eventType === AttendanceEventType.BreakEnd && !hasOpenBreak) throw new BadRequestException("No break is currently in progress");
  }

  private async findFirstAttendanceTime(workerId: Types.ObjectId, shiftId: Types.ObjectId, eventType: AttendanceEventType) {
    const event = await this.attendanceEvents.findOne({ workerId, shiftId, eventType }).sort({ occurredAt: 1 }).exec();
    return event?.occurredAt;
  }

  private async buildAssignmentFilter(currentUser: AuthUser) {
    if (currentUser.role === UserRole.Admin) return {};
    if (currentUser.role === UserRole.Worker) {
      const worker = await this.resolveCurrentWorker(currentUser);
      return { workerId: worker._id };
    }
    const shiftIds = await this.resolveMarketplaceShiftIds(currentUser);
    return { shiftId: { $in: shiftIds ?? [] } };
  }

  private async buildDisputeFilter(currentUser: AuthUser) {
    if (currentUser.role === UserRole.Admin) return {};
    const ownFilter = { openedBy: new Types.ObjectId(currentUser.sub) };
    const shiftIds = await this.resolveMarketplaceShiftIds(currentUser);
    if (!shiftIds?.length) return ownFilter;
    return { $or: [ownFilter, { shiftId: { $in: shiftIds } }] };
  }

  private async resolveMarketplaceShiftIds(currentUser: AuthUser) {
    if (currentUser.role === UserRole.Admin) return undefined;
    if (currentUser.role === UserRole.Worker) {
      const worker = await this.resolveCurrentWorker(currentUser);
      const assignments = await this.assignments.find({ workerId: worker._id }).select("shiftId").exec();
      return assignments.map((assignment) => assignment.shiftId);
    }
    const facility = await this.resolveCurrentFacility(currentUser);
    const shifts = await this.shifts.find({ facilityId: facility._id }).select("_id").exec();
    return shifts.map((shift) => shift._id);
  }

  private async canAccessDispute(currentUser: AuthUser, dispute: DisputeDocument) {
    if (dispute.openedBy.toString() === currentUser.sub) return true;
    if (dispute.participantUserIds?.some((userId) => userId.toString() === currentUser.sub)) return true;
    if (!dispute.shiftId) return false;
    const shiftIds = await this.resolveMarketplaceShiftIds(currentUser);
    return Boolean(shiftIds?.some((shiftId) => shiftId.equals(dispute.shiftId)));
  }

  private async notifyDisputeParties(currentUser: AuthUser, dispute: DisputeDocument) {
    if (!dispute.shiftId) return;
    const shift = await this.findShift(dispute.shiftId.toString());
    const facility = await this.facilities.findById(shift.facilityId).exec();
    if (facility?.userId && facility.userId.toString() !== currentUser.sub) {
      await this.notify(facility.userId, NotificationType.MarketplaceDispute, "New dispute opened", dispute.reason, "/facility/marketplace", {
        disputeId: dispute.id,
        shiftId: shift.id
      });
    }
  }

  private async resolveDisputeContext(currentUser: AuthUser, dto: CreateDisputeDto) {
    let shiftId = dto.shiftId;
    let assignment: ShiftAssignmentDocument | null = null;
    if (dto.assignmentId) {
      assignment = await this.assignments.findById(this.toObjectId(dto.assignmentId, "Assignment not found")).exec();
      if (!assignment) throw new NotFoundException("Assignment not found");
      shiftId = assignment.shiftId.toString();
    }
    if (dto.timesheetId) {
      const timesheet = await this.findTimesheet(dto.timesheetId);
      shiftId = timesheet.shiftId.toString();
      assignment ??= await this.assignments.findOne({ shiftId: timesheet.shiftId, workerId: timesheet.workerId }).exec();
    }
    if (!shiftId) throw new BadRequestException("A shift could not be resolved for this dispute");
    const shift = await this.findShiftForParticipant(currentUser, shiftId);
    if (currentUser.role === UserRole.Worker) {
      const worker = await this.resolveCurrentWorker(currentUser);
      assignment ??= await this.assignments.findOne({ shiftId: shift._id, workerId: worker._id }).exec();
      if (!assignment) throw new ForbiddenException("Only assigned workers can dispute this shift");
    }
    const participantUserIds = [new Types.ObjectId(currentUser.sub)];
    const facility = await this.facilities.findById(shift.facilityId).exec();
    if (facility?.userId && !participantUserIds.some((id) => id.equals(facility.userId))) participantUserIds.push(facility.userId);
    if (assignment) {
      const worker = await this.workers.findById(assignment.workerId).exec();
      if (worker?.userId && !participantUserIds.some((id) => id.equals(worker.userId))) participantUserIds.push(worker.userId);
    }
    return { assignment, participantUserIds, shift };
  }

  private async recomputeShiftStatus(shift: ShiftDocument) {
    const activeAssignments = await this.assignments.find({ shiftId: shift._id, status: { $nin: [ShiftAssignmentStatus.Cancelled, ShiftAssignmentStatus.NoShow] } }).exec();
    const timesheets = await this.timesheets.find({ shiftId: shift._id }).exec();
    shift.activeAssignmentCount = activeAssignments.length;
    if (activeAssignments.some((assignment) => assignment.status === ShiftAssignmentStatus.InProgress)) shift.status = ShiftStatus.InProgress;
    else if (activeAssignments.length && activeAssignments.every((assignment) => assignment.status === ShiftAssignmentStatus.Completed)) {
      const relevantTimesheets = timesheets.filter((timesheet) => activeAssignments.some((assignment) => assignment.workerId.equals(timesheet.workerId)));
      if (relevantTimesheets.length === activeAssignments.length && relevantTimesheets.every((timesheet) => timesheet.status === TimesheetStatus.Approved)) shift.status = ShiftStatus.Completed;
      else if (relevantTimesheets.length === activeAssignments.length) shift.status = ShiftStatus.TimesheetSubmitted;
    } else if (activeAssignments.length >= (shift.caregiversRequired ?? 1)) shift.status = ShiftStatus.Assigned;
    else if (!new Set<ShiftStatus>([ShiftStatus.Cancelled, ShiftStatus.Expired, ShiftStatus.Disputed]).has(shift.status)) shift.status = ShiftStatus.Open;
    await shift.save();
  }

  private async notify(userId: Types.ObjectId | string, type: NotificationType, title: string, body: string, href: string, metadata: Record<string, string>) {
    await this.notificationService.createInAppNotification({ userId, type, title, body, href, metadata });
  }

  private async buildTimesheetFilter(currentUser: AuthUser) {
    if (currentUser.role === UserRole.Admin) return {};
    if (currentUser.role === UserRole.Worker) {
      const worker = await this.resolveCurrentWorker(currentUser);
      return { workerId: worker._id };
    }
    const facility = await this.resolveCurrentFacility(currentUser);
    const shifts = await this.shifts.find({ facilityId: facility._id }).select("_id").exec();
    return { shiftId: { $in: shifts.map((shift) => shift._id) } };
  }

  private async resolveCurrentWorker(currentUser: AuthUser) {
    if (currentUser.role !== UserRole.Worker) throw new ForbiddenException("Worker account required");
    const worker = await this.workers.findOne({ userId: currentUser.sub }).exec();
    if (!worker) throw new NotFoundException("Worker profile not found");
    return worker;
  }

  private async resolveCurrentFacility(currentUser: AuthUser) {
    if (currentUser.role !== UserRole.Facility) throw new ForbiddenException("Facility account required");
    const facility = await this.facilities.findOne({ userId: currentUser.sub }).exec();
    if (!facility) throw new NotFoundException("Facility profile not found");
    return facility;
  }

  private async findShiftForFacility(currentUser: AuthUser, shiftId: string) {
    const shift = await this.findShift(shiftId);
    if (currentUser.role === UserRole.Admin) return shift;
    const facility = await this.resolveCurrentFacility(currentUser);
    if (!shift.facilityId.equals(facility._id)) throw new ForbiddenException("You can only manage your facility shifts");
    return shift;
  }

  private async findShiftForParticipant(currentUser: AuthUser, shiftId: string) {
    if (currentUser.role === UserRole.Worker) return this.findShift(shiftId);
    return this.findShiftForFacility(currentUser, shiftId);
  }

  private async findShift(shiftId: string) {
    const shift = await this.shifts.findById(this.toObjectId(shiftId, "Shift not found")).exec();
    if (!shift) throw new NotFoundException("Shift not found");
    return shift;
  }

  private async findWorker(workerId: string) {
    const worker = await this.workers.findById(this.toObjectId(workerId, "Worker not found")).exec();
    if (!worker) throw new NotFoundException("Worker not found");
    return worker;
  }

  private async findApplication(id: string) {
    const application = await this.applications.findById(this.toObjectId(id, "Application not found")).exec();
    if (!application) throw new NotFoundException("Application not found");
    return application;
  }

  private async findInvitation(id: string) {
    const invitation = await this.invitations.findById(this.toObjectId(id, "Invitation not found")).exec();
    if (!invitation) throw new NotFoundException("Invitation not found");
    return invitation;
  }

  private async findTimesheet(id: string) {
    const timesheet = await this.timesheets.findById(this.toObjectId(id, "Timesheet not found")).exec();
    if (!timesheet) throw new NotFoundException("Timesheet not found");
    return timesheet;
  }

  private toObjectId(id: string, message: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException(message);
    return new Types.ObjectId(id);
  }

  private async audit(currentUser: AuthUser, action: string, entityType?: string, entityId?: string, metadata: Record<string, string> = {}) {
    await this.auditEvents.create({
      actorUserId: new Types.ObjectId(currentUser.sub),
      action,
      entityType,
      entityId,
      metadata
    });
  }

  private serialize<T extends { id?: string; _id?: Types.ObjectId; toObject: (options?: unknown) => Record<string, unknown> }>(document: T) {
    const object = document.toObject({ versionKey: false });
    return { ...object, id: document.id ?? document._id?.toString(), _id: undefined };
  }
}

function attendanceVerification(actual?: [number, number], expected?: [number, number]) {
  if (!actual || !expected) return { status: "MISSING" as const };
  const distanceMeters = haversineMeters(actual, expected);
  return {
    status: distanceMeters <= 500 ? ("VERIFIED" as const) : ("OUTSIDE_GEOFENCE" as const),
    distanceMeters: Math.round(distanceMeters)
  };
}

function haversineMeters([longitudeA, latitudeA]: [number, number], [longitudeB, latitudeB]: [number, number]) {
  const radius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);
  const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB)) * Math.sin(deltaLongitude / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isTransactionUnsupported(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: number; message?: string };
  return candidate.code === 20 || candidate.message?.includes("Transaction numbers are only allowed") === true;
}

function isDuplicateKeyError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
