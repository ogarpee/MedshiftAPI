import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { ShiftStatus, UserRole } from "@medshift/shared-types";
import { AuthUser } from "../auth/auth-user";
import { FacilityProfile, FacilityProfileDocument } from "../database/schemas/facility-profile.schema";
import { Review, ReviewDocument } from "../database/schemas/review.schema";
import { Shift, ShiftDocument } from "../database/schemas/shift.schema";
import { WorkerProfile, WorkerProfileDocument } from "../database/schemas/worker-profile.schema";
import { CreateReviewDto } from "./dto/create-review.dto";

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private readonly reviews: Model<ReviewDocument>,
    @InjectModel(Shift.name) private readonly shifts: Model<ShiftDocument>,
    @InjectModel(WorkerProfile.name) private readonly workerProfiles: Model<WorkerProfileDocument>,
    @InjectModel(FacilityProfile.name) private readonly facilityProfiles: Model<FacilityProfileDocument>
  ) {}

  async create(currentUser: AuthUser, shiftId: string, dto: CreateReviewDto) {
    const shift = await this.findCompletedShift(shiftId);
    const { revieweeId, target } = await this.resolveReviewTarget(currentUser, shift);
    const duplicate = await this.reviews.exists({ shiftId: shift._id, reviewerId: currentUser.sub });

    if (duplicate) {
      throw new ConflictException("You have already reviewed this shift");
    }

    const review = await this.reviews.create({
      shiftId: shift._id,
      reviewerId: new Types.ObjectId(currentUser.sub),
      revieweeId,
      rating: dto.rating,
      comment: dto.comment
    });

    await this.refreshAverageRating(target, revieweeId);

    return this.serialize(review);
  }

  async findForShift(currentUser: AuthUser, shiftId: string) {
    const shift = await this.findShift(shiftId);
    await this.assertCanViewShiftReviews(currentUser, shift);
    const reviews = await this.reviews.find({ shiftId: shift._id }).sort({ createdAt: -1 }).exec();

    return reviews.map((review) => this.serialize(review));
  }

  async findMine(currentUser: AuthUser) {
    const reviews = await this.reviews.find({ reviewerId: currentUser.sub }).sort({ createdAt: -1 }).exec();

    return reviews.map((review) => this.serialize(review));
  }

  private async findCompletedShift(id: string) {
    const shift = await this.findShift(id);

    if (shift.status !== ShiftStatus.Completed || !shift.matchedWorkerId) {
      throw new BadRequestException("Only completed matched shifts can be reviewed");
    }

    return shift;
  }

  private async findShift(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException("Shift not found");
    }

    const shift = await this.shifts.findById(id).exec();

    if (!shift) {
      throw new NotFoundException("Shift not found");
    }

    return shift;
  }

  private async resolveReviewTarget(currentUser: AuthUser, shift: ShiftDocument) {
    const facility = await this.facilityProfiles.findById(shift.facilityId).exec();
    const worker = shift.matchedWorkerId ? await this.workerProfiles.findById(shift.matchedWorkerId).exec() : null;

    if (!facility || !worker) {
      throw new NotFoundException("Review participants not found");
    }

    if (currentUser.role === UserRole.Facility && facility.userId.toString() === currentUser.sub) {
      return { revieweeId: worker.userId, target: "worker" as const };
    }

    if (currentUser.role === UserRole.Worker && worker.userId.toString() === currentUser.sub) {
      return { revieweeId: facility.userId, target: "facility" as const };
    }

    throw new ForbiddenException("You can only review shifts you participated in");
  }

  private async assertCanViewShiftReviews(currentUser: AuthUser, shift: ShiftDocument) {
    if (currentUser.role === UserRole.Admin) {
      return;
    }

    const facility = await this.facilityProfiles.findById(shift.facilityId).exec();
    const worker = shift.matchedWorkerId ? await this.workerProfiles.findById(shift.matchedWorkerId).exec() : null;

    if (facility?.userId.toString() === currentUser.sub || worker?.userId.toString() === currentUser.sub) {
      return;
    }

    throw new ForbiddenException("You can only view reviews for your own shifts");
  }

  private async refreshAverageRating(target: "worker" | "facility", revieweeId: Types.ObjectId) {
    const aggregate = await this.reviews.aggregate<{ averageRating: number }>([
      { $match: { revieweeId } },
      { $group: { _id: "$revieweeId", averageRating: { $avg: "$rating" } } }
    ]);
    const averageRating = aggregate[0]?.averageRating ? Math.round(aggregate[0].averageRating * 10) / 10 : 0;

    if (target === "worker") {
      await this.workerProfiles.updateOne({ userId: revieweeId }, { $set: { "stats.averageRating": averageRating } }).exec();
      return;
    }

    await this.facilityProfiles.updateOne({ userId: revieweeId }, { $set: { "stats.averageRating": averageRating } }).exec();
  }

  private serialize(review: ReviewDocument) {
    const object = review.toObject({ versionKey: false });

    return {
      ...object,
      id: review.id,
      _id: undefined,
      shiftId: object.shiftId.toString(),
      reviewerId: object.reviewerId.toString(),
      revieweeId: object.revieweeId.toString()
    };
  }
}
