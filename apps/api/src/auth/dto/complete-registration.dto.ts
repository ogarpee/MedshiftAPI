import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { SessionClientType, UserRole } from "@medshift/shared-types";

export class CompleteRegistrationDto {
  @IsEmail()
  email!: string;

  @IsString()
  registrationToken!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsOptional()
  @IsEnum(SessionClientType)
  clientType?: SessionClientType;
}
