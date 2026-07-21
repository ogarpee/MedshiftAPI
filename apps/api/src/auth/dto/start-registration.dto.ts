import { IsEmail } from "class-validator";

export class StartRegistrationDto {
  @IsEmail()
  email!: string;
}
