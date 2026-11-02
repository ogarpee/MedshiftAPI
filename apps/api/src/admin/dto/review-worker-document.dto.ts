import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ReviewWorkerDocumentDto {
  @IsBoolean()
  approved!: boolean;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  rejectionReason?: string;
}
