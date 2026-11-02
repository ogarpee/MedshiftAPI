# Database Schema Specification: MedShift

## 1. Overview
MedShift uses **MongoDB** as its primary data store. The schema is designed to leverage MongoDB's document model, using references for highly relational data (like shifts and users) and embedded documents for data that is often read together. Geospatial indexing is utilized to enable rapid shift matching based on location.

## 2. Collections & Schemas

### 2.1 Users Collection
Stores authentication and base identity data for all platform users.

```javascript
// Collection: users
{
  _id: ObjectId,
  email: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['WORKER', 'FACILITY', 'ADMIN'], required: true },
  status: { type: String, enum: ['PENDING', 'ACTIVE', 'SUSPENDED'], default: 'PENDING' },
  emailVerified: { type: Boolean, default: false },
  emailVerifiedAt: Date,
  emailVerificationTokenHash: String,
  emailVerificationTokenExpiresAt: Date,
  emailVerificationSentAt: Date,
  passwordResetTokenHash: String,
  passwordResetTokenExpiresAt: Date,
  passwordResetSentAt: Date,
  passwordChangedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### 2.2 Registration Attempts Collection
Stores temporary OTP state before a user account is created.

```javascript
// Collection: registration_attempts
{
  _id: ObjectId,
  email: { type: String, unique: true, required: true },
  role: { type: String, enum: ['WORKER', 'FACILITY'], required: true },
  otpHash: { type: String, required: true },
  otpExpiresAt: Date,
  otpSentAt: Date,
  otpAttempts: { type: Number, default: 0 },
  verifiedAt: Date,
  completionTokenHash: String,
  completionTokenExpiresAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### 2.3 Worker Profiles Collection
Stores specific information about healthcare professionals.

```javascript
// Collection: worker_profiles
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'users', required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  avatarUrl: String,
  title: { type: String, enum: ['HCA', 'RN', 'LPN', 'PSW'], required: true }, // Healthcare Assistant, Registered Nurse, etc.
  credentials: [{
    type: { type: String },
    documentUrl: String, // Legacy compatibility only
    isVerified: { type: Boolean, default: false },
    verifiedAt: Date
  }],
  documents: [{
    id: String, // Stable document identifier
    category: { type: String, enum: ['GOVERNMENT_ID', 'PROFESSIONAL_CERTIFICATE', 'BACKGROUND_CHECK', 'OTHER'] },
    cloudinaryPublicId: String,
    resourceType: String,
    deliveryType: String, // authenticated for new private uploads
    version: Number,
    format: String,
    originalFilename: String,
    bytes: Number,
    uploadedAt: Date,
    verificationStatus: { type: String, enum: ['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'], default: 'PENDING' },
    reviewedAt: Date,
    reviewedBy: { type: ObjectId, ref: 'users' },
    rejectionReason: String,
    documentUrl: String // Legacy migrated documents only
  }],
  backgroundCheck: {
    status: { type: String, enum: ['PENDING', 'PASSED', 'FAILED'], default: 'PENDING' },
    consentedAt: Date, // Historical compatibility; no longer required or written
    completedAt: Date
  },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number] // [longitude, latitude] for 2dsphere indexing
  },
  preferences: {
    maxDistanceKm: { type: Number, default: 25 },
    availableDays: [{ type: String, enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] }],
    preferredShiftTypes: [{ type: String, enum: ['DAY', 'EVENING', 'NIGHT', 'WEEKEND'] }],
    preferredFacilities: [{ type: ObjectId, ref: 'facility_profiles' }]
  },
  onboarding: {
    completedAt: Date,
    verificationStatus: { type: String, enum: ['INCOMPLETE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'], default: 'INCOMPLETE' },
    rejectedReason: String
  },
  stats: {
    averageRating: { type: Number, default: 0 },
    totalShiftsCompleted: { type: Number, default: 0 }
  },
  createdAt: Date,
  updatedAt: Date
}
```

### 2.3.1 Worker Onboarding Drafts Collection

Stores resumable, unsubmitted worker onboarding state separately from the canonical worker profile.

```javascript
// Collection: worker_onboarding_drafts
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'users', required: true, unique: true },
  profileId: { type: ObjectId, ref: 'worker_profiles' },
  currentStep: { type: Number, min: 0, max: 4, default: 0 },
  schemaVersion: { type: Number, default: 1 },
  data: {
    firstName: String,
    lastName: String,
    title: String,
    location: { type: String, coordinates: [Number] },
    preferences: { maxDistanceKm: Number, availableDays: [String], preferredShiftTypes: [String] },
    documents: [WorkerDocumentMetadata]
  },
  createdAt: Date,
  updatedAt: Date
}
```

Draft documents must belong to the authenticated worker's private Cloudinary folder. `profileId` is resolved from `userId` by the API and is never trusted from a client payload. Drafts never alter onboarding verification status and are deleted only after a successful idempotent profile save or an explicit worker clear action. The unique `worker_profiles.userId` index, together with duplicate-key retry handling, guarantees one profile during simultaneous first submissions.

### 2.4 Facility Profiles Collection
Stores information about healthcare facilities posting shifts.

```javascript
// Collection: facility_profiles
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'users', required: true, unique: true },
  name: { type: String, required: true },
  facilityType: { type: String, enum: ['LONG_TERM_CARE', 'HOSPITAL', 'CLINIC', 'HOME_CARE'] },
  address: {
    street: String,
    city: String,
    province: String,
    postalCode: String,
    country: { type: String, default: 'CA' }
  },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number] // [longitude, latitude] for 2dsphere indexing
  },
  contactPerson: {
    name: String,
    phone: String,
    email: String
  },
  billingStatus: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'INACTIVE' },
  readiness: {
    billingContactEmail: String,
    paymentMethodLabel: String,
    staffingContactConfirmed: { type: Boolean, default: false },
    acceptedTermsAt: Date
  },
  onboarding: {
    completedAt: Date,
    verificationStatus: { type: String, enum: ['INCOMPLETE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'], default: 'INCOMPLETE' },
    rejectedReason: String
  },
  stats: {
    averageRating: { type: Number, default: 0 }
  },
  createdAt: Date,
  updatedAt: Date
}
```

### 2.5 Shifts Collection
The core operational data model representing a unit of work.

```javascript
// Collection: shifts
{
  _id: ObjectId,
  facilityId: { type: ObjectId, ref: 'facility_profiles', required: true },
  roleRequired: { type: String, enum: ['HCA', 'RN', 'LPN', 'PSW'], required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  hourlyRate: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['OPEN', 'MATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    default: 'OPEN' 
  },
  matchedWorkerId: { type: ObjectId, ref: 'worker_profiles', default: null },
  location: { // Denormalized for faster geospatial query filtering
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number] 
  },
  description: String,
  createdAt: Date,
  updatedAt: Date
}
```

### 2.6 Reviews Collection
Handles the dual-rating system (Facility rates Worker, Worker rates Facility).

```javascript
// Collection: reviews
{
  _id: ObjectId,
  shiftId: { type: ObjectId, ref: 'shifts', required: true },
  reviewerId: { type: ObjectId, ref: 'users', required: true },
  revieweeId: { type: ObjectId, ref: 'users', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: String,
  createdAt: Date
}
```

### 2.7 Waitlist Signups Collection
Stores early access signups from the public landing page and confirmation email status.

```javascript
// Collection: waitlist_signups
{
  _id: ObjectId,
  email: { type: String, required: true, lowercase: true, trim: true },
  role: { type: String, enum: ['WORKER', 'FACILITY'], required: true },
  workerDetails: {
    fullName: String,
    phone: String,
    clinicalRole: { type: String, enum: ['HEALTHCARE_AIDE', 'PERSONAL_SUPPORT_WORKER', 'OTHER'] },
    city: String,
    availability: { type: String, enum: ['DAYS', 'EVENINGS', 'NIGHTS', 'WEEKENDS', 'CASUAL', 'FLEXIBLE'] }
  },
  facilityDetails: {
    facilityName: String,
    phone: String,
    facilityType: { type: String, enum: ['LONG_TERM_CARE', 'SUPPORTIVE_LIVING', 'RETIREMENT_RESIDENCE', 'HOME_CARE', 'OTHER'] },
    city: String,
    province: String
  },
  confirmationEmailSentAt: Date,
  lastRequestedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### 2.8 Notifications Collection
Stores persisted in-app dashboard notifications for authenticated workers and facilities.

```javascript
// Collection: notifications
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'users', required: true },
  type: { type: String, enum: ['SHIFT_CREATED', 'SHIFT_ACCEPTED', 'ONBOARDING_APPROVED', 'ONBOARDING_REJECTED', 'REVIEW_AVAILABLE'], required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  href: String,
  metadata: Map<String, String>,
  readAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### 2.9 Sessions Collection
Revocable session records contain `userId`, `familyId`, `clientType`, a hashed rotating refresh token, refresh expiry, revocation/replacement fields, device metadata, and `lastUsedAt`. Indexes support active sessions by user and token-family reuse revocation.

### 2.10 Marketplace Collections
- `shift_applications`: one record per shift/worker with review and selection state.
- `shift_invitations`: one record per shift/worker with inviter and response state.
- `shift_assignments`: canonical staffing record per shift/worker, including confirmation/completion/cancellation timestamps.
- `attendance_events`: immutable idempotent clock/break events with optional GPS verification metadata.
- `timesheets`: one record per shift/worker with scheduled/actual times, break/worked minutes, review state, and notes.
- `disputes`: owned marketplace subject, opener, participant users, status, resolution, and timestamps.
- `audit_events`: actor, action, entity reference, and metadata for marketplace mutations.

`shifts.activeAssignmentCount` is the atomically reserved capacity count. `shifts.matchedWorkerId` remains only for legacy compatibility; new worker history and reviews resolve through assignments. `reviews.assignmentId` scopes one review per reviewer and caregiver assignment.

Open-shift text and multi-select filters are computed from existing shift and joined facility fields. Day, Evening, Night, and Weekend periods are derived from `startTime` in `America/Edmonton`; no additional persisted search or period fields are required.

The full relationship diagram and lifecycle traceability are maintained in `docs/launch_mvp_review.md`.

### 2.11 Notification Preferences And Two-Factor Security
- `notification_preferences`: unique `userId` plus per-category `{ inApp, email }` settings. Missing records default optional categories on; account/security remains always on.
- `two_factor_credentials`: unique `userId`, active `TOTP` or `EMAIL` method, encrypted TOTP material, hashed single-use recovery codes, and enrollment timestamps.
- `two_factor_challenges`: expiring login/setup challenge with method, purpose, attempt count, client type, optional hashed email code or encrypted pending TOTP secret, and consumption state. A TTL index removes expired challenges.
- `trusted_devices`: user-owned hashed token, client/device metadata, last usage, 30-day expiry, and revocation state. Raw trusted tokens are returned only once and never persisted.

## 3. Database Indexes
To ensure performance and scalability, the following indexes are critical:
- **Geospatial**: `shifts.location` (2dsphere) - For finding shifts near a worker.
- **Geospatial**: `worker_profiles.location` (2dsphere) - For finding workers near a facility.
- **Compound**: `shifts.status` + `shifts.startTime` - For fast querying of open/upcoming shifts.
- **Unique**: `users.email` - For authentication.
- **Unique**: `worker_onboarding_drafts.userId` - One resumable worker draft per authenticated user.
- **Sparse**: `users.emailVerificationTokenHash` - For verifying and rotating pending email verification links without scanning users.
- **Sparse**: `users.passwordResetTokenHash` - For validating and rotating forgot-password OTP codes without scanning users.
- **Compound**: `users.emailVerified` + `users.status` - For admin filtering and account activation queues.
- **Unique**: `registration_attempts.email` - For rotating a single active registration OTP attempt per email.
- **Sparse**: `registration_attempts.completionTokenHash` - For validating completed OTP registration sessions.
- **Unique Compound**: `waitlist_signups.email` + `waitlist_signups.role` - For idempotent public waitlist signups.
- **Compound**: `sessions.userId` + `sessions.revokedAt` + `sessions.refreshExpiresAt` - For active-session enforcement.
- **Unique Compound**: marketplace application, invitation, assignment, and timesheet `shiftId` + `workerId` pairs.
- **Compound**: `attendance_events.workerId` + `shiftId` + `occurredAt` - For ordered attendance validation.
- **Partial Unique Compound**: `reviews.assignmentId` + `reviewerId` - For multi-caregiver review uniqueness.
- **Migration**: The launch migration removes the obsolete global unique `reviews.shiftId + reviewerId` index. New reviews are assignment-scoped and protected by `assignmentId + reviewerId`, allowing a facility to review each caregiver assignment independently.
- **Unique**: `notification_preferences.userId` and `two_factor_credentials.userId` ensure one account configuration each.
- **TTL/Compound**: `two_factor_challenges.expiresAt`, `trusted_devices.expiresAt`, and `trusted_devices.userId + revokedAt + expiresAt` support challenge cleanup and active-device lists.
