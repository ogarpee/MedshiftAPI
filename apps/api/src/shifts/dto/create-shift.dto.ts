import { Type } from "class-transformer";
import { IsArray, IsDate, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { ClinicalRole, PayType, ShiftVisibility } from "@medshift/shared-types";
import { GeoPointDto } from "../../profiles/dto/geo-point.dto";

class ShiftRequirementsDto {
  @IsOptional()
  @IsString()
  caregiverType?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredQualifications?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSkills?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredCertifications?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumExperienceYears?: number;
}

export class CreateShiftDto {
  @IsOptional()
  @IsMongoId()
  facilityId?: string;

  @IsEnum(ClinicalRole)
  roleRequired!: ClinicalRole;

  @IsOptional()
  @IsString()
  title?: string;

  @Type(() => Date)
  @IsDate()
  startTime!: Date;

  @Type(() => Date)
  @IsDate()
  endTime!: Date;

  @IsNumber()
  @Min(0)
  hourlyRate!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  breakMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  caregiversRequired?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  payAmount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(PayType)
  payType?: PayType;

  @IsOptional()
  @IsEnum(ShiftVisibility)
  visibility?: ShiftVisibility;

  @ValidateNested()
  @Type(() => GeoPointDto)
  location!: GeoPointDto;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShiftRequirementsDto)
  requirements?: ShiftRequirementsDto;
}
