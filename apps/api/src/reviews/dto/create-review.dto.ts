import { IsInt, IsMongoId, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class CreateReviewDto {
  @IsOptional()
  @IsMongoId()
  assignmentId?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  comment?: string;
}
