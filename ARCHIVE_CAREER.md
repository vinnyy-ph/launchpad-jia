# Archive Career (JIA-352)

Replaces the destructive **Delete Career** action with a soft, recoverable **Archive**.
Archived careers are hidden from every default list (including child posts), excluded from
all analytics/metrics, and forced to an unpublished + inactive state. They remain in the
database (`archived: true`) and can be restored at any time.

## Behaviour

- **Archive** (per-career, Job-Owner only) opens a confirmation modal with three choices:
  - **Cancel**
  - **Archive without dropping** — archive the career; candidates keep their current stages.
  - **Archive and drop all** — archive the career and mark every candidate **not** in the
    Hired stage as `Dropped`.
- Archiving a **parent** cascades to its **child posts** (`parentCareerID === parent.id`).
- An archived career is always **unpublished** (`status: "inactive"`) and **inactive**
  (`activityStatus: "Inactive"`). It also disappears from the public/applicant job board.
- **Restore** un-archives the career (`archived: false`). It returns to the active list but
  **stays unpublished** until the recruiter chooses to publish it — restore never silently
  republishes. Dropped candidates are not auto-restored.
- Archived careers are **hidden by default** and shown only when the **"Archived"** status
  filter is selected (an exclusive, archived-only view). Archived rows carry an archive-box
  indicator in the Status column.

## Data model

Careers gain three additive fields (`src/lib/types/projects.ts`):

| Field | Meaning |
|---|---|
| `archived: boolean` | `true` = archived (absent/`false` = active) |
| `archivedAt: Date \| null` | when it was archived |
| `archivedBy: string \| null` | recruiter email who archived it |

No hard delete — the legacy `delete-career` route remains but has no UI entry point.

## Architecture

- **`src/lib/utils/careerArchive.ts`** — pure, unit-tested query helpers + planners:
  `EXCLUDE_ARCHIVED` / `ARCHIVE_MATCH_STAGE` (the centralized exclude gate),
  `withExcludeArchived()`, `archivedConstraint()` (list-filter toggle),
  `resolveHiredSubstageId()`, `selectInterviewIdsToDrop()`, `planArchiveTargets()`.
- **`POST /api/archive-career`** `{ id, dropCandidates }` — Job-Owner gated; cascade archive +
  optional bulk drop (`interviews.applicationStatus = "Dropped"`, `droppedReason:
  "career_archived"`); logs `recruiter_archived_career`. Never deletes; never unlinks projects.
- **`POST /api/restore-career`** `{ id }` — un-archives (parent only); logs `recruiter_restored_career`.
- **excludeArchived centralization** — the gate is applied at every careers read in
  `get-careers`, `fetch-careers`, `get-metrics`, `save-metrics`, `get-analytics`,
  `get-job-pipelines`, `get-pipeline-report`, and the public `job-openings` board, so archived
  careers never contribute to any list or metric.
- **UI** — `ArchiveCareerModal` / `RestoreCareerModal` (Figma-faithful), driven by the
  `useCareerArchiveModal` hook; wired into the careers table (`CareersTableV2`) and the two
  career-detail views (`JobDescription`, `CareerDescriptionView`). The "Archived" filter option
  lives in `CAREER_STATUS_OPTIONS`.

## Tests

`src/lib/utils/__tests__/careerArchive.test.ts` covers the exclude-gate shapes, the
archived-filter toggle, per-career Hired-substage resolution, the non-Hired drop selection, and
the parent+children cascade target set.
