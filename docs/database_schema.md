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

### 2.2 Worker Profiles Collection
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
    documentUrl: String,
    isVerified: { type: Boolean, default: false },
    verifiedAt: Date
  }],
  backgroundCheck: {
    status: { type: String, enum: ['PENDING', 'PASSED', 'FAILED'], default: 'PENDING' },
    completedAt: Date
  },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number] // [longitude, latitude] for 2dsphere indexing
  },
  preferences: {
    maxDistanceKm: { type: Number, default: 25 },
    preferredFacilities: [{ type: ObjectId, ref: 'facility_profiles' }]
  },
  stats: {
    averageRating: { type: Number, default: 0 },
    totalShiftsCompleted: { type: Number, default: 0 }
  },
  createdAt: Date,
  updatedAt: Date
}
```

### 2.3 Facility Profiles Collection
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
    phone: String
  },
  billingStatus: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'INACTIVE' },
  stats: {
    averageRating: { type: Number, default: 0 }
  },
  createdAt: Date,
  updatedAt: Date
}
```

### 2.4 Shifts Collection
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

### 2.5 Reviews Collection
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

## 3. Database Indexes
To ensure performance and scalability, the following indexes are critical:
- **Geospatial**: `shifts.location` (2dsphere) - For finding shifts near a worker.
- **Geospatial**: `worker_profiles.location` (2dsphere) - For finding workers near a facility.
- **Compound**: `shifts.status` + `shifts.startTime` - For fast querying of open/upcoming shifts.
- **Unique**: `users.email` - For authentication.
- **Sparse**: `users.emailVerificationTokenHash` - For verifying and rotating pending email verification links without scanning users.
- **Sparse**: `users.passwordResetTokenHash` - For validating and rotating forgot-password reset links without scanning users.
- **Compound**: `users.emailVerified` + `users.status` - For admin filtering and account activation queues.
