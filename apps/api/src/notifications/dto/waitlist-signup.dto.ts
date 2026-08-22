import { Type } from "class-transformer";
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { FacilityType, UserRole, WaitlistAvailability, WaitlistProfessionalRole } from "@medshift/shared-types";

class WorkerWaitlistDetailsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsIn(Object.values(WaitlistProfessionalRole))
  clinicalRole?: WaitlistProfessionalRole;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsIn(Object.values(WaitlistAvailability))
  availability?: WaitlistAvailability;
}

class FacilityWaitlistDetailsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  facilityName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsIn(Object.values(FacilityType))
  facilityType?: FacilityType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  province?: string;
}

export class WaitlistSignupDto {
  @IsEmail()
  email!: string;

  @IsIn([UserRole.Worker, UserRole.Facility])
  role!: UserRole;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkerWaitlistDetailsDto)
  workerDetails?: WorkerWaitlistDetailsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FacilityWaitlistDetailsDto)
  facilityDetails?: FacilityWaitlistDetailsDto;
}
