import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { Model, Types } from "mongoose";
import { AccountStatus, AuthResponse, AuthTokenPayload, SessionClientType, TwoFactorChallengeResponse, UserRole } from "@medshift/shared-types";
import { RegistrationAttempt, RegistrationAttemptDocument } from "../database/schemas/registration-attempt.schema";
import { Session, SessionDocument } from "../database/schemas/session.schema";
import { User, UserDocument } from "../database/schemas/user.schema";
import { NotificationService } from "../notifications/notification.service";
import { AuthUser } from "./auth-user";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { CompleteRegistrationDto } from "./dto/complete-registration.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResendVerificationDto } from "./dto/resend-verification.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { StartRegistrationDto } from "./dto/start-registration.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { VerifyPasswordResetOtpDto } from "./dto/verify-password-reset-otp.dto";
import { VerifyRegistrationOtpDto } from "./dto/verify-registration-otp.dto";
import { PasswordService } from "./password.service";
import { TwoFactorService } from "./two-factor.service";

const verificationTokenExpiresInHours = 24;
const verificationTokenExpiresInMs = verificationTokenExpiresInHours * 60 * 60 * 1000;
const verificationResendCooldownInSeconds = 60;
const verificationResendCooldownInMs = verificationResendCooldownInSeconds * 1000;
const passwordResetOtpExpiresInMinutes = 10;
const passwordResetOtpExpiresInMs = passwordResetOtpExpiresInMinutes * 60 * 1000;
const registrationOtpExpiresInMinutes = 10;
const registrationOtpExpiresInMs = registrationOtpExpiresInMinutes * 60 * 1000;
const registrationCompletionTokenExpiresInMinutes = 20;
const registrationCompletionTokenExpiresInMs = registrationCompletionTokenExpiresInMinutes * 60 * 1000;
const maxRegistrationOtpAttempts = 5;
const refreshTokenExpiresInDays = 30;
const refreshTokenExpiresInMs = refreshTokenExpiresInDays * 24 * 60 * 60 * 1000;
const personalEmailDomains = new Set([
  "aol.com",
  "gmail.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "me.com",
  "msn.com",
  "outlook.com",
  "proton.me",
  "protonmail.com",
  "yahoo.com"
]);

interface VerificationRequiredResponse {
  emailVerificationRequired: true;
  message: string;
  user: {
    id: string;
    email: string;
    role: UserDocument["role"];
    status: UserDocument["status"];
    emailVerified: boolean;
  };
}

interface VerificationResponse {
  message: string;
  user: VerificationRequiredResponse["user"];
}

interface ResendVerificationResponse {
  emailVerificationRequired: true;
  message: string;
}

interface VerificationResendResult {
  retryAfterSeconds?: number;
  verificationEmailSent: boolean;
}

interface PasswordResetRequestResponse {
  message: string;
}

interface PasswordResetResponse {
  message: string;
}

interface PasswordChangeResponse {
  message: string;
}

interface PasswordResetOtpVerificationResponse {
  email: string;
  message: string;
  passwordResetOtpVerified: true;
}

interface RegistrationOtpResponse {
  email: string;
  message: string;
  registrationOtpRequired: true;
}

interface RegistrationOtpVerificationResponse {
  email: string;
  message: string;
  registrationToken: string;
}

export interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(RegistrationAttempt.name) private readonly registrationAttempts: Model<RegistrationAttemptDocument>,
    @InjectModel(Session.name) private readonly sessions: Model<SessionDocument>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly passwordService: PasswordService,
    private readonly notificationService: NotificationService,
    private readonly twoFactorService: TwoFactorService
  ) {}

  async startRegistration(dto: StartRegistrationDto): Promise<RegistrationOtpResponse> {
    const email = dto.email.toLowerCase().trim();
    this.validateRegistrationRole(dto.role);
    this.validateFacilityWorkEmail(dto.role, email);
    const existingUser = await this.users.exists({ email });

    if (existingUser) {
      throw new ConflictException("An account with this email already exists");
    }

    const otp = this.createRegistrationOtp();

    const attempt = (await this.registrationAttempts.findOne({ email }).exec()) ?? new this.registrationAttempts({ email });
    attempt.role = dto.role;
    attempt.otpHash = this.hashToken(otp);
    attempt.otpExpiresAt = new Date(Date.now() + registrationOtpExpiresInMs);
    attempt.otpSentAt = new Date();
    attempt.otpAttempts = 0;
    attempt.verifiedAt = undefined;
    attempt.completionTokenHash = undefined;
    attempt.completionTokenExpiresAt = undefined;
    await attempt.save();

    await this.notificationService.sendRegistrationOtp({
      email,
      otp,
      expiresInMinutes: registrationOtpExpiresInMinutes
    });

    return {
      email,
      message: "We sent a verification code to your email.",
      registrationOtpRequired: true
    };
  }

  async verifyRegistrationOtp(dto: VerifyRegistrationOtpDto): Promise<RegistrationOtpVerificationResponse> {
    const email = dto.email.toLowerCase().trim();
    const attempt = await this.registrationAttempts.findOne({ email }).exec();

    if (!attempt || attempt.otpExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException({
        code: "REGISTRATION_OTP_EXPIRED",
        message: "This registration code has expired. Request a new code."
      });
    }

    if (attempt.otpAttempts >= maxRegistrationOtpAttempts) {
      throw new BadRequestException({
        code: "REGISTRATION_OTP_LOCKED",
        message: "Too many incorrect codes. Request a new code."
      });
    }

    if (attempt.otpHash !== this.hashToken(dto.otp)) {
      attempt.otpAttempts += 1;
      await attempt.save();
      throw new BadRequestException({
        code: "REGISTRATION_OTP_INVALID",
        message: "Enter the 6-digit code we sent to your email."
      });
    }

    const registrationToken = randomBytes(32).toString("base64url");
    attempt.verifiedAt = new Date();
    attempt.completionTokenHash = this.hashToken(registrationToken);
    attempt.completionTokenExpiresAt = new Date(Date.now() + registrationCompletionTokenExpiresInMs);
    await attempt.save();

    return {
      email,
      message: "Email verified. Complete your account details.",
      registrationToken
    };
  }

  async completeRegistration(dto: CompleteRegistrationDto, metadata: SessionMetadata = {}): Promise<AuthResponse> {
    const email = dto.email.toLowerCase().trim();
    const existingUser = await this.users.exists({ email });

    if (existingUser) {
      throw new ConflictException("An account with this email already exists");
    }

    const attempt = await this.registrationAttempts.findOne({ email, completionTokenHash: this.hashToken(dto.registrationToken) }).exec();

    if (!attempt || !attempt.verifiedAt) {
      throw new BadRequestException({
        code: "REGISTRATION_SESSION_INVALID",
        message: "Verify your email before completing registration."
      });
    }

    if (!attempt.completionTokenExpiresAt || attempt.completionTokenExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException({
        code: "REGISTRATION_SESSION_EXPIRED",
        message: "This registration session expired. Request a new code."
      });
    }

    if (attempt.role !== dto.role) {
      throw new BadRequestException({
        code: "REGISTRATION_ROLE_MISMATCH",
        message: "Start registration again to change account type."
      });
    }

    this.validateFacilityWorkEmail(attempt.role, email);

    const user = await this.users.create({
      email,
      passwordHash: await this.passwordService.hash(dto.password),
      role: attempt.role,
      status: AccountStatus.Pending,
      emailVerified: true,
      emailVerifiedAt: new Date()
    });

    await this.registrationAttempts.deleteOne({ _id: attempt._id }).exec();
    await Promise.all([
      this.notificationService.sendWelcomeEmail(user.email, user.role),
      this.notificationService.syncRegisteredContact(user.email, user.role)
    ]);

    return this.toAuthResponse(user, dto.clientType ?? SessionClientType.Web, metadata);
  }

  async register(dto: RegisterDto): Promise<VerificationRequiredResponse> {
    const email = dto.email.toLowerCase().trim();
    this.validateRegistrationRole(dto.role);
    this.validateFacilityWorkEmail(dto.role, email);
    const existingUser = await this.users.exists({ email });

    if (existingUser) {
      throw new ConflictException("An account with this email already exists");
    }

    const user = await this.users.create({
      email,
      passwordHash: await this.passwordService.hash(dto.password),
      role: dto.role,
      status: AccountStatus.Pending,
      emailVerified: false
    });

    await this.rotateVerificationTokenAndSend(user);

    return {
      emailVerificationRequired: true,
      message: "Account created. Check your inbox to verify your email before signing in.",
      user: this.toPublicUser(user)
    };
  }

  async login(dto: LoginDto, metadata: SessionMetadata = {}, trustedDeviceCookie?: string): Promise<AuthResponse | TwoFactorChallengeResponse> {
    const user = await this.users.findOne({ email: dto.email.toLowerCase().trim() }).exec();

    if (!user || !(await this.passwordService.verify(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (!user.emailVerified) {
      const resend = await this.resendVerificationIfAllowed(user);
      throw new UnauthorizedException({
        code: "EMAIL_VERIFICATION_REQUIRED",
        email: user.email,
        message: resend.verificationEmailSent
          ? "A new verification email has been sent. Check your inbox."
          : "A verification email was sent recently. Check your inbox.",
        ...resend
      });
    }

    if (user.status === AccountStatus.Suspended) {
      throw new UnauthorizedException({
        code: "ACCOUNT_SUSPENDED",
        message: "This account is suspended. Contact MedShift support."
      });
    }

    const clientType = dto.clientType ?? SessionClientType.Web;
    const factor = await this.twoFactorService.prepareLogin(user, clientType, dto.trustedDeviceToken ?? trustedDeviceCookie, metadata);
    if (factor.required) return factor.response;
    return this.toAuthResponse(user, clientType, metadata);
  }

  async verifyTwoFactorLogin(challengeId: string, code: string, trustDevice: boolean, metadata: SessionMetadata = {}) {
    const verified = await this.twoFactorService.consumeLoginChallenge(challengeId, code, trustDevice, metadata);
    const user = await this.users.findById(verified.userId).exec();
    if (!user || !user.emailVerified || user.status === AccountStatus.Suspended) throw new UnauthorizedException("Account is unavailable");
    return { ...(await this.toAuthResponse(user, verified.clientType, metadata)), clientType: verified.clientType, trustedDeviceToken: verified.trustedDeviceToken };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<VerificationResponse> {
    const email = dto.email.toLowerCase().trim();
    const tokenHash = this.hashToken(dto.token);
    const user = await this.users.findOne({ email, emailVerificationTokenHash: tokenHash }).exec();

    if (!user) {
      throw new BadRequestException({
        code: "EMAIL_VERIFICATION_INVALID",
        message: "This verification link is invalid or has already been used."
      });
    }

    if (!user.emailVerificationTokenExpiresAt || user.emailVerificationTokenExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException({
        code: "EMAIL_VERIFICATION_EXPIRED",
        email: user.email,
        message: "This verification link has expired. Request a new verification email."
      });
    }

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationTokenExpiresAt = undefined;
    user.emailVerificationSentAt = undefined;
    if (user.role === UserRole.Admin) {
      user.status = AccountStatus.Active;
    }
    await user.save();
    await Promise.all([
      this.notificationService.sendWelcomeEmail(user.email, user.role),
      this.notificationService.syncRegisteredContact(user.email, user.role)
    ]);

    return {
      message: "Email verified. You can now sign in.",
      user: this.toPublicUser(user)
    };
  }

  async resendVerification(dto: ResendVerificationDto): Promise<ResendVerificationResponse> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.users.findOne({ email }).exec();

    if (user && !user.emailVerified) {
      await this.resendVerificationIfAllowed(user);
    }

    return {
      emailVerificationRequired: true,
      message: "If that email belongs to an unverified account, a verification link was sent recently or a new link has been sent."
    };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<PasswordResetRequestResponse> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.users.findOne({ email }).exec();

    if (user) {
      await this.rotatePasswordResetTokenAndSend(user);
    }

    return {
      message: "If that email belongs to a MedShift account, a 6-digit reset code has been sent."
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<PasswordResetResponse> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.findUserForPasswordResetOtp(email, dto.otp);

    user.passwordHash = await this.passwordService.hash(dto.password);
    user.passwordResetTokenHash = undefined;
    user.passwordResetTokenExpiresAt = undefined;
    user.passwordResetSentAt = undefined;
    user.passwordChangedAt = new Date();
    await user.save();
    await this.revokeUserSessions(user._id, "password_reset");
    await this.twoFactorService.revokeAllTrusted(user._id);

    return {
      message: "Password reset. You can now sign in with your new password."
    };
  }

  async changePassword(currentUser: AuthUser, dto: ChangePasswordDto): Promise<PasswordChangeResponse> {
    const user = await this.users.findById(currentUser.sub).exec();

    if (!user) {
      throw new UnauthorizedException("Sign in again before changing your password.");
    }

    if (!(await this.passwordService.verify(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException("Current password is incorrect.");
    }

    user.passwordHash = await this.passwordService.hash(dto.newPassword);
    user.passwordResetTokenHash = undefined;
    user.passwordResetTokenExpiresAt = undefined;
    user.passwordResetSentAt = undefined;
    user.passwordChangedAt = new Date();
    await user.save();
    await this.revokeUserSessions(user._id, "password_changed");
    await this.twoFactorService.revokeAllTrusted(user._id);

    return {
      message: "Password updated."
    };
  }

  async verifyPasswordResetOtp(dto: VerifyPasswordResetOtpDto): Promise<PasswordResetOtpVerificationResponse> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.findUserForPasswordResetOtp(email, dto.otp);

    return {
      email: user.email,
      message: "Code verified. Set your new password.",
      passwordResetOtpVerified: true
    };
  }

  async refreshSession(refreshToken: string, metadata: SessionMetadata = {}): Promise<AuthResponse> {
    const [sessionId, rawToken] = refreshToken.split(".");
    if (!Types.ObjectId.isValid(sessionId) || !rawToken) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const session = await this.sessions.findById(sessionId).exec();
    if (!session || session.refreshTokenHash !== this.hashToken(rawToken)) {
      if (session) await this.revokeSessionFamily(session.familyId, "refresh_token_reuse");
      throw new UnauthorizedException("Invalid refresh token");
    }
    if (session.revokedAt) {
      await this.revokeSessionFamily(session.familyId, "refresh_token_reuse");
      throw new UnauthorizedException("Refresh token has been revoked");
    }
    if (session.refreshExpiresAt.getTime() <= Date.now()) {
      await this.revokeSession(session, "refresh_token_expired");
      throw new UnauthorizedException("Refresh token has expired");
    }

    const user = await this.users.findById(session.userId).exec();
    if (!user || !user.emailVerified || user.status === AccountStatus.Suspended) {
      await this.revokeSessionFamily(session.familyId, "account_unavailable");
      throw new UnauthorizedException("Account is unavailable");
    }

    const replacement = await this.createSession(user, session.clientType, metadata, session.familyId);
    session.revokedAt = new Date();
    session.revocationReason = "rotated";
    session.replacedBySessionId = new Types.ObjectId(replacement.sessionId);
    session.lastUsedAt = new Date();
    await session.save();
    return replacement.response;
  }

  async logout(sessionId: string) {
    if (Types.ObjectId.isValid(sessionId)) {
      const session = await this.sessions.findById(sessionId).exec();
      if (session) await this.revokeSession(session, "logout");
    }
    return { message: "Signed out." };
  }

  async logoutAll(currentUser: AuthUser) {
    await this.revokeUserSessions(new Types.ObjectId(currentUser.sub), "logout_all");
    await this.twoFactorService.revokeAllTrusted(currentUser.sub);
    return { message: "Signed out on all devices." };
  }

  private async toAuthResponse(user: UserDocument, clientType: SessionClientType, metadata: SessionMetadata): Promise<AuthResponse> {
    return (await this.createSession(user, clientType, metadata)).response;
  }

  private async createSession(user: UserDocument, clientType: SessionClientType, metadata: SessionMetadata, familyId = randomBytes(24).toString("base64url")) {
    const rawRefreshToken = randomBytes(48).toString("base64url");
    const csrfToken = randomBytes(32).toString("base64url");
    const session = await this.sessions.create({
      userId: user._id,
      familyId,
      clientType,
      refreshTokenHash: this.hashToken(rawRefreshToken),
      refreshExpiresAt: new Date(Date.now() + refreshTokenExpiresInMs),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      lastUsedAt: new Date()
    });
    const payload: AuthTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: session.id
    };

    const response: AuthResponse = {
      accessToken: await this.jwtService.signAsync(payload),
      refreshToken: `${session.id}.${rawRefreshToken}`,
      csrfToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified
      }
    };
    return { response, sessionId: session.id };
  }

  private async revokeSession(session: SessionDocument, reason: string) {
    if (!session.revokedAt) {
      session.revokedAt = new Date();
      session.revocationReason = reason;
      await session.save();
    }
  }

  private async revokeSessionFamily(familyId: string, reason: string) {
    await this.sessions.updateMany({ familyId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date(), revocationReason: reason } }).exec();
  }

  private async revokeUserSessions(userId: Types.ObjectId, reason: string) {
    await this.sessions.updateMany({ userId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date(), revocationReason: reason } }).exec();
  }

  private async rotateVerificationTokenAndSend(user: UserDocument) {
    const token = randomBytes(32).toString("base64url");

    user.emailVerificationTokenHash = this.hashToken(token);
    user.emailVerificationTokenExpiresAt = new Date(Date.now() + verificationTokenExpiresInMs);
    user.emailVerificationSentAt = new Date();
    await user.save();

    await this.notificationService.sendEmailVerification({
      email: user.email,
      role: user.role,
      verificationUrl: this.buildVerificationUrl(user.email, token),
      expiresInHours: verificationTokenExpiresInHours
    });
  }

  private async resendVerificationIfAllowed(user: UserDocument): Promise<VerificationResendResult> {
    const now = new Date();
    const cooldownStartedBefore = new Date(now.getTime() - verificationResendCooldownInMs);
    const reservedUser = await this.users.findOneAndUpdate(
      {
        _id: user._id,
        emailVerified: false,
        $or: [
          { emailVerificationSentAt: { $exists: false } },
          { emailVerificationSentAt: null },
          { emailVerificationSentAt: { $lte: cooldownStartedBefore } }
        ]
      },
      { $set: { emailVerificationSentAt: now } },
      { new: true }
    ).exec();

    if (reservedUser) {
      await this.rotateVerificationTokenAndSend(reservedUser);
      return { verificationEmailSent: true };
    }

    const currentUser = await this.users.findById(user._id).select("emailVerificationSentAt").lean().exec();
    const elapsedMs = currentUser?.emailVerificationSentAt ? now.getTime() - currentUser.emailVerificationSentAt.getTime() : 0;
    return {
      verificationEmailSent: false,
      retryAfterSeconds: Math.max(1, Math.ceil((verificationResendCooldownInMs - elapsedMs) / 1000))
    };
  }

  private async rotatePasswordResetTokenAndSend(user: UserDocument) {
    const otp = this.createPasswordResetOtp();

    user.passwordResetTokenHash = this.hashToken(otp);
    user.passwordResetTokenExpiresAt = new Date(Date.now() + passwordResetOtpExpiresInMs);
    user.passwordResetSentAt = new Date();
    await user.save();

    await this.notificationService.sendPasswordReset({
      email: user.email,
      otp,
      expiresInMinutes: passwordResetOtpExpiresInMinutes
    });
  }

  private async findUserForPasswordResetOtp(email: string, otp: string) {
    const otpHash = this.hashToken(otp);
    const isDevelopmentDefaultOtp = this.isDevelopmentPasswordResetOtp(otp);
    const user =
      (await this.users.findOne({ email, passwordResetTokenHash: otpHash }).exec()) ??
      (isDevelopmentDefaultOtp ? await this.users.findOne({ email }).exec() : null);

    if (!user && isDevelopmentDefaultOtp) {
      throw new BadRequestException({
        code: "PASSWORD_RESET_ACCOUNT_NOT_FOUND",
        message: "No MedShift account exists for this email in this environment."
      });
    }

    if (!user) {
      throw new BadRequestException({
        code: "PASSWORD_RESET_INVALID",
        message: this.getPasswordResetOtpPrompt()
      });
    }

    if (!isDevelopmentDefaultOtp && (!user.passwordResetTokenExpiresAt || user.passwordResetTokenExpiresAt.getTime() < Date.now())) {
      throw new BadRequestException({
        code: "PASSWORD_RESET_EXPIRED",
        email: user.email,
        message: "This password reset code has expired. Request a new code."
      });
    }

    return user;
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private createRegistrationOtp() {
    return this.allowDefaultOtp() ? "123456" : randomInt(100000, 1000000).toString();
  }

  private createPasswordResetOtp() {
    return this.allowDefaultOtp() ? "123456" : randomInt(100000, 1000000).toString();
  }

  private getPasswordResetOtpPrompt() {
    return "Enter the 6-digit reset code.";
  }

  private isDevelopmentPasswordResetOtp(otp: string) {
    return this.allowDefaultOtp() && otp === "123456";
  }

  private allowDefaultOtp() {
    const allowDevOtps = this.config.get<string>("ALLOW_DEV_OTPS")?.toLowerCase();

    return allowDevOtps === "true" || allowDevOtps === "1" || allowDevOtps === "yes" || this.config.get<string>("NODE_ENV") !== "production";
  }

  private validateRegistrationRole(role: UserRole) {
    if (role !== UserRole.Worker && role !== UserRole.Facility) {
      throw new BadRequestException({
        code: "REGISTRATION_ROLE_INVALID",
        message: "Choose worker or facility account type."
      });
    }
  }

  private validateFacilityWorkEmail(role: UserRole, email: string) {
    if (role !== UserRole.Facility) {
      return;
    }

    const domain = email.split("@")[1]?.toLowerCase();

    if (!domain || !domain.includes(".") || personalEmailDomains.has(domain)) {
      throw new BadRequestException({
        code: "FACILITY_WORK_EMAIL_REQUIRED",
        message: "Facility registration requires a work email address."
      });
    }
  }

  private buildVerificationUrl(email: string, token: string) {
    const webOrigin = this.config.get<string>("WEB_ORIGIN", "http://localhost:3000").replace(/\/$/, "");
    const url = new URL("/verify-email", webOrigin);
    url.searchParams.set("email", email);
    url.searchParams.set("token", token);

    return url.toString();
  }

  private toPublicUser(user: UserDocument): VerificationRequiredResponse["user"] {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified
    };
  }
}
