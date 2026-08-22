import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { Model } from "mongoose";
import { AccountStatus, AuthResponse, AuthTokenPayload, UserRole } from "@medshift/shared-types";
import { RegistrationAttempt, RegistrationAttemptDocument } from "../database/schemas/registration-attempt.schema";
import { User, UserDocument } from "../database/schemas/user.schema";
import { NotificationService } from "../notifications/notification.service";
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

const verificationTokenExpiresInHours = 24;
const verificationTokenExpiresInMs = verificationTokenExpiresInHours * 60 * 60 * 1000;
const passwordResetOtpExpiresInMinutes = 10;
const passwordResetOtpExpiresInMs = passwordResetOtpExpiresInMinutes * 60 * 1000;
const registrationOtpExpiresInMinutes = 10;
const registrationOtpExpiresInMs = registrationOtpExpiresInMinutes * 60 * 1000;
const registrationCompletionTokenExpiresInMinutes = 20;
const registrationCompletionTokenExpiresInMs = registrationCompletionTokenExpiresInMinutes * 60 * 1000;
const maxRegistrationOtpAttempts = 5;
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

interface PasswordResetRequestResponse {
  message: string;
}

interface PasswordResetResponse {
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

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(RegistrationAttempt.name) private readonly registrationAttempts: Model<RegistrationAttemptDocument>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly passwordService: PasswordService,
    private readonly notificationService: NotificationService
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

  async completeRegistration(dto: CompleteRegistrationDto): Promise<AuthResponse> {
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
      status: AccountStatus.Active,
      emailVerified: true,
      emailVerifiedAt: new Date()
    });

    await this.registrationAttempts.deleteOne({ _id: attempt._id }).exec();
    await Promise.all([
      this.notificationService.sendWelcomeEmail(user.email, user.role),
      this.notificationService.syncRegisteredContact(user.email, user.role)
    ]);

    return this.toAuthResponse(user);
  }

  async register(dto: RegisterDto): Promise<VerificationRequiredResponse> {
    const email = dto.email.toLowerCase().trim();
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

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.users.findOne({ email: dto.email.toLowerCase().trim() }).exec();

    if (!user || !(await this.passwordService.verify(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException({
        code: "EMAIL_VERIFICATION_REQUIRED",
        email: user.email,
        message: "Verify your email before signing in."
      });
    }

    return this.toAuthResponse(user);
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
    user.status = AccountStatus.Active;
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
      await this.rotateVerificationTokenAndSend(user);
    }

    return {
      emailVerificationRequired: true,
      message: "If that email belongs to an unverified account, a new verification link has been sent."
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

    return {
      message: "Password reset. You can now sign in with your new password."
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

  private async toAuthResponse(user: UserDocument): Promise<AuthResponse> {
    const payload: AuthTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified
      }
    };
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
