# 批阅记录

- **源文件**：SKILL.md
- **源文件路径**：/Users/ismailawa/Documents/Projects/med-shift/.agents/skills/medshift-workflow/SKILL.md
- **源文件版本**：未知
- **批阅时间**：20260721_1311
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
  "fileName": "SKILL.md",
  "docVersion": "未知",
  "reviewVersion": 1,
  "annotationCount": 0,
  "rawMarkdown": "---\nname: medshift-workflow\ndescription: Enforces the MedShift development workflow. Use this skill for any task to ensure documentation is read and the sprint checklist is updated. Trigger on any task implementation for the MedShift project.\n---\n\n# MedShift Workflow Guidelines\n\nWhen you are asked to implement a feature, fix a bug, or perform any development task for the MedShift project, you MUST follow this strict workflow:\n\n## 1. Review Documentation\nBefore writing any code or modifying the system, you must read the relevant specification documents to understand the architecture, database schema, and UI/UX guidelines.\nUse the `view_file` tool to read:\n- `docs/prd.md`\n- `docs/system_architecture.md`\n- `docs/database_schema.md`\n- `docs/ui_ux_specification.md`\n\n## 2. Locate the Task in the Sprint Checklist\n- Open the file `docs/sprints_tasks.md` using the `view_file` tool.\n- Identify the specific sprint, story, and task you are about to work on based on the user's prompt.\n\n## 3. Update Status (In Progress)\n- Before starting your implementation, edit `docs/sprints_tasks.md` to change the task's checkbox from `[ ]` to `[/]` (In Progress). Use the file modification tools to update this.\n\n## 4. Implement\n- Implement the requested feature, adhering to the NestJS, Next.js, and SOLID principles outlined in the docs.\n- Ensure the UI matches the design system specified in `docs/ui_ux_specification.md`.\n- Ensure the database schema matches `docs/database_schema.md`.\n\n## 5. Update Status (Completed)\n- Once the task is fully implemented, verified, and functioning correctly, edit `docs/sprints_tasks.md` to mark the task as completed by changing the checkbox to `[x]`.\n\n**CRITICAL RULE**: Never skip updating `docs/sprints_tasks.md`. It is the single source of truth for project progress. Never start a coding task without consulting the specification documents first.\n",
  "annotations": []
}
```