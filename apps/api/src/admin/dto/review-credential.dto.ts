import { IsBoolean } from "class-validator";

export class ReviewCredentialDto {
  @IsBoolean()
  approved!: boolean;
}
