import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { UserRole } from "@medshift/shared-types";
import { AuthUser } from "../auth/auth-user";
import { FacilityProfile, FacilityProfileDocument } from "../database/schemas/facility-profile.schema";
import { CreateFacilityProfileDto } from "./dto/create-facility-profile.dto";
import { UpdateFacilityProfileDto } from "./dto/update-facility-profile.dto";

@Injectable()
export class FacilityProfilesService {
  constructor(
    @InjectModel(FacilityProfile.name)
    private readonly facilityProfiles: Model<FacilityProfileDocument>
  ) {}

  async create(currentUser: AuthUser, dto: CreateFacilityProfileDto) {
    const existingProfile = await this.facilityProfiles.exists({ userId: currentUser.sub });

    if (existingProfile) {
      throw new ConflictException("Facility profile already exists for this user");
    }

    const profile = await this.facilityProfiles.create({
      ...dto,
      userId: new Types.ObjectId(currentUser.sub)
    });

    return this.serialize(profile);
  }

  async findAll() {
    const profiles = await this.facilityProfiles.find().sort({ createdAt: -1 }).exec();

    return profiles.map((profile) => this.serialize(profile));
  }

  async findMe(currentUser: AuthUser) {
    const profile = await this.facilityProfiles.findOne({ userId: currentUser.sub }).exec();

    if (!profile) {
      throw new NotFoundException("Facility profile not found");
    }

    return this.serialize(profile);
  }

  async findOne(currentUser: AuthUser, id: string) {
    const profile = await this.findDocument(id);
    this.assertCanManage(currentUser, profile);

    return this.serialize(profile);
  }

  async update(currentUser: AuthUser, id: string, dto: UpdateFacilityProfileDto) {
    const profile = await this.findDocument(id);
    this.assertCanManage(currentUser, profile);
    profile.set(dto);

    return this.serialize(await profile.save());
  }

  async remove(currentUser: AuthUser, id: string) {
    const profile = await this.findDocument(id);
    this.assertCanManage(currentUser, profile);
    await profile.deleteOne();

    return { deleted: true };
  }

  private async findDocument(id: string): Promise<FacilityProfileDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException("Facility profile not found");
    }

    const profile = await this.facilityProfiles.findById(id).exec();

    if (!profile) {
      throw new NotFoundException("Facility profile not found");
    }

    return profile;
  }

  private assertCanManage(currentUser: AuthUser, profile: FacilityProfileDocument) {
    if (currentUser.role === UserRole.Admin) {
      return;
    }

    if (profile.userId.toString() !== currentUser.sub) {
      throw new ForbiddenException("You can only manage your own facility profile");
    }
  }

  private serialize(profile: FacilityProfileDocument) {
    const object = profile.toObject({ versionKey: false });

    return {
      ...object,
      id: profile.id,
      _id: undefined
    };
  }
}
