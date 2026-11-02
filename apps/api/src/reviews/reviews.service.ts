import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { ShiftStatus, UserRole } from "@medshift/shared-types";
import { AuthUser } from "../auth/auth-user";
import { FacilityProfile, FacilityProfileDocument } from "../database/schemas/facility-profile.schema";
import { Review, ReviewDocument } from "../database/schemas/review.schema";
import { ShiftAssignment, ShiftAssignmentDocument } from "../database/schemas/marketplace.schema";
import { Shift, ShiftDocument } from "../database/schemas/shift.schema";
import { WorkerProfile, WorkerProfileDocument } from "../database/schemas/worker-profile.schema";
import { CreateReviewDto } from "./dto/create-review.dto";

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private readonly reviews: Model<ReviewDocument>,
    @InjectModel(ShiftAssignment.name) private readonly assignments: Model<ShiftAssignmentDocument>,
    @InjectModel(Shift.name) private readonly shifts: Model<ShiftDocument>,
    @InjectModel(WorkerProfile.name) private readonly workerProfiles: Model<WorkerProfileDocument>,
    @InjectModel(FacilityProfile.name) private readonly facilityProfiles: Model<FacilityProfileDocument>
  ) {}

  async create(currentUser: AuthUser, shiftId: string, dto: CreateReviewDto) {
    const shift = await this.findCompletedShift(shiftId);
    const { assignment, revieweeId, target } = await this.resolveReviewTarget(currentUser, shift, dto.assignmentId);
    const duplicate = await this.reviews.exists({ assignmentId: assignment._id, reviewerId: currentUser.sub });

    if (duplicate) {
      throw new ConflictException("You have already reviewed this shift");
    }

    const review = await this.reviews.create({
      shiftId: shift._id,
      assignmentId: assignment._id,
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

    if (shift.status !== ShiftStatus.Completed) {
      throw new BadRequestException("Only completed shifts can be reviewed");
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

  private async resolveReviewTarget(currentUser: AuthUser, shift: ShiftDocument, assignmentId?: string) {
    const facility = await this.facilityProfiles.findById(shift.facilityId).exec();
    let assignment: ShiftAssignmentDocument | null = null;
    if (assignmentId) {
      if (!Types.ObjectId.isValid(assignmentId)) throw new NotFoundException("Assignment not found");
      assignment = await this.assignments.findOne({ _id: assignmentId, shiftId: shift._id }).exec();
    } else if (currentUser.role === UserRole.Worker) {
      const workerProfile = await this.workerProfiles.findOne({ userId: currentUser.sub }).exec();
      assignment = workerProfile ? await this.assignments.findOne({ shiftId: shift._id, workerId: workerProfile._id }).exec() : null;
    } else {
      const assignments = await this.assignments.find({ shiftId: shift._id }).limit(2).exec();
      if (assignments.length > 1) throw new BadRequestException("Choose the caregiver assignment to review");
      assignment = assignments[0] ?? null;
    }
    const worker = assignment ? await this.workerProfiles.findById(assignment.workerId).exec() : null;

    if (!facility || !worker || !assignment) {
      throw new NotFoundException("Review participants not found");
    }

    if (currentUser.role === UserRole.Facility && facility.userId.toString() === currentUser.sub) {
      return { assignment, revieweeId: worker.userId, target: "worker" as const };
    }

    if (currentUser.role === UserRole.Worker && worker.userId.toString() === currentUser.sub) {
      return { assignment, revieweeId: facility.userId, target: "facility" as const };
    }

    throw new ForbiddenException("You can only review shifts you participated in");
  }

  private async assertCanViewShiftReviews(currentUser: AuthUser, shift: ShiftDocument) {
    if (currentUser.role === UserRole.Admin) {
      return;
    }

    const facility = await this.facilityProfiles.findById(shift.facilityId).exec();
    const workerProfile = currentUser.role === UserRole.Worker ? await this.workerProfiles.findOne({ userId: currentUser.sub }).exec() : null;
    const workerAssignment = workerProfile ? await this.assignments.exists({ shiftId: shift._id, workerId: workerProfile._id }) : null;

    if (facility?.userId.toString() === currentUser.sub || workerAssignment) {
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
      assignmentId: object.assignmentId?.toString(),
      reviewerId: object.reviewerId.toString(),
      revieweeId: object.revieweeId.toString()
    };
  }
}
