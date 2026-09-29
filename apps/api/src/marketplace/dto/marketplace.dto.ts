import { Type } from "class-transformer";
import { IsDate, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from "class-validator";
import {
  AttendanceEventType,
  DisputeStatus,
  ShiftApplicationStatus,
  ShiftInvitationStatus,
  TimesheetStatus
} from "@medshift/shared-types";
import { GeoPointDto } from "../../profiles/dto/geo-point.dto";

export class CreateShiftApplicationDto {
  @IsOptional()
  @IsString()
  message?: string;
}

export class UpdateShiftApplicationStatusDto {
  @IsEnum(ShiftApplicationStatus)
  status!: ShiftApplicationStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  matchScore?: number;
}

export class CreateShiftInvitationDto {
  @IsMongoId()
  workerId!: string;

  @IsOptional()
  @IsString()
  message?: string;
}

export class UpdateShiftInvitationStatusDto {
  @IsEnum(ShiftInvitationStatus)
  status!: ShiftInvitationStatus;
}

export class AssignShiftDto {
  @IsMongoId()
  workerId!: string;

  @IsOptional()
  @IsMongoId()
  applicationId?: string;

  @IsOptional()
  @IsMongoId()
  invitationId?: string;
}

export class AttendanceEventDto {
  @IsMongoId()
  shiftId!: string;

  @IsString()
  idempotencyKey!: string;

  @Type(() => Date)
  @IsDate()
  occurredAt!: Date;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPointDto)
  location?: GeoPointDto;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateTimesheetDto {
  @IsMongoId()
  shiftId!: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  actualStartTime?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  actualEndTime?: Date;

  @IsOptional()
  @IsNumber()
  @Min(0)
  breakMinutes?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTimesheetDto {
  @IsOptional()
  @IsEnum(TimesheetStatus)
  status?: TimesheetStatus;

  @IsOptional()
  @IsString()
  facilityNotes?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateDisputeDto {
  @IsOptional()
  @IsMongoId()
  shiftId?: string;

  @IsOptional()
  @IsMongoId()
  timesheetId?: string;

  @IsOptional()
  @IsMongoId()
  reviewId?: string;

  @IsString()
  reason!: string;
}

export class UpdateDisputeDto {
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;

  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}

export function attendanceEventDtoToType(path: "clock-in" | "break/start" | "break/end" | "clock-out") {
  if (path === "clock-in") return AttendanceEventType.ClockIn;
  if (path === "break/start") return AttendanceEventType.BreakStart;
  if (path === "break/end") return AttendanceEventType.BreakEnd;
  return AttendanceEventType.ClockOut;
}
