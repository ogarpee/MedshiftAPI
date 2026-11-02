import { Type } from "class-transformer";
import {
  ArrayMaxSize,
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
import { BackgroundCheckStatus, ClinicalRole, WorkerDocumentCategory } from "@medshift/shared-types";
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

  @IsOptional()
  @IsString()
  institution?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  certificateNumber?: string;
}

class WorkerDocumentDto {
  @IsString()
  id!: string;

  @IsEnum(WorkerDocumentCategory)
  category!: WorkerDocumentCategory;

  @IsOptional()
  @IsString()
  documentUrl?: string;

  @IsOptional()
  @IsString()
  cloudinaryPublicId?: string;

  @IsOptional()
  @IsString()
  resourceType?: string;

  @IsOptional()
  @IsString()
  deliveryType?: string;

  @IsOptional()
  @IsNumber()
  version?: number;

  @IsOptional()
  @IsString()
  format?: string;

  @IsOptional()
  @IsString()
  originalFilename?: string;

  @IsOptional()
  @IsNumber()
  bytes?: number;

  @IsOptional()
  @IsDateString()
  uploadedAt?: string;
}

class WorkerAvailabilityWindowDto {
  @IsOptional()
  @IsString()
  day?: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsBoolean()
  unavailable?: boolean;
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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkerAvailabilityWindowDto)
  availabilityWindows?: WorkerAvailabilityWindowDto[];

  @IsOptional()
  @IsArray()
  @IsDateString({}, { each: true })
  unavailableDates?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredWorkingHours?: string[];
}

export class CreateWorkerProfileDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEnum(ClinicalRole)
  title!: ClinicalRole;

  @IsOptional()
  @IsString()
  professionalSummary?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  yearsExperience?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CredentialDto)
  credentials?: CredentialDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CredentialDto)
  qualifications?: CredentialDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CredentialDto)
  certifications?: CredentialDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => WorkerDocumentDto)
  documents?: WorkerDocumentDto[];

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
