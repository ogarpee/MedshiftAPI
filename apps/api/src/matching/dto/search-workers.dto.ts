import { Type } from "class-transformer";
import { IsEnum, IsIn, IsNumber, IsOptional, Max, Min } from "class-validator";
import { BackgroundCheckStatus, ClinicalRole, OnboardingStatus } from "@medshift/shared-types";

export class SearchWorkersDto {
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
  clinicalRole?: ClinicalRole;

  @IsOptional()
  @IsIn(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"])
  availableDay?: string;

  @IsOptional()
  @IsIn(["DAY", "EVENING", "NIGHT", "WEEKEND"])
  shiftType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @IsOptional()
  @IsEnum(OnboardingStatus)
  verificationStatus?: OnboardingStatus;

  @IsOptional()
  @IsEnum(BackgroundCheckStatus)
  backgroundCheckStatus?: BackgroundCheckStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
