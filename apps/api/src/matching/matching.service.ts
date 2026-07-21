import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model, PipelineStage, Types } from "mongoose";
import { ShiftStatus } from "@medshift/shared-types";
import { AuthUser } from "../auth/auth-user";
import { FacilityProfile } from "../database/schemas/facility-profile.schema";
import { Shift, ShiftDocument } from "../database/schemas/shift.schema";
import { WorkerProfile, WorkerProfileDocument } from "../database/schemas/worker-profile.schema";
import { BrowseOpenShiftsDto } from "./dto/browse-open-shifts.dto";

type MatchedShiftDocument = Shift & {
  _id: Types.ObjectId;
  distanceMeters?: number;
  facility?: FacilityProfile & { _id: Types.ObjectId };
};

@Injectable()
export class MatchingService {
  constructor(
    @InjectModel(Shift.name) private readonly shifts: Model<ShiftDocument>,
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

    pipeline.push({ $sort: { distanceMeters: 1, startTime: 1 } }, { $limit: 50 });

    const shifts = await this.shifts.aggregate<MatchedShiftDocument>(pipeline);

    return shifts.map((shift) => this.serializeShift(shift));
  }

  private async resolveWorker(userId: string) {
    const worker = await this.workerProfiles.findOne({ userId: new Types.ObjectId(userId) }).exec();

    if (!worker) {
      throw new NotFoundException("Worker profile is required before browsing nearby shifts");
    }

    return worker;
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
}
