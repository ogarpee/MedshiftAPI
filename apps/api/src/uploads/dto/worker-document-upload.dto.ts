import { Type } from "class-transformer";
import { IsEnum, IsIn, IsInt, IsNumber, IsString, Max, Min } from "class-validator";
import { WorkerDocumentCategory } from "@medshift/shared-types";

export const workerDocumentMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const workerDocumentFormats = ["pdf", "jpg", "jpeg", "png", "webp"] as const;
export const maxWorkerDocumentBytes = 10 * 1024 * 1024;

export class SignWorkerDocumentUploadDto {
  @IsEnum(WorkerDocumentCategory)
  category!: WorkerDocumentCategory;

  @IsString()
  fileName!: string;

  @IsIn(workerDocumentMimeTypes)
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(maxWorkerDocumentBytes)
  sizeBytes!: number;
}

export class CompleteWorkerDocumentUploadDto {
  @IsEnum(WorkerDocumentCategory)
  category!: WorkerDocumentCategory;

  @IsString()
  publicId!: string;

  @IsString()
  resourceType!: string;

  @IsString()
  deliveryType!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  version!: number;

  @IsIn(workerDocumentFormats)
  format!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(maxWorkerDocumentBytes)
  bytes!: number;

  @IsString()
  originalFilename!: string;

  @IsString()
  signature!: string;
}
