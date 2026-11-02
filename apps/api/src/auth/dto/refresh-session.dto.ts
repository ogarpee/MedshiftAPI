import { IsOptional, IsString } from "class-validator";

export class RefreshSessionDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
