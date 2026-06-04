# Recruiter Pipeline Report

A table summarising the **current count of candidates per pipeline stage across all careers** in an organization, surfaced from two screens via a single shared component.

## Entry points (one shared component)

`RecruiterPipelineReport` (`src/lib/components/AnalyticsComponents/RecruiterPipelineReport.tsx`) is mounted in both:

- **Dashboard → "Pipeline Report" tab** — `src/app/recruiter-dashboard/page.tsx`
- **Project → Project Detail → "Pipeline Report" tab** — `src/app/recruiter-dashboard/projects/manage/[projectID]/page.tsx` (passes `projectId` to scope the report to that project)

## Data source

Read-only from `GET /api/get-pipeline-report` (unchanged). Each career is returned with `timelineStages[] → { name, substages[] → { name, candidates[], droppedCandidates[] } }`. The endpoint applies all filters server-side and supports `fullReport=true` (no pagination) for export. Candidate counts are array lengths.

## Architecture

- **Filtering:** server-side (the endpoint composes the filters with AND).
- **Aggregation:** client-side, in the pure, unit-tested module `src/lib/utils/pipelineReport.ts`.
- **Rendering:** the shared `TableMetric` table (used by 12 analytics components), extended with **additive, default-off** props so the other consumers are unaffected.

### Key files

| File | Role |
|---|---|
| `src/lib/utils/pipelineReport.ts` | Pure logic: `getReportStages`, `getFormattedStages`, `getStageCounts`, `groupByParentChild`, `buildPipelineReportParams`, `getExtraColumnValue`. No JSX/React. |
| `src/lib/utils/__tests__/pipelineReport.test.ts` | Unit tests (aggregation, dropped, grouping, filter composition, extra columns). |
| `src/lib/components/AnalyticsComponents/RecruiterPipelineReport.tsx` | The report: data fetch, filters, customize-columns modal, export, parent-child rows, column order/persistence, fullscreen. |
| `src/lib/components/AnalyticsComponents/TableMetric.tsx` | Shared table; additive `enableColumnReorder` / `onColumnReorder` (native HTML5 drag), `getCellTooltip` (per-cell stage-number tooltip), `fixedColumns`, `instanceId`. |
| `src/app/api/update-career-note/route.ts` | Recruiter-gated note save (sets `career.notes`; org membership verified). |

## Columns

Fixed: `#`, **Project**, **Job Title** (links to the career, expandable for parents), **Job Owner**, **Status** (status-badge cluster). Then dynamic stage count columns, then optional **Headcount** (`career.headcount`), **Created Date** (`career.createdAt`, shown as **relative time**, e.g. "2w ago" — JIA-431), **Notes**.

### Notes (recruiter-only)

A recruiter can **add a note** to a career via the "Add a note" modal (opened from the Notes column cell). The note is stored on the career (`career.notes`) through `POST /api/update-career-note` (recruiter-gated; org-membership verified) and is surfaced **only** in the recruiter pipeline report — no applicant-facing route reads it. The Notes column shows the note (or "Add note" when empty); exports use the raw note text.

### Per-stage vs per-sub-stage (default: per-stage)

Toggled in the Customize Columns modal.

- **Per-stage:** one count column per stage = sum of that stage's substage `candidates`. Hovering a stage **count cell** shows a tooltip with that row's substage breakdown (e.g. `Waiting Submission: 42 / For Review: 57`) — JIA-431.
- **Per-sub-stage:** one column per substage.

Canonical stages are derived from the data (`DEFAULT_JOB_PIPELINE` core stages first — CV Screening, AI Interview, Human Interview, Job Offer — then custom stages such as "Transferred"). Each column can be shown/hidden.

### Dropped per stage

The "Show dropped per stage" switch adds a `Dropped from <stage|substage>` column (sum of `droppedCandidates`).

## Parent-child rows

Careers can have child posts (`parentCareerID`; `isChildCareer` / `isParentCareer` in `careerHierarchy.ts`). Per JIA-431 ("Combine data from Child and Parent Post"), a **parent row's stage counts combine** the parent's own candidates with all of its child posts' candidates (`combineTimelineStages`), so the parent shows the full funnel (e.g. CV Screening → Job Offer) even when early and later stages live on different posts. Children remain nested + expandable ("N child posts") for the per-post breakdown. Standalone careers and orphan children render as single rows. Exports include all rows.

## Controls

- **Filters** (`MultiFilterDropdown`): project, job title, job owner, status, hiring manager (+ contributors) — compose with AND, applied server-side.
- **Customize Columns** modal: per-stage/sub-stage toggle, "Show dropped per stage", per-column show/hide (Stages + Others).
- **Column drag-to-reorder:** native HTML5 drag on the header (matches the app's existing reorder pattern in `PipelineStageBuilder`). Fixed columns (`#`, Project, Job Title, Job Owner, Status) don't move.
- **Lock/pin + hide:** header-hover dropdown (`Pin` / `Hide Column`); pinned columns stay sticky during horizontal scroll.
- **Fullscreen:** CSS overlay; ESC exits; one-time "Controls Hidden" reminder.
- **Export:** CSV (manual) + XLSX (sheetjs), full report respecting filters + visible columns + mode. Filename `<Org>-Pipeline-Report-<date>.{csv,xlsx}`.

## Persistence

- **Column order** → `localStorage` per entry point (`pipelineReport:columns:dashboard` / `pipelineReport:columns:project:<id>`).
- **Filter / sort / pagination** defaults → `usePipelineReportViewPreferences`.
- Column pin/hide is session state (per the report's lifetime).

## States

Loading (skeleton via `TableLoader`), empty (`NoDataAvailable`), error (toast on fetch failure).

## Testing

`src/lib/utils/__tests__/pipelineReport.test.ts` covers per-stage aggregation, per-sub-stage aggregation, dropped counting, stage derivation (incl. custom + cross-career merge), parent-child grouping (nested / orphan), filter composition (`buildPipelineReportParams`), and the Headcount/Created Date/Notes values. Run with `pnpm test`.

## Design decisions

- **Enhanced the existing component** rather than rebuilding — it already implemented filters, the per-stage/sub-stage and dropped toggles, pin/lock, fullscreen, and CSV. The remaining gaps (XLSX, column drag, parent-child rows, the Headcount/Created Date/Notes columns, header tooltips, unit tests) were added on top.
- **Aggregation extracted into a pure module** so the core logic is unit-tested independently of React.
- **Native HTML5 drag** (no new dependency) — consistent with the existing column/stage reorder code.
- **`TableMetric` extended additively (default-off)** to protect its 12 shared consumers.

## Figma

- JIA-379 (full screen + lock row/col): node `13865:1374`
- JIA-431 (parent-child, new columns, customize): node `14617:8070`
