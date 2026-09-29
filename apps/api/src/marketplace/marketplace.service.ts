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
    const applications = await this.applications.find({ shiftId: this.toObjectId(shiftId, "Shift not found") }).sort({ createdAt: -1 }).exec();
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
    await this.findShiftForFacility(currentUser, application.shiftId.toString());
    application.status = dto.status;
    application.matchScore = dto.matchScore ?? application.matchScore;
    application.reviewedAt = new Date();
    if (dto.status === ShiftApplicationStatus.Selected || dto.status === ShiftApplicationStatus.Confirmed) {
      application.selectedAt = application.selectedAt ?? new Date();
    }
    const saved = await application.save();
    if (dto.status === ShiftApplicationStatus.Selected || dto.status === ShiftApplicationStatus.Confirmed) {
      await this.createAssignment(currentUser, application.shiftId, application.workerId, { applicationId: application._id });
    }
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
    const invitations = await this.invitations.find({ shiftId: this.toObjectId(shiftId, "Shift not found") }).sort({ createdAt: -1 }).exec();
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
    } else {
      await this.findShiftForFacility(currentUser, invitation.shiftId.toString());
    }
    invitation.status = dto.status;
    invitation.respondedAt = new Date();
    const saved = await invitation.save();
    if (dto.status === ShiftInvitationStatus.Accepted) {
      await this.createAssignment(currentUser, invitation.shiftId, invitation.workerId, { invitationId: invitation._id });
    }
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
    const assignment = await this.createAssignment(currentUser, shift._id, worker._id, {
      applicationId: dto.applicationId ? new Types.ObjectId(dto.applicationId) : undefined,
      invitationId: dto.invitationId ? new Types.ObjectId(dto.invitationId) : undefined
    });
    return this.serialize(assignment);
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
    const event = await this.attendanceEvents.findOneAndUpdate(
      { idempotencyKey: dto.idempotencyKey },
      {
        shiftId: new Types.ObjectId(dto.shiftId),
        workerId: worker._id,
        eventType,
        occurredAt: dto.occurredAt,
        location: dto.location,
        notes: dto.notes
      },
      { new: true, upsert: true }
    ).exec();
    if (eventType === AttendanceEventType.ClockIn) assignment.status = ShiftAssignmentStatus.InProgress;
    if (eventType === AttendanceEventType.ClockOut) assignment.status = ShiftAssignmentStatus.Completed;
    await assignment.save();
    if (eventType === AttendanceEventType.ClockIn) {
      shift.status = ShiftStatus.InProgress;
      await shift.save();
    }
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
    const clockOut = await this.attendanceEvents.findOne({ shiftId: shift._id, workerId: worker._id, eventType: AttendanceEventType.ClockOut }).exec();
    if (!clockOut && (!dto.actualStartTime || !dto.actualEndTime)) {
      throw new BadRequestException("Clock out or manual actual times are required before submitting a timesheet");
    }
    const actualStartTime = dto.actualStartTime ?? (await this.findFirstAttendanceTime(worker._id, shift._id, AttendanceEventType.ClockIn)) ?? shift.startTime;
    const actualEndTime = dto.actualEndTime ?? clockOut?.occurredAt ?? shift.endTime;
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
    return this.serialize(timesheet);
  }

  async updateTimesheet(currentUser: AuthUser, id: string, dto: UpdateTimesheetDto) {
    const timesheet = await this.findTimesheet(id);
    if (currentUser.role !== UserRole.Admin) {
      await this.findShiftForFacility(currentUser, timesheet.shiftId.toString());
    }
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
    return this.serialize(saved);
  }

  async createDispute(currentUser: AuthUser, dto: CreateDisputeDto) {
    const dispute = await this.disputes.create({
      shiftId: dto.shiftId ? new Types.ObjectId(dto.shiftId) : undefined,
      timesheetId: dto.timesheetId ? new Types.ObjectId(dto.timesheetId) : undefined,
      reviewId: dto.reviewId ? new Types.ObjectId(dto.reviewId) : undefined,
      openedBy: new Types.ObjectId(currentUser.sub),
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
    const existing = await this.assignments.findOne({ shiftId, workerId }).exec();
    if (!existing) {
      const assignmentCount = await this.assignments.countDocuments({ shiftId, status: { $in: [ShiftAssignmentStatus.Confirmed, ShiftAssignmentStatus.InProgress] } });
      if (assignmentCount >= (shift.caregiversRequired ?? 1)) {
        throw new BadRequestException("Shift staffing requirement is already filled");
      }
    }
    const assignment = await this.assignments.findOneAndUpdate(
      { shiftId, workerId },
      {
        applicationId: links.applicationId,
        invitationId: links.invitationId,
        status: ShiftAssignmentStatus.Confirmed,
        confirmedAt: new Date()
      },
      { new: true, upsert: true }
    ).exec();
    const assignmentCount = await this.assignments.countDocuments({ shiftId, status: { $in: [ShiftAssignmentStatus.Confirmed, ShiftAssignmentStatus.InProgress] } });
    if (assignmentCount >= (shift.caregiversRequired ?? 1)) {
      shift.status = ShiftStatus.Assigned;
      shift.matchedWorkerId = shift.matchedWorkerId ?? workerId;
      shift.filledAt = shift.filledAt ?? new Date();
      await shift.save();
    }
    if (worker?.userId) {
      await this.notify(worker.userId, NotificationType.MarketplaceAssignment, "Shift assignment confirmed", `You are confirmed for ${shift.title ?? shift.roleRequired} coverage.`, "/worker/marketplace", {
        assignmentId: assignment.id,
        shiftId: shift.id
      });
    }
    await this.audit(currentUser, "shift.assignment.created", "ShiftAssignment", assignment.id);
    return assignment;
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
