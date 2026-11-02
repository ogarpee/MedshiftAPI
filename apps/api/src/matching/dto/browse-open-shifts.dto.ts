import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsDateString, IsEnum, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { ClinicalRole, FacilityType } from "@medshift/shared-types";

export class BrowseOpenShiftsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  search?: string;

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
  @Transform(({ value }) => csvValues(value))
  @IsArray()
  @ArrayMaxSize(4)
  @IsEnum(ClinicalRole, { each: true })
  roles?: ClinicalRole[];

  @IsOptional()
  @IsEnum(FacilityType)
  facilityType?: FacilityType;

  @IsOptional()
  @Transform(({ value }) => csvValues(value))
  @IsArray()
  @ArrayMaxSize(7)
  @IsEnum(FacilityType, { each: true })
  facilityTypes?: FacilityType[];

  @IsOptional()
  @Transform(({ value }) => csvValues(value))
  @IsArray()
  @ArrayMaxSize(4)
  @IsIn(["DAY", "EVENING", "NIGHT", "WEEKEND"], { each: true })
  shiftTypes?: Array<"DAY" | "EVENING" | "NIGHT" | "WEEKEND">;

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

function csvValues(value: unknown): string[] | unknown {
  if (Array.isArray(value)) {
    return value.flatMap((item) => typeof item === "string" ? item.split(",") : []).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value !== "string") return value;
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
