import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsEmail, IsEnum, IsOptional, IsString, ValidateNested } from "class-validator";
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

export class CreateFacilityProfileDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsEnum(FacilityType)
  facilityType?: FacilityType;

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
  @IsEnum(["ACTIVE", "INACTIVE"])
  billingStatus?: "ACTIVE" | "INACTIVE";

  @IsOptional()
  @ValidateNested()
  @Type(() => FacilityReadinessDto)
  readiness?: FacilityReadinessDto;
}
