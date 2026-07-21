import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import { createHash, randomBytes } from "node:crypto";
import { Model } from "mongoose";
import { AccountStatus, AuthResponse, AuthTokenPayload } from "@medshift/shared-types";
import { User, UserDocument } from "../database/schemas/user.schema";
import { NotificationService } from "../notifications/notification.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResendVerificationDto } from "./dto/resend-verification.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { PasswordService } from "./password.service";

const verificationTokenExpiresInHours = 24;
const verificationTokenExpiresInMs = verificationTokenExpiresInHours * 60 * 60 * 1000;
const passwordResetTokenExpiresInHours = 1;
const passwordResetTokenExpiresInMs = passwordResetTokenExpiresInHours * 60 * 60 * 1000;

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

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly passwordService: PasswordService,
    private readonly notificationService: NotificationService
  ) {}

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
    await this.notificationService.sendWelcomeEmail(user.email, user.role);

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
      message: "If that email belongs to a MedShift account, a password reset link has been sent."
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<PasswordResetResponse> {
    const email = dto.email.toLowerCase().trim();
    const tokenHash = this.hashToken(dto.token);
    const user = await this.users.findOne({ email, passwordResetTokenHash: tokenHash }).exec();

    if (!user) {
      throw new BadRequestException({
        code: "PASSWORD_RESET_INVALID",
        message: "This password reset link is invalid or has already been used."
      });
    }

    if (!user.passwordResetTokenExpiresAt || user.passwordResetTokenExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException({
        code: "PASSWORD_RESET_EXPIRED",
        email: user.email,
        message: "This password reset link has expired. Request a new password reset email."
      });
    }

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
    const token = randomBytes(32).toString("base64url");

    user.passwordResetTokenHash = this.hashToken(token);
    user.passwordResetTokenExpiresAt = new Date(Date.now() + passwordResetTokenExpiresInMs);
    user.passwordResetSentAt = new Date();
    await user.save();

    await this.notificationService.sendPasswordReset({
      email: user.email,
      resetUrl: this.buildPasswordResetUrl(user.email, token),
      expiresInHours: passwordResetTokenExpiresInHours
    });
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private buildVerificationUrl(email: string, token: string) {
    const webOrigin = this.config.get<string>("WEB_ORIGIN", "http://localhost:3000").replace(/\/$/, "");
    const url = new URL("/verify-email", webOrigin);
    url.searchParams.set("email", email);
    url.searchParams.set("token", token);

    return url.toString();
  }

  private buildPasswordResetUrl(email: string, token: string) {
    const webOrigin = this.config.get<string>("WEB_ORIGIN", "http://localhost:3000").replace(/\/$/, "");
    const url = new URL("/reset-password", webOrigin);
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
