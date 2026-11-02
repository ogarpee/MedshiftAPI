import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, Res, UseGuards } from "@nestjs/common";
import { SessionClientType } from "@medshift/shared-types";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { AuthRequest } from "./auth-request";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { CompleteRegistrationDto } from "./dto/complete-registration.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { RefreshSessionDto } from "./dto/refresh-session.dto";
import { ResendVerificationDto } from "./dto/resend-verification.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { StartRegistrationDto } from "./dto/start-registration.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { VerifyPasswordResetOtpDto } from "./dto/verify-password-reset-otp.dto";
import { VerifyRegistrationOtpDto } from "./dto/verify-registration-otp.dto";
import { BeginTwoFactorSetupDto, ManageTwoFactorDto, ResendTwoFactorChallengeDto, VerifyTwoFactorChallengeDto, VerifyTwoFactorSetupDto } from "./dto/two-factor.dto";
import { TwoFactorService } from "./two-factor.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly twoFactorService: TwoFactorService) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("register/start")
  startRegistration(@Body() dto: StartRegistrationDto) {
    return this.authService.startRegistration(dto);
  }

  @Post("register/verify-otp")
  verifyRegistrationOtp(@Body() dto: VerifyRegistrationOtpDto) {
    return this.authService.verifyRegistrationOtp(dto);
  }

  @Post("register/complete")
  async completeRegistration(@Req() request: AuthRequest, @Res({ passthrough: true }) response: Response, @Body() dto: CompleteRegistrationDto) {
    const result = await this.authService.completeRegistration(dto, sessionMetadata(request));
    setSessionCookies(response, result, dto.clientType);
    return sessionResponse(result, dto.clientType);
  }

  @Post("login")
  async login(@Req() request: AuthRequest, @Res({ passthrough: true }) response: Response, @Body() dto: LoginDto) {
    const result = await this.authService.login(dto, sessionMetadata(request), readCookie(request, "medshift_trusted_device"));
    if ("twoFactorRequired" in result) {
      response.status(202);
      return result;
    }
    setSessionCookies(response, result, dto.clientType);
    return sessionResponse(result, dto.clientType);
  }

  @Post("2fa/challenge/verify")
  async verifyTwoFactorChallenge(@Req() request: AuthRequest, @Res({ passthrough: true }) response: Response, @Body() dto: VerifyTwoFactorChallengeDto) {
    const result = await this.authService.verifyTwoFactorLogin(dto.challengeId, dto.code, dto.trustDevice ?? true, sessionMetadata(request));
    setSessionCookies(response, result, result.clientType);
    if (result.trustedDeviceToken) setTrustedDeviceCookie(response, result.trustedDeviceToken, result.clientType);
    return sessionResponse(result, result.clientType);
  }

  @HttpCode(200)
  @Post("2fa/challenge/resend")
  resendTwoFactorChallenge(@Body() dto: ResendTwoFactorChallengeDto) { return this.twoFactorService.resend(dto.challengeId); }

  @UseGuards(JwtAuthGuard)
  @Get("2fa")
  twoFactorStatus(@Req() request: AuthRequest) { return this.twoFactorService.status(request.user.sub); }

  @UseGuards(JwtAuthGuard)
  @Post("2fa/setup")
  beginTwoFactorSetup(@Req() request: AuthRequest, @Body() dto: BeginTwoFactorSetupDto) { return this.twoFactorService.beginSetup(request.user.sub, dto, sessionMetadata(request)); }

  @UseGuards(JwtAuthGuard)
  @Post("2fa/setup/verify")
  verifyTwoFactorSetup(@Req() request: AuthRequest, @Body() dto: VerifyTwoFactorSetupDto) { return this.twoFactorService.verifySetup(request.user.sub, dto); }

  @UseGuards(JwtAuthGuard)
  @Delete("2fa")
  disableTwoFactor(@Req() request: AuthRequest, @Body() dto: ManageTwoFactorDto) { return this.twoFactorService.disable(request.user.sub, dto); }

  @UseGuards(JwtAuthGuard)
  @Post("2fa/recovery-codes")
  regenerateRecoveryCodes(@Req() request: AuthRequest, @Body() dto: ManageTwoFactorDto) { return this.twoFactorService.regenerateRecoveryCodes(request.user.sub, dto); }

  @UseGuards(JwtAuthGuard)
  @Post("2fa/manage-code")
  sendTwoFactorManagementCode(@Req() request: AuthRequest) { return this.twoFactorService.sendManagementCode(request.user.sub); }

  @UseGuards(JwtAuthGuard)
  @Get("trusted-devices")
  trustedDevices(@Req() request: AuthRequest) { return this.twoFactorService.listTrustedDevices(request.user.sub); }

  @UseGuards(JwtAuthGuard)
  @Delete("trusted-devices/:id")
  revokeTrustedDevice(@Req() request: AuthRequest, @Param("id") id: string) { return this.twoFactorService.revokeTrustedDevice(request.user.sub, id); }

  @UseGuards(JwtAuthGuard)
  @Delete("trusted-devices")
  revokeAllTrustedDevices(@Req() request: AuthRequest) { return this.twoFactorService.revokeAllTrusted(request.user.sub).then(() => ({ message: "Trusted devices removed." })); }

  @Post("refresh")
  async refresh(@Req() request: AuthRequest, @Res({ passthrough: true }) response: Response, @Body() dto: RefreshSessionDto) {
    const token = dto.refreshToken ?? readCookie(request, "medshift_refresh");
    if (!token) return this.authService.refreshSession("", sessionMetadata(request));
    const result = await this.authService.refreshSession(token, sessionMetadata(request));
    const clientType = dto.refreshToken ? SessionClientType.Mobile : SessionClientType.Web;
    setSessionCookies(response, result, clientType);
    return sessionResponse(result, clientType);
  }

  @Post("verify-email")
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post("resend-verification")
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Post("forgot-password")
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post("forgot-password/verify-otp")
  verifyPasswordResetOtp(@Body() dto: VerifyPasswordResetOtpDto) {
    return this.authService.verifyPasswordResetOtp(dto);
  }

  @Post("reset-password")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("password")
  changePassword(@Req() request: AuthRequest, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(request.user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() request: AuthRequest) {
    return request.user;
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  async logout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    clearSessionCookies(response);
    return this.authService.logout(request.user.sid);
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout-all")
  async logoutAll(@Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    clearSessionCookies(response);
    response.clearCookie("medshift_trusted_device", { path: "/auth/login" });
    return this.authService.logoutAll(request.user);
  }
}

function sessionMetadata(request: AuthRequest) {
  return {
    ipAddress: request.ip,
    userAgent: request.headers["user-agent"]
  };
}

function readCookie(request: AuthRequest, name: string) {
  const cookie = request.headers.cookie?.split(";").map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : undefined;
}

function setSessionCookies(response: Response, result: { accessToken: string; refreshToken?: string; csrfToken?: string }, clientType: SessionClientType = SessionClientType.Web) {
  if (clientType === SessionClientType.Mobile || !result.refreshToken || !result.csrfToken) return;
  const secure = process.env.NODE_ENV === "production";
  response.cookie("medshift_access", result.accessToken, { httpOnly: true, secure, sameSite: "lax", maxAge: 15 * 60 * 1000, path: "/" });
  response.cookie("medshift_refresh", result.refreshToken, { httpOnly: true, secure, sameSite: "lax", maxAge: 30 * 24 * 60 * 60 * 1000, path: "/auth" });
  response.cookie("medshift_csrf", result.csrfToken, { httpOnly: false, secure, sameSite: "lax", maxAge: 30 * 24 * 60 * 60 * 1000, path: "/" });
}

function clearSessionCookies(response: Response) {
  response.clearCookie("medshift_access", { path: "/" });
  response.clearCookie("medshift_refresh", { path: "/auth" });
  response.clearCookie("medshift_csrf", { path: "/" });
}

function setTrustedDeviceCookie(response: Response, token: string, clientType: SessionClientType) {
  if (clientType === SessionClientType.Mobile) return;
  response.cookie("medshift_trusted_device", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 30 * 24 * 60 * 60 * 1000, path: "/auth/login" });
}


function sessionResponse<T extends { accessToken: string; refreshToken?: string; csrfToken?: string; user: unknown }>(result: T, clientType: SessionClientType = SessionClientType.Web) {
  if (clientType === SessionClientType.Mobile) return result;
  return { user: result.user, csrfToken: result.csrfToken };
}
