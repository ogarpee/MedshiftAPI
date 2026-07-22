import { IsBoolean, IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";

export class ReviewOnboardingDto {
  @IsBoolean()
  approved!: boolean;

  @ValidateIf((dto: ReviewOnboardingDto) => !dto.approved)
  @IsString()
  @MaxLength(280)
  rejectedReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}
