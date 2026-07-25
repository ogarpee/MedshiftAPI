import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClinicalRole, UserRole } from "@medshift/shared-types";

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

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly config: ConfigService) {}

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
}
