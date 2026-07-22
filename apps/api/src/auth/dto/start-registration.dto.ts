import { IsEmail, IsEnum } from "class-validator";
import { UserRole } from "@medshift/shared-types";

export class StartRegistrationDto {
  @IsEmail()
  email!: string;

  @IsEnum(UserRole)
  role!: UserRole;
}
