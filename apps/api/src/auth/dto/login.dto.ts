import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { SessionClientType } from "@medshift/shared-types";

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsEnum(SessionClientType)
  clientType?: SessionClientType;

  @IsOptional()
  @IsString()
  trustedDeviceToken?: string;
}
