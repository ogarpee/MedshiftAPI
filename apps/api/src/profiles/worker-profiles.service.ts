import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { UserRole } from "@medshift/shared-types";
import { WorkerProfile, WorkerProfileDocument } from "../database/schemas/worker-profile.schema";
import { AuthUser } from "../auth/auth-user";
import { CreateWorkerProfileDto } from "./dto/create-worker-profile.dto";
import { UpdateWorkerProfileDto } from "./dto/update-worker-profile.dto";

@Injectable()
export class WorkerProfilesService {
  constructor(
    @InjectModel(WorkerProfile.name)
    private readonly workerProfiles: Model<WorkerProfileDocument>
  ) {}

  async create(currentUser: AuthUser, dto: CreateWorkerProfileDto) {
    const existingProfile = await this.workerProfiles.exists({ userId: currentUser.sub });

    if (existingProfile) {
      throw new ConflictException("Worker profile already exists for this user");
    }

    const profile = await this.workerProfiles.create({
      ...dto,
      userId: new Types.ObjectId(currentUser.sub)
    });

    return this.serialize(profile);
  }

  async findAll() {
    const profiles = await this.workerProfiles.find().sort({ createdAt: -1 }).exec();

    return profiles.map((profile) => this.serialize(profile));
  }

  async findMe(currentUser: AuthUser) {
    const profile = await this.workerProfiles.findOne({ userId: currentUser.sub }).exec();

    if (!profile) {
      throw new NotFoundException("Worker profile not found");
    }

    return this.serialize(profile);
  }

  async findOne(currentUser: AuthUser, id: string) {
    const profile = await this.findDocument(id);
    this.assertCanManage(currentUser, profile);

    return this.serialize(profile);
  }

  async update(currentUser: AuthUser, id: string, dto: UpdateWorkerProfileDto) {
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

  private async findDocument(id: string): Promise<WorkerProfileDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException("Worker profile not found");
    }

    const profile = await this.workerProfiles.findById(id).exec();

    if (!profile) {
      throw new NotFoundException("Worker profile not found");
    }

    return profile;
  }

  private assertCanManage(currentUser: AuthUser, profile: WorkerProfileDocument) {
    if (currentUser.role === UserRole.Admin) {
      return;
    }

    if (profile.userId.toString() !== currentUser.sub) {
      throw new ForbiddenException("You can only manage your own worker profile");
    }
  }

  private serialize(profile: WorkerProfileDocument) {
    const object = profile.toObject({ versionKey: false });

    return {
      ...object,
      id: profile.id,
      _id: undefined
    };
  }
}
