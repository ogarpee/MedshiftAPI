import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
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
  @IsEnum(BackgroundCheckStatus)
  status!: BackgroundCheckStatus;
}

class WorkerPreferencesDto {
  @IsOptional()
  @IsNumber()
  maxDistanceKm?: number;
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
