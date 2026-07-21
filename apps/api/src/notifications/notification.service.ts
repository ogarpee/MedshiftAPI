import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClinicalRole, UserRole } from "@medshift/shared-types";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
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
  resetUrl: string;
  expiresInHours: number;
};

type RegistrationOtpEmailPayload = {
  email: string;
  otp: string;
  expiresInMinutes: number;
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly config: ConfigService) {}

  async sendWelcomeEmail(email: string, role: UserRole) {
    const audience = role === UserRole.Worker ? "healthcare professional" : "facility partner";

    await this.sendEmail({
      to: email,
      subject: "Welcome to MedShift",
      text: `Welcome to MedShift. Your ${audience} account is ready for profile setup.`,
      html: `<p>Welcome to <strong>MedShift</strong>.</p><p>Your ${audience} account is ready for profile setup.</p>`
    });
  }

  async sendEmailVerification(payload: VerificationEmailPayload) {
    const audience = payload.role === UserRole.Worker ? "healthcare professional" : "facility partner";

    await this.sendEmail({
      to: payload.email,
      subject: "Verify your MedShift email",
      text: `Verify your MedShift ${audience} account: ${payload.verificationUrl}. This link expires in ${payload.expiresInHours} hours.`,
      html: `<p>Welcome to <strong>MedShift</strong>.</p><p>Verify your ${audience} account with the link below. It expires in ${payload.expiresInHours} hours.</p><p><a href="${payload.verificationUrl}">Verify email address</a></p>`
    });
  }

  async sendPasswordReset(payload: PasswordResetEmailPayload) {
    await this.sendEmail({
      to: payload.email,
      subject: "Reset your MedShift password",
      text: `Reset your MedShift password: ${payload.resetUrl}. This link expires in ${payload.expiresInHours} hour.`,
      html: `<p>Reset your <strong>MedShift</strong> password with the link below.</p><p>This link expires in ${payload.expiresInHours} hour.</p><p><a href="${payload.resetUrl}">Reset password</a></p>`
    });
  }

  async sendRegistrationOtp(payload: RegistrationOtpEmailPayload) {
    await this.sendEmail({
      to: payload.email,
      subject: "Your MedShift registration code",
      text: `Your MedShift registration code is ${payload.otp}. This code expires in ${payload.expiresInMinutes} minutes.`,
      html: `<p>Your <strong>MedShift</strong> registration code is:</p><p><strong>${payload.otp}</strong></p><p>This code expires in ${payload.expiresInMinutes} minutes.</p>`
    });
  }

  async sendWaitlistWelcome(email: string, role: UserRole) {
    const audience = role === UserRole.Worker ? "worker" : "facility";

    await this.sendEmail({
      to: email,
      subject: "You're on the MedShift early access list",
      text: `Thanks for joining MedShift early access as a ${audience}. We'll send launch updates soon.`,
      html: `<p>Thanks for joining MedShift early access as a <strong>${audience}</strong>.</p><p>We'll send launch updates soon.</p>`
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
            html: `<p>Your <strong>${payload.roleRequired}</strong> shift at ${facilityName} is confirmed.</p><p>${window}</p>`
          })
        : Promise.resolve(),
      payload.facilityEmail
        ? this.sendEmail({
            to: payload.facilityEmail,
            subject: "Worker matched for your shift",
            text: `A worker accepted your ${payload.roleRequired} shift for ${window}.`,
            html: `<p>A worker accepted your <strong>${payload.roleRequired}</strong> shift.</p><p>${window}</p>`
          })
        : Promise.resolve()
    ]);
  }

  private async sendEmail(payload: EmailPayload) {
    const apiKey = this.config.get<string>("RESEND_API_KEY");

    if (!apiKey) {
      this.logger.log(`Email skipped for ${payload.to}: ${payload.subject}`);
      return { delivered: false, provider: "console" };
    }

    const response = await fetch("https://api.resend.com/emails", {
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

    if (!response.ok) {
      this.logger.warn(`Resend email failed for ${payload.to}: ${response.status}`);
      return { delivered: false, provider: "resend" };
    }

    return { delivered: true, provider: "resend" };
  }

  private formatDate(value: Date | string) {
    return new Intl.DateTimeFormat("en-CA", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(value));
  }
}
