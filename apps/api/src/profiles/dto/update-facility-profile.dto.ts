import { PartialType } from "@nestjs/mapped-types";
import { CreateFacilityProfileDto } from "./create-facility-profile.dto";

export class UpdateFacilityProfileDto extends PartialType(CreateFacilityProfileDto) {}
