# 批阅记录

- **源文件**：system_architecture.md
- **源文件路径**：/Users/ismailawa/Documents/Projects/med-shift/docs/system_architecture.md
- **源文件版本**：未知
- **批阅时间**：20260721_1313
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
  "fileName": "system_architecture.md",
  "docVersion": "未知",
  "reviewVersion": 1,
  "annotationCount": 0,
  "rawMarkdown": "# System Architecture Specification: MedShift\n\n## 1. Overview\nMedShift is built as a **Monorepo** to promote code sharing, maintainability, and consistency across the stack. The application consists of Next.js frontends (Public/Facility/Worker portals and Admin dashboard) and a NestJS backend API, powered by a MongoDB database.\n\nThe architecture adheres to **SOLID** principles, ensuring that components are modular, decoupled, and easily testable.\n\n## 2. High-Level Architecture Diagram\n```mermaid\ngraph TD\n    subgraph Frontends [Next.js Apps]\n        Web[Web Portal: Public, Worker, Facility]\n        Admin[Admin Dashboard]\n    end\n\n    subgraph Backend [NestJS API]\n        API_GW[API Gateway / Controllers]\n        Auth[Auth Service]\n        Shift[Shift Management Service]\n        Match[Matching Engine Service]\n        Notify[Notification Service]\n        WebSocket[Socket.io Gateway]\n    end\n\n    subgraph Data Layer\n        DB[(MongoDB)]\n        Redis[(Redis - Pub/Sub & Caching)]\n    end\n\n    subgraph External Services\n        Resend[Resend - Emails]\n        Maps[Geocoding/Maps API]\n    end\n\n    Web <-->|REST / GraphQL| API_GW\n    Web <-->|WebSocket| WebSocket\n    Admin <-->|REST| API_GW\n\n    API_GW --> Auth\n    API_GW --> Shift\n    API_GW --> Match\n    \n    Shift --> DB\n    Match --> DB\n    Match --> Notify\n    \n    WebSocket --> Redis\n    Notify --> Resend\n    Notify --> WebSocket\n```\n\n## 3. Monorepo Structure (Nx / Turborepo)\n```\nmedshift/\n├── apps/\n│   ├── web/               # Next.js: Public landing, Worker portal, Facility portal\n│   ├── admin/             # Next.js: Admin dashboard\n│   └── api/               # NestJS: Core backend services\n├── packages/\n│   ├── shared-types/      # TypeScript interfaces, enums shared across stack\n│   ├── ui-components/     # Reusable React components (Design System)\n│   └── utils/             # Shared validation, formatting utilities\n└── package.json\n```\n\n## 4. Backend Architecture (NestJS)\nThe NestJS application follows a strict modular and layered architecture to enforce SOLID principles.\n\n### Layered Approach\n1. **Controllers / Gateways (Interface Layer)**: Handle HTTP requests and WebSocket connections. Route data to services.\n2. **Services (Business Logic Layer)**: Contain the core business logic (e.g., Shift Matching). Single Responsibility Principle (SRP) is enforced by keeping services focused (e.g., `ShiftService` handles CRUD, `MatchingService` handles the algorithm).\n3. **Repositories (Data Access Layer)**: Abstract Mongoose/MongoDB interactions. Dependency Inversion Principle (DIP) is applied by depending on repository interfaces rather than concrete database implementations.\n\n### Core Modules\n- **`AuthModule`**: Handles JWT authentication, RBAC (Role-Based Access Control) for Workers, Facilities, and Admins.\n- **`UserModule`**: Manages user profiles, credentials, and background check statuses.\n- **`FacilityModule`**: Manages facility profiles, billing setup, and locations.\n- **`ShiftModule`**: Manages shift lifecycle (creation, publishing, completion, cancellation).\n- **`MatchingModule`**: Uses geospatial queries (MongoDB `$near`) and worker availability to find matches.\n- **`NotificationModule`**: Adapters for Email (Resend) and Real-time (Socket.io). Open/Closed Principle (OCP) applies here: new notification channels (e.g., SMS) can be added without modifying existing code.\n\n## 5. Frontend Architecture (Next.js)\n- **App Router & Server Components**: Leverages React Server Components (RSC) for initial page loads (SEO, performance) and Client Components for interactive pieces (e.g., Real-time shift boards).\n- **State Management**: React Query (for server state and caching) and Zustand/Context (for lightweight client state like UI toggles).\n- **Component Design**: \n  - Dumb/Presentational components in `packages/ui-components`.\n  - Smart/Container components in `apps/web/features/*`.\n\n## 6. Real-Time Infrastructure (Socket.io)\n- **Namespaces & Rooms**: Connections are organized by namespaces (e.g., `/shifts`) and rooms (e.g., `facility_123` or `geo_calgary`).\n- **Events**:\n  - `shift.created`: Broadcasted to qualified workers in the geographical area.\n  - `shift.accepted`: Notifies the facility immediately when a worker accepts.\n  - `worker.status_update`: Updates worker availability in real-time.\n",
  "annotations": []
}
```