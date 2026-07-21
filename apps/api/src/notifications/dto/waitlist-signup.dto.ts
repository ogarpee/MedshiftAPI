import { IsEmail, IsIn } from "class-validator";
import { UserRole } from "@medshift/shared-types";

export class WaitlistSignupDto {
  @IsEmail()
  email!: string;

  @IsIn([UserRole.Worker, UserRole.Facility])
  role!: UserRole;
}
