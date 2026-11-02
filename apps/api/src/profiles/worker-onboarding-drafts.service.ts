import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { UserRole, VerificationDocumentStatus } from "@medshift/shared-types";
import { AuthUser } from "../auth/auth-user";
import { WorkerOnboardingDraft, WorkerOnboardingDraftDocument } from "../database/schemas/worker-onboarding-draft.schema";
import { WorkerProfile, WorkerProfileDocument } from "../database/schemas/worker-profile.schema";
import { SaveWorkerOnboardingDraftDto } from "./dto/save-worker-onboarding-draft.dto";

@Injectable()
export class WorkerOnboardingDraftsService {
  constructor(
    @InjectModel(WorkerOnboardingDraft.name) private readonly drafts: Model<WorkerOnboardingDraftDocument>,
    @InjectModel(WorkerProfile.name) private readonly workerProfiles: Model<WorkerProfileDocument>
  ) {}

  async findMine(currentUser: AuthUser) {
    const draft = await this.drafts.findOne({ userId: currentUser.sub }).exec();
    return draft ? this.serialize(draft) : null;
  }

  async saveMine(currentUser: AuthUser, dto: SaveWorkerOnboardingDraftDto) {
    if (currentUser.role !== UserRole.Worker) throw new BadRequestException("Worker onboarding drafts are only available to workers");
    const profile = await this.workerProfiles.findOne({ userId: currentUser.sub }).exec();
    const data = this.normalizeData(currentUser, dto.data, profile ?? undefined);
    const draft = await this.drafts.findOneAndUpdate(
      { userId: currentUser.sub },
      {
        $set: {
          currentStep: dto.currentStep,
          data,
          profileId: profile?._id,
          schemaVersion: 1,
          userId: new Types.ObjectId(currentUser.sub)
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).exec();
    return this.serialize(draft);
  }

  async clearMine(currentUser: AuthUser) {
    await this.drafts.deleteOne({ userId: currentUser.sub }).exec();
    return { deleted: true };
  }

  private normalizeData(currentUser: AuthUser, source: SaveWorkerOnboardingDraftDto["data"], profile?: WorkerProfileDocument) {
    const documents = source.documents ?? [];
    if (documents.length > 10) throw new BadRequestException("A worker onboarding draft can contain at most 10 documents");
    const existingById = new Map(profile?.documents.map((document) => [document.id, document]) ?? []);
    const seen = new Set<string>();
    const normalizedDocuments = documents.map((document) => {
      if (seen.has(document.id)) throw new BadRequestException("Worker document IDs must be unique");
      seen.add(document.id);
      const existing = existingById.get(document.id);
      if (existing) return existing;
      if (!document.cloudinaryPublicId?.startsWith(`medshift/workers/${currentUser.sub}/`)) {
        throw new BadRequestException("Worker document upload is invalid");
      }
      if (!document.version || !document.format || !document.originalFilename || !document.bytes) {
        throw new BadRequestException("Worker document upload metadata is incomplete");
      }
      return { ...document, verificationStatus: VerificationDocumentStatus.Pending };
    });

    return {
      ...(source.firstName !== undefined ? { firstName: source.firstName } : {}),
      ...(source.lastName !== undefined ? { lastName: source.lastName } : {}),
      ...(source.title !== undefined ? { title: source.title } : {}),
      ...(source.location !== undefined ? { location: source.location } : {}),
      ...(source.preferences !== undefined ? { preferences: source.preferences } : {}),
      documents: normalizedDocuments
    };
  }

  private serialize(draft: WorkerOnboardingDraftDocument) {
    return {
      id: draft.id,
      profileId: draft.profileId?.toString() ?? null,
      currentStep: draft.currentStep,
      schemaVersion: draft.schemaVersion,
      data: draft.data,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt
    };
  }
}
