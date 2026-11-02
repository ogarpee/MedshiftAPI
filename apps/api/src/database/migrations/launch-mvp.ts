import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ShiftAssignmentStatus, ShiftStatus } from "@medshift/shared-types";
import { createConnection } from "mongoose";
import { ShiftAssignment, ShiftAssignmentSchema } from "../schemas/marketplace.schema";
import { Review, ReviewSchema } from "../schemas/review.schema";
import { Shift, ShiftSchema } from "../schemas/shift.schema";

async function migrateLaunchMvp() {
  loadEnvFiles();
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("Missing MONGODB_URI.");
  const dryRun = process.argv.includes("--dry-run");
  const connection = await createConnection(mongoUri).asPromise();
  const shifts = connection.model(Shift.name, ShiftSchema);
  const assignments = connection.model(ShiftAssignment.name, ShiftAssignmentSchema);
  const reviews = connection.model(Review.name, ReviewSchema);
  const legacyShifts = await shifts.find({ matchedWorkerId: { $ne: null } }).exec();
  let assignmentsCreated = 0;
  let reviewsLinked = 0;
  const unresolvedReviews: string[] = [];
  let obsoleteReviewIndexRemoved = false;

  for (const shift of legacyShifts) {
    if (!shift.matchedWorkerId) continue;
    const existing = await assignments.findOne({ shiftId: shift._id, workerId: shift.matchedWorkerId }).exec();
    if (!existing) {
      assignmentsCreated += 1;
      if (!dryRun) {
        await assignments.create({
          shiftId: shift._id,
          workerId: shift.matchedWorkerId,
          status: shift.status === ShiftStatus.Completed ? ShiftAssignmentStatus.Completed : ShiftAssignmentStatus.Confirmed,
          confirmedAt: shift.filledAt ?? shift.get("updatedAt") ?? new Date(),
          completedAt: shift.status === ShiftStatus.Completed ? shift.get("updatedAt") ?? new Date() : undefined
        });
      }
    }
  }

  const allShifts = await shifts.find().exec();
  for (const shift of allShifts) {
    const shiftAssignments = await assignments.find({ shiftId: shift._id, status: { $nin: [ShiftAssignmentStatus.Cancelled, ShiftAssignmentStatus.NoShow] } }).exec();
    const mappedStatus = mapLegacyStatus(shift.status);
    if (!dryRun) {
      await shifts.updateOne({ _id: shift._id }, { $set: { activeAssignmentCount: shiftAssignments.length, status: mappedStatus } }).exec();
    }
    const legacyReviews = await reviews.find({ shiftId: shift._id, assignmentId: { $exists: false } }).exec();
    for (const review of legacyReviews) {
      const assignment = shiftAssignments.find((candidate) => candidate.workerId.equals(shift.matchedWorkerId));
      if (!assignment) {
        unresolvedReviews.push(review.id);
        continue;
      }
      reviewsLinked += 1;
      if (!dryRun) await reviews.updateOne({ _id: review._id }, { $set: { assignmentId: assignment._id } }).exec();
    }
  }

  const reviewIndexes = await reviews.collection.indexes();
  const obsoleteReviewIndex = reviewIndexes.find(
    (index) =>
      index.unique === true &&
      index.key.shiftId === 1 &&
      index.key.reviewerId === 1 &&
      !index.partialFilterExpression
  );
  obsoleteReviewIndexRemoved = Boolean(obsoleteReviewIndex);
  if (!dryRun && obsoleteReviewIndex?.name) {
    await reviews.collection.dropIndex(obsoleteReviewIndex.name);
  }

  await connection.close();
  console.log(
    JSON.stringify(
      { dryRun, shiftsScanned: allShifts.length, assignmentsCreated, reviewsLinked, unresolvedReviews, obsoleteReviewIndexRemoved },
      null,
      2
    )
  );
}

function mapLegacyStatus(status: ShiftStatus): ShiftStatus {
  if (new Set<ShiftStatus>([ShiftStatus.Matched, ShiftStatus.Upcoming]).has(status)) return ShiftStatus.Assigned;
  if (new Set<ShiftStatus>([ShiftStatus.Published, ShiftStatus.Matching]).has(status)) return ShiftStatus.Open;
  return status;
}

function loadEnvFiles() {
  for (const path of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env"), join(__dirname, "../../../../.env")]) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const separator = trimmed.indexOf("=");
      const key = trimmed.slice(0, separator).trim();
      if (!process.env[key]) process.env[key] = trimmed.slice(separator + 1).trim();
    }
  }
}

void migrateLaunchMvp().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
