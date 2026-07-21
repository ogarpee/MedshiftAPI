import { PartialType } from "@nestjs/mapped-types";
import { CreateWorkerProfileDto } from "./create-worker-profile.dto";

export class UpdateWorkerProfileDto extends PartialType(CreateWorkerProfileDto) {}
