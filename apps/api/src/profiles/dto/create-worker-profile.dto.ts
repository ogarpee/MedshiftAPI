import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";
import { BackgroundCheckStatus, ClinicalRole } from "@medshift/shared-types";
import { GeoPointDto } from "./geo-point.dto";

class CredentialDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  documentUrl?: string;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}

class BackgroundCheckDto {
  @IsOptional()
  @IsEnum(BackgroundCheckStatus)
  status?: BackgroundCheckStatus;

  @IsOptional()
  @IsDateString()
  consentedAt?: string;
}

class WorkerPreferencesDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(250)
  maxDistanceKm?: number;

  @IsOptional()
  @IsArray()
  @IsIn(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"], { each: true })
  availableDays?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(["DAY", "EVENING", "NIGHT", "WEEKEND"], { each: true })
  preferredShiftTypes?: string[];
}

export class CreateWorkerProfileDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsEnum(ClinicalRole)
  title!: ClinicalRole;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CredentialDto)
  credentials?: CredentialDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => BackgroundCheckDto)
  backgroundCheck?: BackgroundCheckDto;

  @ValidateNested()
  @Type(() => GeoPointDto)
  location!: GeoPointDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkerPreferencesDto)
  preferences?: WorkerPreferencesDto;
}
