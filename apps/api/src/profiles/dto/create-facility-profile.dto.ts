import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsObject, IsOptional, IsString, IsUrl, ValidateNested } from "class-validator";
import { FacilityType } from "@medshift/shared-types";
import { GeoPointDto } from "./geo-point.dto";

class AddressDto {
  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  country?: string;
}

class ContactPersonDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

class FacilityReadinessDto {
  @IsOptional()
  @IsEmail()
  billingContactEmail?: string;

  @IsOptional()
  @IsString()
  paymentMethodLabel?: string;

  @IsOptional()
  @IsBoolean()
  staffingContactConfirmed?: boolean;

  @IsOptional()
  @IsDateString()
  acceptedTermsAt?: string;
}

class FacilityDocumentDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  documentUrl?: string;
}

class FacilityLocationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPointDto)
  location?: GeoPointDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateFacilityProfileDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  organizationName?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsEnum(FacilityType)
  facilityType?: FacilityType;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  website?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ValidateNested()
  @Type(() => GeoPointDto)
  location!: GeoPointDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactPersonDto)
  contactPerson?: ContactPersonDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FacilityLocationDto)
  locations?: FacilityLocationDto[];

  @IsOptional()
  @IsObject()
  registrationInfo?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FacilityDocumentDto)
  verificationDocuments?: FacilityDocumentDto[];

  @IsOptional()
  @IsEnum(["ACTIVE", "INACTIVE"])
  billingStatus?: "ACTIVE" | "INACTIVE";

  @IsOptional()
  @ValidateNested()
  @Type(() => FacilityReadinessDto)
  readiness?: FacilityReadinessDto;
}
