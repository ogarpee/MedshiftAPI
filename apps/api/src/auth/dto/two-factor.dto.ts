import { IsBoolean, IsEnum, IsOptional, IsString, Length, MinLength } from "class-validator";
import { SessionClientType, TwoFactorMethod } from "@medshift/shared-types";

export class BeginTwoFactorSetupDto {
  @IsEnum(TwoFactorMethod) method!: TwoFactorMethod;
  @IsString() @MinLength(8) currentPassword!: string;
  @IsOptional() @IsString() currentCode?: string;
}

export class VerifyTwoFactorSetupDto {
  @IsString() setupId!: string;
  @IsString() @Length(6, 12) code!: string;
}

export class VerifyTwoFactorChallengeDto {
  @IsString() challengeId!: string;
  @IsString() @Length(6, 20) code!: string;
  @IsOptional() @IsBoolean() trustDevice?: boolean;
}

export class ResendTwoFactorChallengeDto { @IsString() challengeId!: string; }

export class ManageTwoFactorDto {
  @IsString() @MinLength(8) currentPassword!: string;
  @IsString() @Length(6, 20) code!: string;
}

export class TwoFactorLoginContextDto {
  @IsOptional() @IsString() trustedDeviceToken?: string;
  @IsOptional() @IsEnum(SessionClientType) clientType?: SessionClientType;
}
