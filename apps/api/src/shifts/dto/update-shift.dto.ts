import { PartialType } from "@nestjs/mapped-types";
import { IsEnum, IsMongoId, IsOptional } from "class-validator";
import { ShiftStatus } from "@medshift/shared-types";
import { CreateShiftDto } from "./create-shift.dto";

export class UpdateShiftDto extends PartialType(CreateShiftDto) {
  @IsOptional()
  @IsEnum(ShiftStatus)
  status?: ShiftStatus;

  @IsOptional()
  @IsMongoId()
  matchedWorkerId?: string;
}
