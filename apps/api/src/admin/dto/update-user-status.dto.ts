import { AccountStatus } from "@medshift/shared-types";
import { IsEnum } from "class-validator";

export class UpdateUserStatusDto {
  @IsEnum(AccountStatus)
  status!: AccountStatus;
}
