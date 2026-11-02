import { PartialType } from "@nestjs/mapped-types";
import { Type } from "class-transformer";
import { IsInt, IsObject, Max, Min, ValidateNested } from "class-validator";
import { CreateWorkerProfileDto } from "./create-worker-profile.dto";

export class WorkerOnboardingDraftDataDto extends PartialType(CreateWorkerProfileDto) {}

export class SaveWorkerOnboardingDraftDto {
  @IsInt()
  @Min(0)
  @Max(4)
  currentStep!: number;

  @IsObject()
  @ValidateNested()
  @Type(() => WorkerOnboardingDraftDataDto)
  data!: WorkerOnboardingDraftDataDto;
}
