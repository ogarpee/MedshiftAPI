import { IsEmail, IsEnum, IsString, MinLength } from "class-validator";
import { UserRole } from "@medshift/shared-types";

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
}
