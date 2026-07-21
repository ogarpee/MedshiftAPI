# 批阅记录

- **源文件**：database_schema.md
- **源文件路径**：/Users/ismailawa/Documents/Projects/med-shift/docs/database_schema.md
- **源文件版本**：未知
- **批阅时间**：20260721_1237
- **批阅版本**：v1
- **批注数量**：0
  - 评论：0
  - 删除：0
  - 后插：0
  - 前插：0

---

## 操作指令

> 指令已按**从后往前**排列（倒序），请严格按照顺序从上到下逐条执行。
> 每条指令提供了「文本锚点」用于精确定位，请优先通过锚点文本匹配来确认目标位置，blockIndex 仅作辅助参考。

---

## 原始数据（JSON）

> 如需精确操作，可使用以下 JSON 数据。其中 `blockIndex` 是基于空行分割的块索引（从0开始），`startOffset` 是目标文本在块内的字符偏移量（从0开始），可用于区分同一块内的重复文本。

```json
{
  "fileName": "database_schema.md",
  "docVersion": "未知",
  "reviewVersion": 1,
  "annotationCount": 0,
  "rawMarkdown": "# Database Schema Specification: MedShift\n\n## 1. Overview\nMedShift uses **MongoDB** as its primary data store. The schema is designed to leverage MongoDB's document model, using references for highly relational data (like shifts and users) and embedded documents for data that is often read together. Geospatial indexing is utilized to enable rapid shift matching based on location.\n\n## 2. Collections & Schemas\n\n### 2.1 Users Collection\nStores authentication and base identity data for all platform users.\n\n```javascript\n// Collection: users\n{\n  _id: ObjectId,\n  email: { type: String, unique: true, required: true },\n  passwordHash: { type: String, required: true },\n  role: { type: String, enum: ['WORKER', 'FACILITY', 'ADMIN'], required: true },\n  status: { type: String, enum: ['PENDING', 'ACTIVE', 'SUSPENDED'], default: 'PENDING' },\n  createdAt: Date,\n  updatedAt: Date\n}\n```\n\n### 2.2 Worker Profiles Collection\nStores specific information about healthcare professionals.\n\n```javascript\n// Collection: worker_profiles\n{\n  _id: ObjectId,\n  userId: { type: ObjectId, ref: 'users', required: true, unique: true },\n  firstName: { type: String, required: true },\n  lastName: { type: String, required: true },\n  avatarUrl: String,\n  title: { type: String, enum: ['HCA', 'RN', 'LPN', 'PSW'], required: true }, // Healthcare Assistant, Registered Nurse, etc.\n  credentials: [{\n    type: { type: String },\n    documentUrl: String,\n    isVerified: { type: Boolean, default: false },\n    verifiedAt: Date\n  }],\n  backgroundCheck: {\n    status: { type: String, enum: ['PENDING', 'PASSED', 'FAILED'], default: 'PENDING' },\n    completedAt: Date\n  },\n  location: {\n    type: { type: String, enum: ['Point'], default: 'Point' },\n    coordinates: [Number] // [longitude, latitude] for 2dsphere indexing\n  },\n  preferences: {\n    maxDistanceKm: { type: Number, default: 25 },\n    preferredFacilities: [{ type: ObjectId, ref: 'facility_profiles' }]\n  },\n  stats: {\n    averageRating: { type: Number, default: 0 },\n    totalShiftsCompleted: { type: Number, default: 0 }\n  },\n  createdAt: Date,\n  updatedAt: Date\n}\n```\n\n### 2.3 Facility Profiles Collection\nStores information about healthcare facilities posting shifts.\n\n```javascript\n// Collection: facility_profiles\n{\n  _id: ObjectId,\n  userId: { type: ObjectId, ref: 'users', required: true, unique: true },\n  name: { type: String, required: true },\n  facilityType: { type: String, enum: ['LONG_TERM_CARE', 'HOSPITAL', 'CLINIC', 'HOME_CARE'] },\n  address: {\n    street: String,\n    city: String,\n    province: String,\n    postalCode: String,\n    country: { type: String, default: 'CA' }\n  },\n  location: {\n    type: { type: String, enum: ['Point'], default: 'Point' },\n    coordinates: [Number] // [longitude, latitude] for 2dsphere indexing\n  },\n  contactPerson: {\n    name: String,\n    phone: String\n  },\n  billingStatus: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'INACTIVE' },\n  stats: {\n    averageRating: { type: Number, default: 0 }\n  },\n  createdAt: Date,\n  updatedAt: Date\n}\n```\n\n### 2.4 Shifts Collection\nThe core operational data model representing a unit of work.\n\n```javascript\n// Collection: shifts\n{\n  _id: ObjectId,\n  facilityId: { type: ObjectId, ref: 'facility_profiles', required: true },\n  roleRequired: { type: String, enum: ['HCA', 'RN', 'LPN', 'PSW'], required: true },\n  startTime: { type: Date, required: true },\n  endTime: { type: Date, required: true },\n  hourlyRate: { type: Number, required: true },\n  status: { \n    type: String, \n    enum: ['OPEN', 'MATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],\n    default: 'OPEN' \n  },\n  matchedWorkerId: { type: ObjectId, ref: 'worker_profiles', default: null },\n  location: { // Denormalized for faster geospatial query filtering\n    type: { type: String, enum: ['Point'], default: 'Point' },\n    coordinates: [Number] \n  },\n  description: String,\n  createdAt: Date,\n  updatedAt: Date\n}\n```\n\n### 2.5 Reviews Collection\nHandles the dual-rating system (Facility rates Worker, Worker rates Facility).\n\n```javascript\n// Collection: reviews\n{\n  _id: ObjectId,\n  shiftId: { type: ObjectId, ref: 'shifts', required: true },\n  reviewerId: { type: ObjectId, ref: 'users', required: true },\n  revieweeId: { type: ObjectId, ref: 'users', required: true },\n  rating: { type: Number, min: 1, max: 5, required: true },\n  comment: String,\n  createdAt: Date\n}\n```\n\n## 3. Database Indexes\nTo ensure performance and scalability, the following indexes are critical:\n- **Geospatial**: `shifts.location` (2dsphere) - For finding shifts near a worker.\n- **Geospatial**: `worker_profiles.location` (2dsphere) - For finding workers near a facility.\n- **Compound**: `shifts.status` + `shifts.startTime` - For fast querying of open/upcoming shifts.\n- **Unique**: `users.email` - For authentication.\n",
  "annotations": []
}
```