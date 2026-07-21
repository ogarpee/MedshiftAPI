import { Type } from "class-transformer";
import { IsDate, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { ClinicalRole } from "@medshift/shared-types";
import { GeoPointDto } from "../../profiles/dto/geo-point.dto";

export class CreateShiftDto {
  @IsOptional()
  @IsMongoId()
  facilityId?: string;

  @IsEnum(ClinicalRole)
  roleRequired!: ClinicalRole;

  @Type(() => Date)
  @IsDate()
  startTime!: Date;

  @Type(() => Date)
  @IsDate()
  endTime!: Date;

  @IsNumber()
  @Min(0)
  hourlyRate!: number;

  @ValidateNested()
  @Type(() => GeoPointDto)
  location!: GeoPointDto;

  @IsOptional()
  @IsString()
  description?: string;
}
