import { ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { Model, Types } from "mongoose";
import { UserRole, VerificationDocumentStatus } from "@medshift/shared-types";
import { AuthUser } from "../auth/auth-user";
import { WorkerProfile, WorkerProfileDocument } from "../database/schemas/worker-profile.schema";
import { WorkerOnboardingDraft, WorkerOnboardingDraftDocument } from "../database/schemas/worker-onboarding-draft.schema";
import { CompleteWorkerDocumentUploadDto, SignWorkerDocumentUploadDto } from "./dto/worker-document-upload.dto";

@Injectable()
export class UploadsService {
  private readonly cloudName?: string;
  private readonly apiKey?: string;
  private readonly apiSecret?: string;

  constructor(
    config: ConfigService,
    @InjectModel(WorkerProfile.name) private readonly workerProfiles: Model<WorkerProfileDocument>,
    @InjectModel(WorkerOnboardingDraft.name) private readonly onboardingDrafts: Model<WorkerOnboardingDraftDocument>
  ) {
    this.cloudName = config.get<string>("CLOUDINARY_CLOUD_NAME") ?? config.get<string>("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME");
    this.apiKey = config.get<string>("CLOUDINARY_API_KEY");
    this.apiSecret = config.get<string>("CLOUDINARY_API_SECRET");
    if (this.cloudName && this.apiKey && this.apiSecret) {
      cloudinary.config({ cloud_name: this.cloudName, api_key: this.apiKey, api_secret: this.apiSecret, secure: true });
    }
  }

  signWorkerDocument(currentUser: AuthUser, dto: SignWorkerDocumentUploadDto) {
    this.assertConfigured();
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `medshift/workers/${currentUser.sub}`;
    const publicId = randomUUID();
    const deliveryType = "authenticated";
    const params = { folder, public_id: publicId, timestamp, type: deliveryType };

    return {
      apiKey: this.apiKey,
      category: dto.category,
      cloudName: this.cloudName,
      deliveryType,
      folder,
      publicId: `${folder}/${publicId}`,
      uploadPublicId: publicId,
      signature: cloudinary.utils.api_sign_request(params, this.apiSecret!),
      timestamp,
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.cloudName}/auto/upload`
    };
  }

  completeWorkerDocument(currentUser: AuthUser, dto: CompleteWorkerDocumentUploadDto) {
    this.assertConfigured();
    const prefix = `medshift/workers/${currentUser.sub}/`;
    if (!dto.publicId.startsWith(prefix) || dto.deliveryType !== "authenticated") {
      throw new UnauthorizedException("The uploaded document does not belong to this worker");
    }

    const expected = cloudinary.utils.api_sign_request({ public_id: dto.publicId, version: dto.version }, this.apiSecret!);
    if (!safeEqual(expected, dto.signature)) {
      throw new UnauthorizedException("Cloudinary upload verification failed");
    }

    return {
      id: randomUUID(),
      category: dto.category,
      cloudinaryPublicId: dto.publicId,
      resourceType: dto.resourceType,
      deliveryType: dto.deliveryType,
      version: dto.version,
      format: dto.format,
      originalFilename: dto.originalFilename,
      bytes: dto.bytes,
      uploadedAt: new Date().toISOString(),
      verificationStatus: VerificationDocumentStatus.Pending
    };
  }

  async accessWorkerDocument(currentUser: AuthUser, workerId: string, documentId: string) {
    if (!Types.ObjectId.isValid(workerId)) throw new NotFoundException("Worker profile not found");
    this.assertConfigured();
    const worker = await this.workerProfiles.findById(workerId).exec();
    if (!worker) throw new NotFoundException("Worker profile not found");
    if (currentUser.role !== UserRole.Admin && worker.userId.toString() !== currentUser.sub) {
      throw new ForbiddenException("You cannot access this worker document");
    }
    const document = worker.documents.find((item) => item.id === documentId);
    if (!document) throw new NotFoundException("Worker document not found");
    return this.buildAccessUrl(document);
  }

  async accessOwnWorkerDocument(currentUser: AuthUser, documentId: string) {
    this.assertConfigured();
    const [profile, draft] = await Promise.all([
      this.workerProfiles.findOne({ userId: currentUser.sub }).exec(),
      this.onboardingDrafts.findOne({ userId: currentUser.sub }).exec()
    ]);
    const profileDocument = profile?.documents.find((item) => item.id === documentId);
    const draftDocuments = Array.isArray(draft?.data?.documents) ? draft.data.documents : [];
    const draftDocument = draftDocuments.find((item) => isDraftDocument(item) && item.id === documentId);
    const document = draftDocument ?? profileDocument;
    if (!document) throw new NotFoundException("Worker document not found");
    return this.buildAccessUrl(document);
  }

  private buildAccessUrl(document: WorkerDocumentAsset) {
    if (document.documentUrl && !document.cloudinaryPublicId) return { expiresInSeconds: 300, url: document.documentUrl };
    if (!document.cloudinaryPublicId || !document.format) throw new NotFoundException("Worker document asset is unavailable");
    return {
      expiresInSeconds: 300,
      url: cloudinary.utils.private_download_url(document.cloudinaryPublicId, document.format, {
        expires_at: Math.floor(Date.now() / 1000) + 300,
        resource_type: document.resourceType ?? "image",
        type: document.deliveryType ?? "authenticated"
      })
    };
  }

  private assertConfigured() {
    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      throw new ServiceUnavailableException("Private Cloudinary document uploads are not configured");
    }
  }
}

type WorkerDocumentAsset = {
  documentUrl?: string;
  cloudinaryPublicId?: string;
  format?: string;
  resourceType?: string;
  deliveryType?: string;
};

function isDraftDocument(value: unknown): value is WorkerDocumentAsset & { id: string } {
  return Boolean(value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
