# 批阅记录

- **源文件**：ui_ux_specification.md
- **源文件路径**：/Users/ismailawa/Documents/Projects/med-shift/docs/ui_ux_specification.md
- **源文件版本**：未知
- **批阅时间**：20260721_1238
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
  "fileName": "ui_ux_specification.md",
  "docVersion": "未知",
  "reviewVersion": 1,
  "annotationCount": 0,
  "rawMarkdown": "# UI/UX Specification: MedShift\n\n## 1. Design System & Brand Identity\nThe UI is designed to evoke trust, professionalism, and premium quality, aligning with the \"Right Care. Right When It Matters\" mission.\n\n### 1.1 Typography\n- **Headings & Display**: `Playfair Display` (Serif). Used to convey a premium, trustworthy, and established feel. (Weights: 700, 900)\n- **Body & Interface Text**: `Poppins` (Sans-serif). Clean, highly legible, and modern for dashboards and data-heavy interfaces. (Weights: 300, 400, 500, 600, 700)\n\n### 1.2 Color Palette\nDerived from the MedShift marketing site:\n- **Primary / Backgrounds**: Navy (`#0B1F3A`) - Trust, stability, professionalism.\n- **Accents / CTAs**: Gold (`#D4AF37`) and Light Gold (`#F5D98C`) - Excellence, premium service.\n- **Text & Contrast**: Dark (`#1C1C1C`) for main text, White (`#FFFFFF`) for dark-mode text and cards.\n- **Backgrounds / Cards**: Off-White (`#F8F6F1`) for gentle contrast against pure white backgrounds.\n- **Muted Text**: Text-Muted (`#6B7280`) for secondary information.\n- **Success / Status**: Green (`#4ade80` with `rgba(34,197,94,0.2)` background) for \"Available\" or \"Matched\" statuses.\n\n## 2. Shared Components\n\n### 2.1 Buttons\n- **Primary Button**: Solid Gold background (`#D4AF37`), Navy text (`#0B1F3A`). Bold Poppins font, 8px border-radius. Hover state: Light Gold with a slight upward translation (`translateY(-2px)`) and a soft gold shadow.\n- **Secondary Button**: Transparent background, White/Navy border. Hover state: Border and text turn Gold.\n\n### 2.2 Cards & Containers\n- **Shift Cards**: Used for displaying open/upcoming shifts. \n  - Glassmorphism effect on dark backgrounds (`rgba(255,255,255,0.05)`, backdrop blur).\n  - Clean borders (`1px solid rgba(212,175,55,0.2)`).\n  - Micro-animations: Slight float or translation on hover.\n- **Avatars**: Circular, utilizing Gold/Light Gold gradients for placeholders containing user initials.\n\n### 2.3 Status Badges\n- Capsule-shaped (`border-radius: 100px`), small font size (`0.7rem`), bold uppercase text.\n- Used to indicate shift status (OPEN, MATCHED, COMPLETED) or worker availability.\n\n## 3. Core User Journeys & Wireframe Specs\n\n### 3.1 Healthcare Professional (Worker) Portal\n**Design Goal**: Mobile-first, extremely fast, focused on discovering and accepting shifts with minimal friction.\n\n1. **Dashboard / Shift Board**:\n   - **Header**: User profile summary, current earnings, upcoming shift reminder.\n   - **Map/List Toggle**: View available shifts as a list of cards or pins on a map.\n   - **Shift Card UI**: Displays Facility Name, Role, Date & Time, Location, and Hourly Rate.\n2. **Shift Details View**:\n   - Full-page modal or detailed view.\n   - Prominent \"Accept Shift\" primary button.\n   - Includes facility rating and map preview.\n3. **Profile & Credentials**:\n   - Status indicators for credential verification (Pending vs. Verified).\n\n### 3.2 Healthcare Facility Portal\n**Design Goal**: Desktop-optimized, clear oversight of staffing needs, focus on rapid shift creation.\n\n1. **Dashboard / Roster**:\n   - **Metrics Bar**: Average fill time, active shifts, upcoming shifts.\n   - **Active Shifts Table/Grid**: Displays current shifts and matching status. Real-time updates push new worker matches to the top.\n2. **Post a Shift Modal**:\n   - Streamlined form: Select Role, Date/Time picker, add optional description.\n   - 1-click \"Publish to Network\" action.\n3. **Worker Match View**:\n   - When a worker accepts, facility views a concise \"Worker Profile Card\" (Avatar, Name, Role, Rating).\n\n### 3.3 Admin Dashboard\n**Design Goal**: Data-dense, analytical, focused on moderation and platform health.\n\n- **Data Tables**: Paginated, sortable tables for Users, Facilities, and Shifts.\n- **Verification Queue**: Dedicated UI for admins to review uploaded worker credentials (PDF/Image viewer alongside approval/rejection buttons).\n- **System Health**: Real-time charts showing shift fulfillment rates and Socket.io active connections.\n\n## 4. Interaction & Motion Design\n- **Transitions**: Smooth, fast fade-ins and slide-ups (`0.2s` to `0.3s` ease) for modals and page routing to make the app feel snappy.\n- **Real-Time Feedback**: When a shift is matched, use subtle visual cues (e.g., a brief flash of success green or a toast notification) via Socket.io events.\n",
  "annotations": []
}
```