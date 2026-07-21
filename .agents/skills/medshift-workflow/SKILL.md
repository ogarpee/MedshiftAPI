---
name: medshift-workflow
description: Enforces the MedShift development workflow. Use this skill for any task to ensure documentation is read and the sprint checklist is updated. Trigger on any task implementation for the MedShift project.
---

# MedShift Workflow Guidelines

When you are asked to implement a feature, fix a bug, or perform any development task for the MedShift project, you MUST follow this strict workflow:

## 1. Review Documentation
Before writing any code or modifying the system, you must read the relevant specification documents to understand the architecture, database schema, and UI/UX guidelines.
Use the `view_file` tool to read:
- `docs/prd.md`
- `docs/system_architecture.md`
- `docs/database_schema.md`
- `docs/ui_ux_specification.md`

## 2. Locate the Task in the Sprint Checklist
- Open the file `docs/sprints_tasks.md` using the `view_file` tool.
- Identify the specific sprint, story, and task you are about to work on based on the user's prompt.

## 3. Update Status (In Progress)
- Before starting your implementation, edit `docs/sprints_tasks.md` to change the task's checkbox from `[ ]` to `[/]` (In Progress). Use the file modification tools to update this.

## 4. Implement
- Implement the requested feature, adhering to the NestJS, Next.js, and SOLID principles outlined in the docs.
- Ensure the UI matches the design system specified in `docs/ui_ux_specification.md`.
- Ensure the database schema matches `docs/database_schema.md`.

## 5. Update Status (Completed)
- Once the task is fully implemented, verified, and functioning correctly, edit `docs/sprints_tasks.md` to mark the task as completed by changing the checkbox to `[x]`.

**CRITICAL RULE**: Never skip updating `docs/sprints_tasks.md`. It is the single source of truth for project progress. Never start a coding task without consulting the specification documents first.
