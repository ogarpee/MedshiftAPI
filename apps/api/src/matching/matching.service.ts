import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model, PipelineStage, Types } from "mongoose";
import { BackgroundCheckStatus, OnboardingStatus, ShiftStatus, UserRole } from "@medshift/shared-types";
import { AuthUser } from "../auth/auth-user";
import { FacilityProfile, FacilityProfileDocument } from "../database/schemas/facility-profile.schema";
import { Shift, ShiftDocument } from "../database/schemas/shift.schema";
import { WorkerProfile, WorkerProfileDocument } from "../database/schemas/worker-profile.schema";
import { BrowseOpenShiftsDto } from "./dto/browse-open-shifts.dto";
import { SearchWorkersDto } from "./dto/search-workers.dto";

type MatchedShiftDocument = Shift & {
  _id: Types.ObjectId;
  distanceMeters?: number;
  facility?: FacilityProfile & { _id: Types.ObjectId };
};

type MatchedWorkerDocument = WorkerProfile & {
  _id: Types.ObjectId;
  distanceMeters?: number;
};

@Injectable()
export class MatchingService {
  constructor(
    @InjectModel(Shift.name) private readonly shifts: Model<ShiftDocument>,
    @InjectModel(FacilityProfile.name) private readonly facilityProfiles: Model<FacilityProfileDocument>,
    @InjectModel(WorkerProfile.name) private readonly workerProfiles: Model<WorkerProfileDocument>
  ) {}

  async browseOpenShifts(currentUser: AuthUser, dto: BrowseOpenShiftsDto) {
    const worker = await this.resolveWorker(currentUser.sub);
    const longitude = dto.longitude ?? worker.location.coordinates[0];
    const latitude = dto.latitude ?? worker.location.coordinates[1];
    const radiusKm = dto.radiusKm ?? worker.preferences.maxDistanceKm ?? 25;

    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      throw new BadRequestException("A worker location or query coordinates are required");
    }

    const match: FilterQuery<Shift> = {
      status: ShiftStatus.Open,
      startTime: { $gte: new Date() }
    };

    if (dto.roleRequired) {
      match.roleRequired = dto.roleRequired;
    }

    if (dto.maxShiftHours) {
      const maxDurationMs = dto.maxShiftHours * 60 * 60 * 1000;
      match.$expr = {
        $lte: [{ $subtract: ["$endTime", "$startTime"] }, maxDurationMs]
      };
    }

    if (dto.minHourlyRate !== undefined) {
      match.hourlyRate = { $gte: dto.minHourlyRate };
    }

    if (dto.startAfter || dto.startBefore) {
      match.startTime = {
        ...(match.startTime && typeof match.startTime === "object" ? match.startTime : {}),
        ...(dto.startAfter ? { $gte: new Date(dto.startAfter) } : {}),
        ...(dto.startBefore ? { $lte: new Date(dto.startBefore) } : {})
      };
    }

    const pipeline: PipelineStage[] = [
      {
        $geoNear: {
          near: { type: "Point", coordinates: [longitude, latitude] },
          distanceField: "distanceMeters",
          maxDistance: radiusKm * 1000,
          spherical: true,
          query: match
        }
      },
      {
        $lookup: {
          from: "facility_profiles",
          localField: "facilityId",
          foreignField: "_id",
          as: "facility"
        }
      },
      { $unwind: { path: "$facility", preserveNullAndEmptyArrays: true } }
    ];

    if (dto.facilityType) {
      pipeline.push({ $match: { "facility.facilityType": dto.facilityType } });
    }

    pipeline.push({ $sort: this.buildShiftSort(dto.sort) }, { $limit: 50 });

    const shifts = await this.shifts.aggregate<MatchedShiftDocument>(pipeline);

    return shifts.map((shift) => this.serializeShift(shift));
  }

  async searchWorkers(currentUser: AuthUser, dto: SearchWorkersDto) {
    const origin = await this.resolveWorkerSearchOrigin(currentUser, dto);
    const radiusKm = dto.radiusKm ?? 25;
    const limit = dto.limit ?? 50;
    const match: FilterQuery<WorkerProfile> = {
      "onboarding.verificationStatus": dto.verificationStatus ?? OnboardingStatus.Approved
    };

    if (dto.clinicalRole) {
      match.title = dto.clinicalRole;
    }

    if (dto.availableDay) {
      match["preferences.availableDays"] = dto.availableDay;
    }

    if (dto.shiftType) {
      match["preferences.preferredShiftTypes"] = dto.shiftType;
    }

    if (dto.minRating !== undefined) {
      match["stats.averageRating"] = { $gte: dto.minRating };
    }

    if (dto.backgroundCheckStatus) {
      match["backgroundCheck.status"] = dto.backgroundCheckStatus;
    }

    const workers = await this.workerProfiles.aggregate<MatchedWorkerDocument>([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [origin.longitude, origin.latitude] },
          distanceField: "distanceMeters",
          maxDistance: radiusKm * 1000,
          spherical: true,
          query: match
        }
      },
      { $sort: { distanceMeters: 1, "stats.averageRating": -1, "stats.totalShiftsCompleted": -1 } },
      { $limit: limit }
    ]);

    return workers.map((worker) => this.serializeWorkerResult(worker));
  }

  async findMatchingWorkerUserIdsForShift(payload: {
    location: { coordinates: [number, number]; type: "Point" };
    roleRequired: string;
  }) {
    const [longitude, latitude] = payload.location.coordinates;
    const workers = await this.workerProfiles.aggregate<MatchedWorkerDocument>([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [longitude, latitude] },
          distanceField: "distanceMeters",
          spherical: true,
          query: {
            "backgroundCheck.status": BackgroundCheckStatus.Passed,
            "onboarding.verificationStatus": OnboardingStatus.Approved,
            title: payload.roleRequired
          }
        }
      },
      {
        $match: {
          $expr: {
            $lte: [{ $divide: ["$distanceMeters", 1000] }, { $ifNull: ["$preferences.maxDistanceKm", 25] }]
          }
        }
      },
      { $limit: 100 }
    ]);

    return workers.map((worker) => worker.userId.toString());
  }

  private async resolveWorker(userId: string) {
    const worker = await this.workerProfiles.findOne({ userId: new Types.ObjectId(userId) }).exec();

    if (!worker) {
      throw new NotFoundException("Worker profile is required before browsing nearby shifts");
    }

    return worker;
  }

  private async resolveWorkerSearchOrigin(currentUser: AuthUser, dto: SearchWorkersDto) {
    if (dto.longitude !== undefined && dto.latitude !== undefined) {
      return { longitude: dto.longitude, latitude: dto.latitude };
    }

    if (currentUser.role === UserRole.Facility) {
      const facility = await this.facilityProfiles.findOne({ userId: new Types.ObjectId(currentUser.sub) }).exec();

      if (!facility) {
        throw new NotFoundException("Facility profile is required before searching workers");
      }

      return {
        longitude: facility.location.coordinates[0],
        latitude: facility.location.coordinates[1]
      };
    }

    if (currentUser.role === UserRole.Admin) {
      return { longitude: -114.0719, latitude: 51.0447 };
    }

    throw new ForbiddenException("Only facilities and admins can search workers");
  }

  private buildShiftSort(sort: BrowseOpenShiftsDto["sort"]): Record<string, 1 | -1> {
    if (sort === "START_TIME") {
      return { startTime: 1, distanceMeters: 1 };
    }

    if (sort === "HOURLY_RATE") {
      return { hourlyRate: -1, distanceMeters: 1, startTime: 1 };
    }

    return { distanceMeters: 1, startTime: 1 };
  }

  private serializeShift(object: MatchedShiftDocument) {
    return {
      ...object,
      id: object._id?.toString(),
      _id: undefined,
      facilityId: object.facilityId?.toString(),
      matchedWorkerId: object.matchedWorkerId?.toString(),
      distanceKm: typeof object.distanceMeters === "number" ? Math.round((object.distanceMeters / 1000) * 10) / 10 : undefined,
      facility: object.facility
        ? {
            id: object.facility._id?.toString(),
            name: object.facility.name,
            facilityType: object.facility.facilityType,
            address: object.facility.address,
            stats: object.facility.stats
          }
        : undefined
    };
  }

  private serializeWorkerResult(worker: MatchedWorkerDocument) {
    const verifiedCredentials = worker.credentials?.filter((credential) => credential.isVerified).length ?? 0;

    return {
      id: worker._id?.toString(),
      firstName: worker.firstName,
      lastName: worker.lastName,
      title: worker.title,
      distanceKm: typeof worker.distanceMeters === "number" ? Math.round((worker.distanceMeters / 1000) * 10) / 10 : undefined,
      location: worker.location,
      availability: {
        availableDays: worker.preferences?.availableDays ?? [],
        preferredShiftTypes: worker.preferences?.preferredShiftTypes ?? [],
        maxDistanceKm: worker.preferences?.maxDistanceKm ?? 25
      },
      credentials: {
        total: worker.credentials?.length ?? 0,
        verified: verifiedCredentials
      },
      backgroundCheckStatus: worker.backgroundCheck?.status,
      onboardingStatus: worker.onboarding?.verificationStatus ?? OnboardingStatus.Incomplete,
      stats: {
        averageRating: worker.stats?.averageRating ?? 0,
        totalShiftsCompleted: worker.stats?.totalShiftsCompleted ?? 0
      }
    };
  }
}
