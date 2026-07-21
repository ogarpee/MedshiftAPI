# 批阅记录

- **源文件**：prd.md
- **源文件路径**：/Users/ismailawa/Documents/Projects/med-shift/docs/prd.md
- **源文件版本**：未知
- **批阅时间**：20260721_1312
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
  "fileName": "prd.md",
  "docVersion": "未知",
  "reviewVersion": 1,
  "annotationCount": 0,
  "rawMarkdown": "# Product Requirements Document (PRD): MedShift\n\n## 1. Product Overview\n**Name**: MedShift\n**Tagline**: \"The Right Care. Right When It Matters.\" / \"Fill Shifts. Change Lives.\"\n**Mission**: To connect healthcare professionals with facilities that need care — fast, reliable, and on-demand.\n**Core Values**:\n- **Compassion**: Every shift filled improves patient care and a professional's livelihood.\n- **Reliability**: Facilities and workers can count on MedShift to deliver, every time.\n- **Integrity**: Transparent pricing, honest matching, no hidden fees or surprises.\n- **Excellence**: Holding professionals and facilities to the highest standard of care.\n**Target Launch Location**: Alberta, Canada (e.g., Calgary) for early access.\n\n## 2. Tech Stack Overview\n- **Architecture**: Monorepo (sharing types and logic across frontend and backend)\n- **Frontend / Public Site / Admin Dashboard**: Next.js\n- **Backend / API**: NestJS\n- **Database**: MongoDB\n- **Real-Time Communications**: Socket.io (instant updates for shift matching and availability)\n- **Transactional Emails**: Resend\n\n## 3. Target Audience\n### 3.1 Healthcare Facilities\n- Long-term care homes, clinics, and hospitals looking to fill urgent staffing gaps quickly (in under 2 hours).\n- Seeking verified, credentialed professionals without agency markups or middlemen.\n\n### 3.2 Healthcare Professionals (Workers)\n- Healthcare Assistants (HCAs), Nurses, and other clinical staff (e.g., Sarah J. - HealthCare Assistant).\n- Seeking flexible schedules, quick payouts, and direct connections to facilities without agency commitments.\n\n## 4. Core Workflows & Features\n\n### 4.1 \"How It Works\" Flow (Core Matching Engine)\n1. **Post or Browse**: Facilities post open shifts in minutes. Workers browse available opportunities based on their area and specialty.\n2. **Get Matched**: The system automatically surfaces the right fit—incorporating verified credentials, proximity, and real-time availability.\n3. **Shift Filled**: Workers confirm the shift, show up, and deliver care. Facilities get immediate coverage.\n\n### 4.2 Facility Portal Requirements\n- **Shift Creation**: Ability to post urgent and future shifts with details (Role, Date & Time, Location).\n- **Instant Matching & Notifications**: System uses Socket.io to notify facilities instantly when a worker matches and accepts a shift.\n- **Worker Verification**: Guarantee that all workers presented have 100% verified credentials and passed background checks.\n- **Direct Payments**: Transparent pricing model allowing facilities to pay workers directly through the platform (0 agency markups).\n- **Dashboard Metrics**: \n  - Track average shift fill times (goal: < 2 hours).\n  - Track credential verification statuses.\n  - Review historical shift fulfillment and worker ratings.\n\n### 4.3 Worker App/Portal Requirements\n- **Shift Browsing & Filtering**: Filter shifts by location, facility type, and shift length. Find opportunities nearby.\n- **Flexible Scheduling**: No minimum shift obligations; workers choose when and where they work on their terms.\n- **Shift Details View**: View detailed shift cards (e.g., Facility Name, Date/Time [e.g. May 24 · 7:00 AM – 3:00 PM], Location, Pay).\n- **Fast Payouts**: Integration to ensure workers get paid quickly upon shift completion without waiting weeks.\n- **Reputation System**: Earn ratings (e.g., ⭐ 4.9) and receive repeat requests from preferred facilities, helping to build a professional network.\n\n### 4.4 Admin Dashboard Requirements\n- **User Management**: Approve, background-check, and verify worker credentials and facility registrations.\n- **Platform Monitoring**: Oversee active shifts, filled shifts, and resolve matching bottlenecks in real-time.\n- **Support & Dispute Resolution**: Tools to manage cancellations, disputes, or payout issues.\n- **Waitlist Management**: Manage early access signups generated from the public site.\n\n### 4.5 Public Marketing Site\n- **Landing Page**: Communicates the dual value proposition to Workers and Facilities.\n- **Early Access / Waitlist Form**: Captures email addresses, distinguishing between Workers and Facilities.\n- **Automated Emails**: Uses Resend to send confirmation emails and notifications upon waitlist signup and platform launch.\n\n## 5. Technical & Non-Functional Requirements\n- **Real-Time Capabilities**: Socket.io must power real-time shift broadcasting, worker acceptance notifications, and live status updates to ensure shift fill times remain under 2 hours.\n- **Database Architecture**: MongoDB must be structured to handle rapid geospatial queries (for proximity matching) and robust user profile management (credentials, ratings).\n- **Security & Privacy**: Strict data protection for worker credentials, background checks, and payment information.\n- **Performance & Responsiveness**: Public site and Worker portal must be highly optimized for mobile devices (as workers will likely browse shifts on the go).\n\n## 6. Future Roadmap Considerations\n- Expansion beyond the initial Alberta launch to other provinces and regions.\n- Advanced machine-learning matching algorithms incorporating historical worker reliability and facility preferences.\n- In-app real-time messaging between workers and facilities (powered by Socket.io).\n",
  "annotations": []
}
```