import { ShiftStatus } from "@medshift/shared-types";
import { IsEnum } from "class-validator";

export class UpdateShiftStatusDto {
  @IsEnum(ShiftStatus)
  status!: ShiftStatus;
}
