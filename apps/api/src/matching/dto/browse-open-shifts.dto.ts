import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsIn, IsNumber, IsOptional, Max, Min } from "class-validator";
import { ClinicalRole, FacilityType } from "@medshift/shared-types";

export class BrowseOpenShiftsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(250)
  radiusKm?: number;

  @IsOptional()
  @IsEnum(ClinicalRole)
  roleRequired?: ClinicalRole;

  @IsOptional()
  @IsEnum(FacilityType)
  facilityType?: FacilityType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(24)
  maxShiftHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minHourlyRate?: number;

  @IsOptional()
  @IsDateString()
  startAfter?: string;

  @IsOptional()
  @IsDateString()
  startBefore?: string;

  @IsOptional()
  @IsIn(["DISTANCE", "START_TIME", "HOURLY_RATE"])
  sort?: "DISTANCE" | "START_TIME" | "HOURLY_RATE";
}
