# 批阅记录

- **源文件**：sprints_tasks.md
- **源文件路径**：/Users/ismailawa/Documents/Projects/med-shift/docs/sprints_tasks.md
- **源文件版本**：未知
- **批阅时间**：20260721_1310
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
  "fileName": "sprints_tasks.md",
  "docVersion": "未知",
  "reviewVersion": 1,
  "annotationCount": 0,
  "rawMarkdown": "# MedShift Project Sprints & Tasks\n\n## Sprint 1: Foundation & Infrastructure Setup\n**Goal**: Set up the Monorepo, database connections, and core architecture.\n\n### Story 1.1: Monorepo Setup\n- [ ] Initialize Nx or Turborepo for the project.\n- [ ] Setup `apps/api` (NestJS).\n- [ ] Setup `apps/web` (Next.js - Public/Worker/Facility).\n- [ ] Setup `apps/admin` (Next.js - Admin Dashboard).\n- [ ] Setup `packages/shared-types` (TypeScript interfaces/enums).\n- [ ] Setup `packages/ui-components` (React UI library).\n\n### Story 1.2: Database & Core Config\n- [ ] Configure MongoDB connection in NestJS (Mongoose).\n- [ ] Setup environment variables (`.env`) for DB, JWT, and Resend.\n- [ ] Implement base database schemas (Users, Profiles, Shifts, Reviews).\n\n## Sprint 2: Authentication & User Management\n**Goal**: Allow workers, facilities, and admins to register, login, and manage profiles.\n\n### Story 2.1: Authentication API (NestJS)\n- [ ] Implement JWT Auth module in NestJS.\n- [ ] Create Role-Based Access Control (RBAC) guards for WORKER, FACILITY, ADMIN.\n- [ ] Create login and registration endpoints.\n\n### Story 2.2: User Profiles\n- [ ] Create `WorkerProfile` CRUD endpoints (including GeoJSON location fields).\n- [ ] Create `FacilityProfile` CRUD endpoints (including GeoJSON location fields).\n- [ ] Build Frontend Registration/Login forms (Next.js).\n\n## Sprint 3: Shift Management (Facility Side)\n**Goal**: Facilities can create, update, and list their shifts.\n\n### Story 3.1: Shift API\n- [ ] Implement Shift CRUD endpoints in NestJS.\n- [ ] Enforce business rules (required fields: `roleRequired`, `startTime`, `endTime`, `hourlyRate`).\n\n### Story 3.2: Facility Dashboard UI\n- [ ] Build UI modal to post a new shift (Role dropdown, Date/Time picker).\n- [ ] Build Dashboard UI to list active and upcoming shifts.\n- [ ] Display dashboard metrics (fill times, active shifts).\n\n## Sprint 4: Matching Engine & Real-Time Communications\n**Goal**: Broadcast shifts in real-time and allow workers to accept them based on proximity.\n\n### Story 4.1: Geospatial Matching API\n- [ ] Implement `2dsphere` query in NestJS to find shifts near a worker's location.\n- [ ] Create endpoint for workers to browse open shifts in their designated radius.\n\n### Story 4.2: Real-time Socket.io Integration\n- [ ] Setup Socket.io Gateway in NestJS (`WebSocket` module).\n- [ ] Emit `shift.created` event when a facility posts a shift to nearby workers.\n- [ ] Emit `shift.accepted` event to the facility when a worker accepts.\n- [ ] Implement WebSocket client in Next.js.\n\n### Story 4.3: Worker Dashboard UI\n- [ ] Build UI for workers to browse shifts (List/Map view toggle).\n- [ ] Build detailed Shift Card UI.\n- [ ] Build UI and flow for \"Accept Shift\" button.\n\n## Sprint 5: Notifications & Admin Dashboard\n**Goal**: Send transactional emails and provide oversight tools for admins.\n\n### Story 5.1: Email Notifications\n- [ ] Integrate Resend API in a `NotificationModule`.\n- [ ] Send welcome emails upon waitlist/registration.\n- [ ] Send shift confirmation emails.\n\n### Story 5.2: Admin Dashboard\n- [ ] Build UI data tables to view all Users, Facilities, and Shifts.\n- [ ] Build UI for verifying Worker credentials (approve/reject documents).\n- [ ] Add system health charts (e.g., active socket connections, shift fulfillment rates).\n\n## Sprint 6: Reviews, Polish & Launch Prep\n**Goal**: Implement the dual-review system and finalize UI/UX.\n\n### Story 6.1: Review System\n- [ ] Implement Review endpoints (Facility rates Worker, Worker rates Facility).\n- [ ] Build UI for submitting ratings after a shift is completed.\n- [ ] Update worker/facility average rating calculations.\n\n### Story 6.2: Final UI Polish\n- [ ] Apply MedShift design system (Navy/Gold palette, Playfair/Poppins fonts).\n- [ ] Add glassmorphism effects and micro-animations to components.\n- [ ] Ensure mobile responsiveness across all portals, especially Worker app.\n- [ ] End-to-end user acceptance testing.\n",
  "annotations": []
}
```