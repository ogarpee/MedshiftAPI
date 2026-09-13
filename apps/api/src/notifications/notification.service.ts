import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  ClinicalRole,
  FacilityType,
  NotificationSummary,
  NotificationType,
  OnboardingStatus,
  UserRole,
  WaitlistAvailability,
  WaitlistProfessionalRole
} from "@medshift/shared-types";
import { Notification, NotificationDocument } from "../database/schemas/notification.schema";
import { WorkerProfile, WorkerProfileDocument } from "../database/schemas/worker-profile.schema";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

type EmailTemplateOptions = {
  action?: {
    href: string;
    label: string;
  };
  body: string[];
  code?: string;
  eyebrow: string;
  footerNote?: string;
  title: string;
};

export type EmailDeliveryResult = {
  delivered: boolean;
  provider: "console" | "resend";
};

type ContactSyncResult = {
  provider: "console" | "resend";
  synced: boolean;
};

type ShiftEmailPayload = {
  workerEmail?: string;
  facilityEmail?: string;
  roleRequired: ClinicalRole;
  startTime: Date | string;
  endTime: Date | string;
  facilityName?: string;
};

type VerificationEmailPayload = {
  email: string;
  role: UserRole;
  verificationUrl: string;
  expiresInHours: number;
};

type PasswordResetEmailPayload = {
  email: string;
  otp: string;
  expiresInMinutes: number;
};

type RegistrationOtpEmailPayload = {
  email: string;
  otp: string;
  expiresInMinutes: number;
};

type OnboardingReviewEmailPayload = {
  approved: boolean;
  email: string;
  rejectedReason?: string;
  role: UserRole;
};

type WaitlistContactPayload = {
  email: string;
  facilityDetails?: {
    city?: string;
    facilityName?: string;
    facilityType?: FacilityType;
    phone?: string;
    province?: string;
  };
  role: UserRole;
  workerDetails?: {
    availability?: WaitlistAvailability;
    city?: string;
    clinicalRole?: WaitlistProfessionalRole;
    fullName?: string;
    phone?: string;
  };
};

type ResendContactPayload = {
  email: string;
  firstName?: string;
  lastName?: string;
  properties?: Record<string, string>;
  segmentIds: string[];
  legacyAudienceIds: string[];
};

type InAppNotificationPayload = {
  body: string;
  href?: string;
  metadata?: Record<string, string>;
  title: string;
  type: NotificationType;
  userId: string | Types.ObjectId;
};

type MatchingShiftNotificationPayload = {
  facilityName?: string;
  hourlyRate: number;
  location: {
    coordinates: [number, number];
    type: "Point";
  };
  roleRequired: ClinicalRole;
  shiftId: string;
  startTime: Date | string;
};

type ReviewAvailableNotificationPayload = {
  facilityUserId?: string | Types.ObjectId;
  roleRequired: ClinicalRole;
  shiftId: string;
  startTime: Date | string;
  workerUserId?: string | Types.ObjectId;
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectModel(Notification.name) private readonly notifications: Model<NotificationDocument>,
    @InjectModel(WorkerProfile.name) private readonly workerProfiles: Model<WorkerProfileDocument>
  ) {}

  async listForUser(userId: string, limit = 20) {
    const requestedLimit = Number.isFinite(limit) ? limit : 20;
    const safeLimit = Math.min(Math.max(requestedLimit, 1), 50);
    const userObjectId = this.toObjectId(userId);
    const [items, unreadCount] = await Promise.all([
      this.notifications.find({ userId: userObjectId }).sort({ createdAt: -1 }).limit(safeLimit).exec(),
      this.notifications.countDocuments({ userId: userObjectId, readAt: null }).exec()
    ]);

    return {
      items: items.map((notification) => this.serializeNotification(notification)),
      unreadCount
    };
  }

  async markRead(userId: string, notificationId: string) {
    if (!Types.ObjectId.isValid(notificationId)) {
      throw new NotFoundException("Notification not found");
    }

    const notification = await this.notifications
      .findOneAndUpdate(
        { _id: notificationId, userId: this.toObjectId(userId) },
        { $set: { readAt: new Date() } },
        { new: true }
      )
      .exec();

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    return this.serializeNotification(notification);
  }

  async markAllRead(userId: string) {
    const result = await this.notifications
      .updateMany({ userId: this.toObjectId(userId), readAt: null }, { $set: { readAt: new Date() } })
      .exec();

    return { updated: result.modifiedCount };
  }

  async createInAppNotification(payload: InAppNotificationPayload) {
    const notification = await this.notifications.create({
      body: payload.body,
      href: payload.href,
      metadata: payload.metadata,
      title: payload.title,
      type: payload.type,
      userId: this.toObjectId(payload.userId)
    });

    return this.serializeNotification(notification);
  }

  async notifyMatchingWorkersForShift(payload: MatchingShiftNotificationPayload) {
    const matchingWorkers = await this.findMatchingWorkersForShift(payload);

    if (!matchingWorkers.length) {
      return [];
    }

    return Promise.all(
      matchingWorkers.map((worker) =>
        this.createInAppNotification({
          body: `${payload.facilityName ?? "A facility"} posted a ${payload.roleRequired} shift for ${this.formatDate(payload.startTime)} at $${payload.hourlyRate}/hr.`,
          href: "/worker",
          metadata: { shiftId: payload.shiftId, roleRequired: payload.roleRequired },
          title: "New nearby shift posted",
          type: NotificationType.ShiftCreated,
          userId: worker.userId
        })
      )
    );
  }

  async findMatchingWorkerUserIdsForShift(payload: MatchingShiftNotificationPayload) {
    const workers = await this.findMatchingWorkersForShift(payload);

    return workers.map((worker) => worker.userId.toString());
  }

  private async findMatchingWorkersForShift(payload: MatchingShiftNotificationPayload) {
    const workers = await this.workerProfiles
      .find({
        "onboarding.verificationStatus": OnboardingStatus.Approved,
        title: payload.roleRequired
      })
      .exec();
    const [shiftLongitude, shiftLatitude] = payload.location.coordinates;

    return workers.filter((worker) => {
      const [workerLongitude, workerLatitude] = worker.location.coordinates;
      const distanceKm = calculateDistanceKm(workerLatitude, workerLongitude, shiftLatitude, shiftLongitude);
      const maxDistanceKm = worker.preferences?.maxDistanceKm ?? 25;

      return distanceKm <= maxDistanceKm;
    });
  }

  async notifyShiftAccepted(payload: {
    facilityName?: string;
    facilityUserId?: string | Types.ObjectId;
    roleRequired: ClinicalRole;
    shiftId: string;
    startTime: Date | string;
    workerUserId?: string | Types.ObjectId;
  }) {
    const notifications: Array<Promise<NotificationSummary>> = [];
    const formattedStart = this.formatDate(payload.startTime);

    if (payload.facilityUserId) {
      notifications.push(
        this.createInAppNotification({
          body: `A worker accepted your ${payload.roleRequired} shift for ${formattedStart}.`,
          href: "/facility",
          metadata: { shiftId: payload.shiftId, roleRequired: payload.roleRequired },
          title: "Worker accepted a shift",
          type: NotificationType.ShiftAccepted,
          userId: payload.facilityUserId
        })
      );
    }

    if (payload.workerUserId) {
      notifications.push(
        this.createInAppNotification({
          body: `Your ${payload.roleRequired} shift at ${payload.facilityName ?? "the facility"} is confirmed for ${formattedStart}.`,
          href: "/worker",
          metadata: { shiftId: payload.shiftId, roleRequired: payload.roleRequired },
          title: "Shift confirmed",
          type: NotificationType.ShiftAccepted,
          userId: payload.workerUserId
        })
      );
    }

    return Promise.all(notifications);
  }

  async notifyOnboardingReviewResult(payload: {
    approved: boolean;
    rejectedReason?: string;
    role: UserRole;
    userId: string | Types.ObjectId;
  }) {
    const roleLabel = payload.role === UserRole.Worker ? "worker" : "facility";
    const approvedHref = payload.role === UserRole.Worker ? "/worker" : "/facility";
    const rejectedHref = payload.role === UserRole.Worker ? "/worker/settings" : "/facility/onboarding";

    return this.createInAppNotification({
      body: payload.approved
        ? `Your MedShift ${roleLabel} onboarding is approved. Live workflows are unlocked.`
        : `Your MedShift ${roleLabel} onboarding needs updates.${payload.rejectedReason ? ` ${payload.rejectedReason}` : ""}`,
      href: payload.approved ? approvedHref : rejectedHref,
      metadata: { role: payload.role },
      title: payload.approved ? "Onboarding approved" : "Onboarding needs updates",
      type: payload.approved ? NotificationType.OnboardingApproved : NotificationType.OnboardingRejected,
      userId: payload.userId
    });
  }

  async notifyReviewAvailable(payload: ReviewAvailableNotificationPayload) {
    const notifications: Array<Promise<NotificationSummary>> = [];
    const formattedStart = this.formatDate(payload.startTime);

    if (payload.workerUserId) {
      notifications.push(
        this.createInAppNotification({
          body: `Your completed ${payload.roleRequired} shift from ${formattedStart} is ready for facility feedback.`,
          href: "/worker",
          metadata: { shiftId: payload.shiftId, roleRequired: payload.roleRequired },
          title: "Facility review available",
          type: NotificationType.ReviewAvailable,
          userId: payload.workerUserId
        })
      );
    }

    if (payload.facilityUserId) {
      notifications.push(
        this.createInAppNotification({
          body: `Your completed ${payload.roleRequired} shift from ${formattedStart} is ready for worker feedback.`,
          href: "/facility",
          metadata: { shiftId: payload.shiftId, roleRequired: payload.roleRequired },
          title: "Worker review available",
          type: NotificationType.ReviewAvailable,
          userId: payload.facilityUserId
        })
      );
    }

    return Promise.all(notifications);
  }

  async sendWelcomeEmail(email: string, role: UserRole) {
    const audience = role === UserRole.Worker ? "healthcare professional" : "facility partner";
    const nextStep =
      role === UserRole.Worker
        ? "Complete your worker profile and upload your credentials so MedShift can verify you for live shifts."
        : "Complete your facility profile so MedShift can review your registration before live shift posting is enabled.";

    await this.sendEmail({
      to: email,
      subject: "Welcome to MedShift",
      text: `Welcome to MedShift. Your ${audience} account is ready. ${nextStep}`,
      html: this.renderEmailTemplate({
        eyebrow: "Welcome to MedShift",
        title: "Your account is ready",
        body: [
          `Welcome to MedShift. Your ${audience} account has been created.`,
          nextStep
        ],
        footerNote: "MedShift keeps healthcare coverage moving with verified profiles, clear workflows, and timely notifications."
      })
    });
  }

  async sendEmailVerification(payload: VerificationEmailPayload) {
    const audience = payload.role === UserRole.Worker ? "healthcare professional" : "facility partner";

    await this.sendEmail({
      to: payload.email,
      subject: "Verify your MedShift email",
      text: `Verify your MedShift ${audience} account: ${payload.verificationUrl}. This link expires in ${payload.expiresInHours} hours.`,
      html: this.renderEmailTemplate({
        action: {
          href: payload.verificationUrl,
          label: "Verify email address"
        },
        eyebrow: "Email verification",
        title: "Confirm your MedShift email",
        body: [
          `Verify your ${audience} account to continue setting up MedShift.`,
          `This secure verification link expires in ${payload.expiresInHours} hours.`
        ],
        footerNote: "If the button does not work, copy and paste the verification link from this email into your browser."
      })
    });
  }

  async sendPasswordReset(payload: PasswordResetEmailPayload) {
    await this.sendEmail({
      to: payload.email,
      subject: "Your MedShift password reset code",
      text: `Your MedShift password reset code is ${payload.otp}. This code expires in ${payload.expiresInMinutes} minutes.`,
      html: this.renderEmailTemplate({
        eyebrow: "Password reset",
        title: "Use this code to reset your password",
        body: [
          "Enter the code below on the MedShift password reset page.",
          `This code expires in ${payload.expiresInMinutes} minutes. If you did not request it, you can ignore this email.`
        ],
        code: payload.otp,
        footerNote: "For your security, MedShift will never ask you to share this code outside the reset flow."
      })
    });
  }

  async sendRegistrationOtp(payload: RegistrationOtpEmailPayload) {
    await this.sendEmail({
      to: payload.email,
      subject: "Your MedShift registration code",
      text: `Your MedShift registration code is ${payload.otp}. This code expires in ${payload.expiresInMinutes} minutes.`,
      html: this.renderEmailTemplate({
        eyebrow: "Registration code",
        title: "Verify your email to continue",
        body: [
          "Enter this code in MedShift to verify your email and finish creating your account.",
          `This code expires in ${payload.expiresInMinutes} minutes.`
        ],
        code: payload.otp,
        footerNote: "If you did not start a MedShift registration, you can safely ignore this message."
      })
    });
  }

  async sendOnboardingReviewResult(payload: OnboardingReviewEmailPayload) {
    const audience = payload.role === UserRole.Worker ? "worker" : "facility";
    const destination = payload.role === UserRole.Worker ? "worker shift board" : "facility roster";
    const subject = payload.approved ? "MedShift onboarding approved" : "MedShift onboarding needs updates";
    const rejectedReason = payload.rejectedReason ? ` Reason: ${payload.rejectedReason}` : "";
    const text = payload.approved
      ? `Your MedShift ${audience} onboarding is approved. You can now access the live ${destination}.`
      : `Your MedShift ${audience} onboarding needs updates before approval.${rejectedReason}`;
    const html = this.renderEmailTemplate({
      eyebrow: payload.approved ? "Onboarding approved" : "Onboarding update needed",
      title: payload.approved ? "Your MedShift onboarding is approved" : "Your MedShift onboarding needs updates",
      body: payload.approved
        ? [
            `Your MedShift ${audience} onboarding has been approved.`,
            `You can now access the live ${destination}.`
          ]
        : [
            `Your MedShift ${audience} onboarding needs updates before approval.`,
            payload.rejectedReason ? `Review note: ${payload.rejectedReason}` : "Please review your onboarding details and submit the requested updates."
          ],
      footerNote: payload.approved
        ? "Thank you for helping MedShift keep healthcare coverage reliable."
        : "Once your updates are submitted, the MedShift team will review your profile again."
    });

    await this.sendEmail({
      to: payload.email,
      subject,
      text,
      html
    });
  }

  async sendWaitlistWelcome(email: string, role: UserRole): Promise<EmailDeliveryResult> {
    const audience = role === UserRole.Worker ? "worker" : "facility";

    return this.sendEmail({
      to: email,
      subject: "You're on the MedShift early access list",
      text: `Thanks for joining MedShift early access as a ${audience}. We'll send launch updates soon.`,
      html: this.renderEmailTemplate({
        eyebrow: "Early access confirmed",
        title: "You're on the MedShift waitlist",
        body: [
          `Thanks for joining MedShift early access as a ${audience}.`,
          "We will send launch updates, onboarding next steps, and availability details as MedShift opens access in your region."
        ],
        footerNote: "You are receiving this because your email was submitted on the MedShift waitlist."
      })
    });
  }

  async syncWaitlistContact(payload: WaitlistContactPayload): Promise<ContactSyncResult> {
    const role = payload.role === UserRole.Worker ? "worker" : "facility";
    const nameParts = splitName(payload.workerDetails?.fullName);
    const properties: Record<string, string> = {
      medshift_role: payload.role,
      medshift_contact_stage: "WAITLIST",
      medshift_source: "PUBLIC_WAITLIST"
    };

    if (payload.workerDetails) {
      addProperty(properties, "medshift_full_name", payload.workerDetails.fullName);
      addProperty(properties, "medshift_phone", payload.workerDetails.phone);
      addProperty(properties, "medshift_city", payload.workerDetails.city);
      addProperty(properties, "medshift_professional_role", payload.workerDetails.clinicalRole);
      addProperty(properties, "medshift_availability", payload.workerDetails.availability);
    }

    if (payload.facilityDetails) {
      addProperty(properties, "medshift_facility_name", payload.facilityDetails.facilityName);
      addProperty(properties, "medshift_phone", payload.facilityDetails.phone);
      addProperty(properties, "medshift_city", payload.facilityDetails.city);
      addProperty(properties, "medshift_province", payload.facilityDetails.province);
      addProperty(properties, "medshift_facility_type", payload.facilityDetails.facilityType);
    }

    return this.syncResendContact({
      email: payload.email,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      properties,
      segmentIds: this.getConfiguredIds(["RESEND_WAITLIST_SEGMENT_ID", role === "worker" ? "RESEND_WORKER_SEGMENT_ID" : "RESEND_FACILITY_SEGMENT_ID"]),
      legacyAudienceIds: this.getConfiguredIds(["RESEND_WAITLIST_AUDIENCE_ID"])
    });
  }

  async syncRegisteredContact(email: string, role: UserRole): Promise<ContactSyncResult> {
    return this.syncResendContact({
      email,
      properties: {
        medshift_role: role,
        medshift_contact_stage: "REGISTERED",
        medshift_source: "ACCOUNT_REGISTRATION"
      },
      segmentIds: this.getConfiguredIds([
        "RESEND_GENERAL_SEGMENT_ID",
        role === UserRole.Worker ? "RESEND_WORKER_SEGMENT_ID" : "RESEND_FACILITY_SEGMENT_ID"
      ]),
      legacyAudienceIds: this.getConfiguredIds([
        "RESEND_GENERAL_AUDIENCE_ID",
        role === UserRole.Worker ? "RESEND_WORKER_AUDIENCE_ID" : "RESEND_FACILITY_AUDIENCE_ID"
      ])
    });
  }

  async sendShiftConfirmation(payload: ShiftEmailPayload) {
    const window = `${this.formatDate(payload.startTime)} - ${this.formatDate(payload.endTime)}`;
    const facilityName = payload.facilityName ?? "your facility";

    await Promise.all([
      payload.workerEmail
        ? this.sendEmail({
            to: payload.workerEmail,
            subject: "Shift confirmed",
            text: `Your ${payload.roleRequired} shift at ${facilityName} is confirmed for ${window}.`,
            html: this.renderEmailTemplate({
              eyebrow: "Shift confirmed",
              title: "Your shift is confirmed",
              body: [
                `Your ${payload.roleRequired} shift at ${facilityName} is confirmed.`,
                `Shift window: ${window}`
              ],
              footerNote: "Please review the shift details in your MedShift dashboard before arrival."
            })
          })
        : Promise.resolve(),
      payload.facilityEmail
        ? this.sendEmail({
            to: payload.facilityEmail,
            subject: "Worker matched for your shift",
            text: `A worker accepted your ${payload.roleRequired} shift for ${window}.`,
            html: this.renderEmailTemplate({
              eyebrow: "Worker matched",
              title: "Your shift has an accepted worker",
              body: [
                `A worker accepted your ${payload.roleRequired} shift.`,
                `Shift window: ${window}`
              ],
              footerNote: "Open your MedShift facility dashboard to review the matched worker and shift status."
            })
          })
        : Promise.resolve()
    ]);
  }

  private async sendEmail(payload: EmailPayload): Promise<EmailDeliveryResult> {
    const apiKey = this.config.get<string>("RESEND_API_KEY")?.trim();

    if (!apiKey) {
      this.logger.warn(
        `Email not sent to ${payload.to}: RESEND_API_KEY is not configured. Configure it in development and production to send real email.`
      );
      return { delivered: false, provider: "console" };
    }

    let response: Response;

    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: this.config.get<string>("RESEND_FROM_EMAIL", "MedShift <onboarding@resend.dev>"),
          to: payload.to,
          subject: payload.subject,
          html: payload.html,
          text: payload.text
        })
      });
    } catch (error) {
      this.logger.warn(`Resend email request failed for ${payload.to}: ${error instanceof Error ? error.message : "unknown error"}`);
      return { delivered: false, provider: "resend" };
    }

    if (!response.ok) {
      this.logger.warn(`Resend email failed for ${payload.to}: ${response.status}`);
      return { delivered: false, provider: "resend" };
    }

    this.logger.log(`Email sent to ${payload.to} through Resend: ${payload.subject}`);
    return { delivered: true, provider: "resend" };
  }

  private async syncResendContact(payload: ResendContactPayload): Promise<ContactSyncResult> {
    const apiKey = this.config.get<string>("RESEND_API_KEY")?.trim();

    if (!apiKey) {
      this.logger.warn(`Resend contact not synced for ${payload.email}: RESEND_API_KEY is not configured.`);
      return { provider: "console", synced: false };
    }

    if (payload.segmentIds.length === 0 && payload.legacyAudienceIds.length === 0) {
      this.logger.warn(`Resend contact not synced for ${payload.email}: no campaign segment or audience IDs are configured.`);
      return { provider: "resend", synced: false };
    }

    const contactSynced = await this.createOrUpdateResendContact(apiKey, payload);
    const segmentResults = await Promise.all(
      payload.segmentIds.map((segmentId) => this.addResendContactToSegment(apiKey, payload.email, segmentId))
    );
    const audienceResults = await Promise.all(
      payload.legacyAudienceIds.map((audienceId) => this.createOrUpdateLegacyAudienceContact(apiKey, audienceId, payload))
    );
    const synced = contactSynced && segmentResults.every(Boolean) && audienceResults.every(Boolean);

    if (synced) {
      this.logger.log(`Resend contact synced for ${payload.email}`);
    }

    return { provider: "resend", synced };
  }

  private async createOrUpdateResendContact(apiKey: string, payload: ResendContactPayload) {
    const createBody = removeUndefinedValues({
      email: payload.email,
      first_name: payload.firstName,
      last_name: payload.lastName,
      properties: this.shouldSyncContactProperties() ? payload.properties : undefined,
      segments: payload.segmentIds.length > 0 ? payload.segmentIds.map((id) => ({ id })) : undefined,
      unsubscribed: false
    });
    const createResponse = await this.fetchResend(apiKey, "/contacts", {
      method: "POST",
      body: createBody
    });

    if (createResponse.ok) {
      return true;
    }

    const updateBody = removeUndefinedValues({
      first_name: payload.firstName,
      last_name: payload.lastName,
      properties: this.shouldSyncContactProperties() ? payload.properties : undefined,
      unsubscribed: false
    });
    const updateResponse = await this.fetchResend(apiKey, `/contacts/${encodeURIComponent(payload.email)}`, {
      method: "PATCH",
      body: updateBody
    });

    if (updateResponse.ok) {
      return true;
    }

    this.logger.warn(
      `Resend contact upsert failed for ${payload.email}: ${createResponse.status} ${createResponse.bodyText}/${updateResponse.status} ${updateResponse.bodyText}`
    );
    return false;
  }

  private async addResendContactToSegment(apiKey: string, email: string, segmentId: string) {
    const response = await this.fetchResend(apiKey, `/contacts/${encodeURIComponent(email)}/segments/${encodeURIComponent(segmentId)}`, {
      method: "POST"
    });

    if (response.ok || response.status === 409) {
      return true;
    }

    this.logger.warn(`Resend segment sync failed for ${email} into ${segmentId}: ${response.status} ${response.bodyText}`);
    return false;
  }

  private async createOrUpdateLegacyAudienceContact(apiKey: string, audienceId: string, payload: ResendContactPayload) {
    const body = removeUndefinedValues({
      email: payload.email,
      first_name: payload.firstName,
      last_name: payload.lastName,
      properties: this.shouldSyncContactProperties() ? payload.properties : undefined,
      unsubscribed: false
    });
    const response = await this.fetchResend(apiKey, `/audiences/${encodeURIComponent(audienceId)}/contacts`, {
      method: "POST",
      body
    });

    if (response.ok || response.status === 409) {
      return true;
    }

    this.logger.warn(`Resend legacy audience sync failed for ${payload.email} into ${audienceId}: ${response.status} ${response.bodyText}`);
    return false;
  }

  private async fetchResend(apiKey: string, path: string, options: { body?: Record<string, unknown>; method: "PATCH" | "POST" }) {
    try {
      const response = await fetch(`https://api.resend.com${path}`, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      const bodyText = response.ok ? "" : await response.text().catch(() => "");

      return {
        bodyText,
        ok: response.ok,
        status: response.status
      };
    } catch (error) {
      this.logger.warn(`Resend request failed for ${path}: ${error instanceof Error ? error.message : "unknown error"}`);
      return { bodyText: "", ok: false, status: 0 };
    }
  }

  private getConfiguredIds(keys: string[]) {
    return keys
      .map((key) => this.config.get<string>(key)?.trim())
      .filter((value): value is string => Boolean(value));
  }

  private shouldSyncContactProperties() {
    const value = this.config.get<string>("RESEND_SYNC_CONTACT_PROPERTIES")?.toLowerCase();

    return value === "true" || value === "1" || value === "yes";
  }

  private renderEmailTemplate(options: EmailTemplateOptions) {
    const body = options.body
      .map(
        (paragraph) =>
          `<p style="margin:0 0 16px;color:#4b5563;font-size:16px;line-height:1.65;">${this.escapeHtml(paragraph)}</p>`
      )
      .join("");
    const code = options.code
      ? `<div style="margin:24px 0;padding:18px 20px;border:1px solid #ead99b;border-radius:8px;background:#fff8df;text-align:center;">
          <div style="color:#6b7280;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Your code</div>
          <div style="margin-top:8px;color:#0b1f3a;font-family:Georgia,serif;font-size:34px;font-weight:700;letter-spacing:0.18em;">${this.escapeHtml(options.code)}</div>
        </div>`
      : "";
    const action = options.action
      ? `<div style="margin:26px 0 6px;">
          <a href="${this.escapeHtml(options.action.href)}" style="display:inline-block;background:#d4af37;color:#0b1f3a;text-decoration:none;border-radius:8px;padding:13px 18px;font-size:15px;font-weight:700;">${this.escapeHtml(options.action.label)}</a>
        </div>`
      : "";
    const footerNote = options.footerNote
      ? `<p style="margin:0;color:#6b7280;font-size:13px;line-height:1.55;">${this.escapeHtml(options.footerNote)}</p>`
      : "";

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${this.escapeHtml(options.title)}</title>
  </head>
  <body style="margin:0;background:#f8f6f1;font-family:Arial,'Helvetica Neue',sans-serif;color:#0b1f3a;">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;">${this.escapeHtml(options.eyebrow)} - ${this.escapeHtml(options.title)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f6f1;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #ece7d8;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#0b1f3a;padding:26px 30px;">
                <div style="color:#ffffff;font-family:Georgia,serif;font-size:26px;font-weight:700;line-height:1;">Med<span style="color:#d4af37;">Shift</span></div>
                <div style="margin-top:10px;color:#d4af37;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">${this.escapeHtml(options.eyebrow)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 30px 26px;">
                <h1 style="margin:0 0 18px;color:#0b1f3a;font-family:Georgia,serif;font-size:30px;line-height:1.18;">${this.escapeHtml(options.title)}</h1>
                ${body}
                ${code}
                ${action}
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #ece7d8;background:#fbfaf6;padding:20px 30px;">
                ${footerNote}
                <p style="margin:12px 0 0;color:#9ca3af;font-size:12px;line-height:1.5;">MedShift - Healthcare staffing, verified and on demand.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private formatDate(value: Date | string) {
    return new Intl.DateTimeFormat("en-CA", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(value));
  }

  private serializeNotification(notification: NotificationDocument): NotificationSummary {
    const object = notification.toObject({ versionKey: false }) as Notification & {
      createdAt?: Date;
      readAt?: Date | null;
      userId: Types.ObjectId;
    };
    const metadata =
      object.metadata instanceof Map
        ? Object.fromEntries(object.metadata.entries())
        : object.metadata
          ? Object.fromEntries(Object.entries(object.metadata as Record<string, string>).map(([key, value]) => [key, String(value)]))
          : undefined;

    return {
      body: object.body,
      createdAt: object.createdAt?.toISOString?.() ?? undefined,
      href: object.href,
      id: notification.id,
      metadata,
      readAt: object.readAt ? object.readAt.toISOString() : null,
      title: object.title,
      type: object.type,
      userId: object.userId.toString()
    };
  }

  private toObjectId(value: string | Types.ObjectId) {
    return typeof value === "string" ? new Types.ObjectId(value) : value;
  }
}

function addProperty(properties: Record<string, string>, key: string, value?: string) {
  if (value) {
    properties[key] = value;
  }
}

function splitName(fullName?: string) {
  const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];

  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined
  };
}

function removeUndefinedValues<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}

function calculateDistanceKm(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const a =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
