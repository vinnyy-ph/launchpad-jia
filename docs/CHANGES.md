# CHANGES — T1–T5 Change Audit & Feature Explanations

**Baseline:** `e25b36f` (initial fork commit = original Jia codebase).
**Head:** `staging-t5` @ `23f469f`. T1–T4 are merged to `main`; T5 is the `staging-t5` delta.

Per-ticket net tree diffs (the snapshots used for this audit):

| Ticket | Range | Files | +/- |
|---|---|---|---|
| T1 Setup | `e25b36f..d2bd473` | 4 | +40 / -95 |
| T2 CV Fitness V2 | `d2bd473..da96b66` | 17 | +1383 / -80 |
| T3 Pipeline Report | `da96b66..4a1a3c2` | 6 | +959 / -195 |
| T4 Archive Career | `4a1a3c2..01fc178` | 31 | +1467 / -195 |
| T5 Candidate Profile | `01fc178..23f469f` | 78 | +7158 / -78 |

Each ticket also ships a repo-root maintainer doc (the established `EMAIL_RATE_LIMITING.md` pattern): `CV_FITNESS_V2.md`, `PIPELINE_REPORT.md`, `ARCHIVE_CAREER.md`, `CANDIDATE_PROFILE.md`. This file is the cross-ticket synthesis; those four are the per-ticket deep references.

---

# Part 3 — Change Audit

## T1: Setup Dev Environment (1 SP)

### Files Created
- `pnpm-workspace.yaml` — pnpm 11 workspace manifest. Carries the **relocated security version-pins** (`overrides:`) that pnpm 11 no longer reads from `package.json`, plus `allowBuilds:` for native post-install scripts (`sharp`, `@parcel/watcher`, `core-js`, `protobufjs`, `@firebase/util`).

### Files Modified
- `package.json` — removed the `pnpm.overrides` block (moved to `pnpm-workspace.yaml`); pnpm 11 toolchain alignment. **No runtime/dev dependency added or removed.**
- `pnpm-lock.yaml` — regenerated under pnpm 11.
- `vercel.json` — throttled Vercel cron schedules to **daily** to fit the Hobby plan's cron limit (deploy-path fix discovered during T1's one-shot deploy verification).

### Files Deleted
- none

### Dependencies Added/Removed
- **None.** The only `package.json` change is the relocation of the `pnpm.overrides` security pins into `pnpm-workspace.yaml` (verified preserved verbatim: `fast-xml-parser`, `minimatch`, `rollup`, `underscore`, `immutable`, `bn.js`, `dompurify`, `qs`, `@tootallnate/once`). No security-pin regression.

---

## T2: Enhanced CV Fitness V2 (2 SP)

### Files Created
- `src/lib/utils/cvFitnessV2.ts` — pure logic: prompt builder, response parser/coercer, bucket summarizer, structured-career guard.
- `src/lib/utils/__tests__/cvFitnessV2.test.ts` — unit tests for the above.
- `src/app/api/analyze-cv-v2/route.tsx` — V2 screening endpoint (analysis-only; no auto-promotion/email).
- `src/lib/components/CareerComponents/StructuredDescriptionFields.tsx` — the 4-section career-description form (Overview, Roles & Responsibilities, Required, Preferred).
- `src/lib/components/CareerComponents/QualificationListInput.tsx` — repeatable add/remove qualification rows.
- `src/lib/components/CareerComponents/StructuredDescriptionDisplay.tsx` — read-only structured description renderer.
- `src/lib/components/CandidateComponents/EvaluationByJiaV2.tsx` — enhanced "Evaluation by Jia" card body (donut + count badges + summary + View Analysis).
- `src/lib/components/CandidateComponents/MatchScoreDonut.tsx` — SVG match-score ring (Figma gradient).
- `src/lib/components/CandidateComponents/QualificationBadges.tsx` — Required/Preferred/Missing status-badge cluster.
- `src/lib/components/CandidateComponents/ViewAnalysisModal.tsx` — filterable (All/Matched/Partial/Missing) per-qualification modal.
- `CV_FITNESS_V2.md` — feature spec + maintainer doc.

### Files Modified
- `src/app/api/upsert-career/route.tsx` — persist `structuredDescription` and keep legacy `description` auto-derived on create/edit.
- `src/lib/components/CareerComponents/SegmentedCareerForm.tsx` — mount the structured form at every description site (create + edit), with legacy pre-fill into Overview.
- `src/lib/components/CareerComponents/CareerDescriptionView.tsx` — structured-vs-legacy display branch.
- `src/lib/components/CandidateComponents/CandidateCVAnalysisV2.tsx` — conditional V2 card body + V2 regenerate wiring (falls back to V1).
- `src/lib/components/CareerComponents/CandidateMenu.tsx` — wire the V2 analysis action into the candidate menu.
- `src/lib/components/CareerComponents/RecruiterEvaluation.tsx` — surface the V2 evaluation card in the recruiter evaluation view.

### Files Deleted
- none (V1 routes `screen-cv`, `analyze-cv` deliberately left intact)

### Dependencies Added/Removed
- none (reuses installed `openai`)

---

## T3: Recruiter Pipeline Report (3 SP)

### Files Created
- `src/lib/utils/pipelineReport.ts` — pure aggregation: `getReportStages`, `getFormattedStages`, `getStageCounts`, `groupByParentChild`, `buildPipelineReportParams`, `getExtraColumnValue`, cross-career stage merge.
- `src/lib/utils/__tests__/pipelineReport.test.ts` — unit tests (aggregation, sub-stage, dropped, grouping, filter composition, extra columns).
- `src/app/api/update-career-note/route.ts` — recruiter-gated note save (`career.notes`; org-membership verified).
- `PIPELINE_REPORT.md` — feature doc.

### Files Modified
- `src/lib/components/AnalyticsComponents/RecruiterPipelineReport.tsx` — the report: data fetch, 5 composable filters, customize-columns modal (per-stage/sub-stage + dropped + show/hide), CSV+XLSX export, parent-child expandable rows, sortable headers, column drag + pin, fullscreen, persistence, notes.
- `src/lib/components/AnalyticsComponents/TableMetric.tsx` — **additive, default-off** props to the shared table (12 consumers): `enableColumnReorder`/`onColumnReorder` (HTML5 drag), `getCellTooltip`, `fixedColumns`, `columnLabels`, `instanceId`.

### Files Deleted
- none

### Dependencies Added/Removed
- none (reuses installed `@tanstack/react-table`, `xlsx`)

---

## T4: Archive Career (1 SP)

### Files Created
- `src/lib/utils/careerArchive.ts` — pure helpers/planners: `EXCLUDE_ARCHIVED`/`ARCHIVE_MATCH_STAGE`, `withExcludeArchived()`, `archivedConstraint()`, `resolveHiredSubstageId()`, `selectInterviewIdsToDrop()`, `planArchiveTargets()`.
- `src/lib/utils/careerArchiveActions.ts` — client-side archive/restore action wiring.
- `src/lib/utils/__tests__/careerArchive.test.ts` — unit tests (exclude gate, filter toggle, hired-substage, drop selection, parent+children cascade).
- `src/app/api/archive-career/route.ts` — Job-Owner-gated cascade archive + optional bulk drop (soft delete).
- `src/app/api/restore-career/route.ts` — un-archive (stays unpublished).
- `src/app/api/undo-archive/route.ts` — full revert using a batch id + captured prior status (toast Undo).
- `src/lib/components/CareerComponents/ArchiveCareerModal.tsx` — Figma archive confirmation (Cancel / Archive / Archive+Drop).
- `src/lib/components/CareerComponents/RestoreCareerModal.tsx` — restore confirmation.
- `src/lib/components/CareerComponents/ArchivedBanner.tsx` — archived-state banner on career detail.
- `src/lib/components/CareerComponents/CareerArchiveToast.tsx` + `careerArchiveToastHelpers.tsx` — archive/restore toasts with Undo.
- `src/lib/hooks/useCareerArchiveModal.tsx` — modal controller hook.
- `public/careers/archived.svg` — archived indicator icon.
- `ARCHIVE_CAREER.md` — feature doc.

### Files Modified
- `src/app/api/get-careers/route.tsx`, `fetch-careers/route.tsx`, `get-metrics/route.tsx`, `save-metrics/route.tsx`, `get-analytics/route.tsx`, `get-job-pipelines/route.tsx`, `get-pipeline-report/route.ts`, `job-openings/route.tsx` — apply the **centralized `excludeArchived` gate** so archived careers (and children) never appear in any list/metric/public board.
- `src/app/old-dashboard/careers/manage/[slug]/page.tsx`, `src/app/recruiter-dashboard/careers/manage/[slug]/page.tsx` — swap Delete→Archive/Restore; remove orphaned hard-delete; archived banner + reload timing.
- `src/lib/components/DataTables/CareersTableV2.tsx` — Archive/Restore row actions + archived Status indicator.
- `src/lib/components/CareerComponents/JobDescription.tsx`, `CareerDescriptionView.tsx` — archive/restore entry points + archived banner on detail.
- `src/lib/types/projects.ts` — additive `archived`/`archivedAt`/`archivedBy` fields on `Career`.
- `src/lib/utils/activityLogger.ts` — register `recruiter_archived_career` / `recruiter_restored_career` activity kinds.
- `src/lib/utils/constants.ts` — add the "Archived" status-filter option + archive icon.
- `src/lib/Utils.tsx` — archive-related shared helper(s).

### Files Deleted
- none (legacy `delete-career` route kept but de-linked from UI — soft-delete only)

### Dependencies Added/Removed
- none

---

## T5: Improve Candidate Profile Experience (3 SP)

### Files Created — utilities (pure, unit-tested)
- `src/lib/utils/phoneValidation.ts` — `phoneFormat(value, countryCode)` per-country mask.
- `src/lib/utils/addressFormat.ts` — `composeAddress` structured-address join.
- `src/lib/utils/assembleProfile.ts` — assemble wizard state → `StructuredCV` for submit.
- `src/lib/utils/introductionAI.ts` — AI-intro prompt builder + response→safe-HTML shaper + content guard.
- `src/lib/utils/profileValidation.ts` — per-step required-field validation + section-status.
- `src/lib/utils/profileDraft.ts` — localStorage draft persistence/resume.
- `src/lib/utils/sanitizeRichText.ts` — rich-text sanitizer + `htmlToPlainText`.
- (+ matching `__tests__/*.test.ts` for each, plus `phoneInput`, `structuredCV` tests)

### Files Created — API routes
- `src/app/api/job-portal/check-phone-unique/route.ts` — phone-uniqueness query against `applicant-cv` (excludes current user). No Firebase phone auth.
- `src/app/api/whitecloak/generate-introduction/route.ts` — `withAuth` OpenAI route (gpt-5-nano) for the AI introduction.

### Files Created — ManualProfile components (`src/lib/components/ManualProfile/`)
- Wizard shell: `ManualProfileWizard.tsx`.
- Steps: `ContactInformationStep.tsx`, `WebsitesStep.tsx`, `SkillsStep.tsx`, `IntroductionStep.tsx`, `MultiEntryStep.tsx`, `InlineMultiEntryStep.tsx`.
- Entry forms: `EducationEntryForm.tsx`, `ExperienceEntryForm.tsx`, `ProjectEntryForm.tsx`, `CertificationEntryForm.tsx`, `AwardEntryForm.tsx`, `ReferenceEntryForm.tsx`.
- Modals: `ManualPhoneVerifyModal.tsx`, `ReferenceModal.tsx`, `ReplaceIntroductionModal.tsx`, `DiscardProfileModal.tsx`, `ResumeDraftModal.tsx`.
- Primitives/fields: `LabeledField.tsx`, `CountrySelect.tsx`, `OtpInput.tsx`, `RichText.tsx`, `RichTextField.tsx`, `CvUploadBanner.tsx`.
- Hook + styles: `useGenerateIntroduction.ts`, `manual-profile.module.scss`.
- Tests: `__tests__/` for Awards/Certifications/ContactInformation/Country/CvUploadBanner/Education/Experience/LabeledField/Otp/Projects/References/RichTextField/Skills/Websites steps.

### Files Created — assets/docs
- `public/iconsV3/create-profile.svg` — "Create a Profile Manually" entry-card icon.
- `CANDIDATE_PROFILE.md` — feature doc.

### Files Modified
- `src/lib/utils/structuredCV.ts` — **additive** `references?: ReferenceSectionItem[]` section (no existing field changed).
- `src/lib/utils/phoneInput.ts` — auto-spacing + per-country max length for the national mobile input.
- `src/app/(talent-vault)/components/applicant-dashboard/SubmitCVStep.tsx` — three entry cards incl. "Create a Profile Manually".
- `src/app/(job-portal)/dashboard/talent-vault/setup/page.tsx` — mount the wizard in talent-vault setup.
- `src/lib/components/screens/JobDetails.tsx`, `UploadCV.tsx`, `Dashboard.tsx` — manual-profile entry + the env-gated phone-verification skip.
- `src/app/api/whitecloak/apply-job/route.ts`, `src/app/api/job-portal/contact-details/route.ts` — env-gate the legacy Firebase phone requirement (default = on).
- `src/lib/components/PhoneVerification/PhoneVerificationModal.tsx` — custom country dropdown + national format in the base verify modal.
- `src/lib/components/screens/{Education,Experience,Projects,Awards,Introduction}SectionContent.tsx` — render stored rich text via the sanitizing `RichText` component (display fix across surfaces).
- `src/app/(talent-vault)/styles/modules/profile-setup.module.scss`, `src/lib/styles/screens/uploadCV.module.scss` — wizard/entry styling (widths, Figma fidelity).
- `.gitignore` — ignore `tsconfig.tsbuildinfo` build cache.

### Files Deleted
- none

### Dependencies Added/Removed
- **None** (`package.json` diff across `01fc178..23f469f` is empty; reuses installed `openai`).

---

# Part 4 — Feature Explanations

Grouped by ticket, highest-level (entry points / main components) first, down to utilities. Deep per-ticket detail lives in the four repo-root feature docs; this section is the operational explanation.

## T1 — Setup Dev Environment

**What it does:** Brings the fork to a buildable, deployable state on pnpm 11 + Vercel Hobby.
**Why it exists:** The original lockfile/overrides format predates pnpm 11; Vercel Hobby rejects sub-daily crons. Without these, install and deploy fail.
**How it connects:** `pnpm-workspace.yaml` is read by every install; `vercel.json` governs the deploy. Both are infra, not feature code.
**Key logic:** Security version-pins were **relocated, not dropped** — pnpm 11 reads `overrides:` from `pnpm-workspace.yaml`, not `package.json`. The pin set is byte-for-byte preserved, so transitive-dep CVEs stay patched.

## T2 — Enhanced CV Fitness V2

**`SegmentedCareerForm.tsx` → `StructuredDescriptionFields.tsx` → `QualificationListInput.tsx`** (career authoring).
- *What:* Replaces the single description editor with four sections (Overview, Roles & Responsibilities, Required Quals, Preferred Quals), qualifications entered as repeatable rows.
- *Why:* CV screening needs structured requirements to score per-qualification rather than as one freeform blob.
- *How:* The form holds `structuredDescription`; the legacy `description` HTML is auto-derived from the four sections so every existing reader keeps working.
- *Key logic:* **Backwards compatibility is two-directional** — new careers re-derive the legacy field on write; legacy careers pre-fill Overview from `description` on edit. Nothing migrates.

**`analyze-cv-v2/route.tsx` + `cvFitnessV2.ts`** (screening).
- *What:* Recruiter-triggered analysis that buckets each qualification as **Matched / Partially Matched / Missing** with an evidence note, plus a 0–100 match score and overall fit.
- *Why:* Gives a per-requirement view instead of one fit badge.
- *How:* Route fetches interview+CV+career, builds a prompt via `buildStructuredScreeningPrompt`, calls OpenAI `o4-mini`, parses with `parseStructuredAnalysis`, `$set`s `cvAnalysisV2` on the interview.
- *Key logic:* `parseStructuredAnalysis` strips ```` ```json ```` fences and **coerces vocab** ("Partially Matched"→`partial`). `hasStructuredQualifications` gates V2-vs-V1 so legacy careers return `{ fallback: true }`. Errors return HTTP 200 `{ error }` so the UI can show retry. The card count badges are **derived** from the qualification list at render time, so they can't drift.

**`CandidateCVAnalysisV2.tsx` → `EvaluationByJiaV2.tsx` → `MatchScoreDonut.tsx` / `QualificationBadges.tsx` / `ViewAnalysisModal.tsx`** (recruiter display). Conditional V2 body with donut, Required/Preferred/Missing badges, and a filterable analysis modal; falls back to the V1 body when `cvAnalysisV2` is absent.

## T3 — Recruiter Pipeline Report

**`RecruiterPipelineReport.tsx`** (the feature; mounted at Dashboard→Pipeline Report tab and Project Detail→Pipeline Report tab as one shared component).
- *What:* A table of candidate counts per pipeline stage across all careers, with 5 composable filters, per-stage/sub-stage toggle, dropped-per-stage toggle, sortable headers, column drag + pin, fullscreen, CSV+XLSX export, recruiter notes.
- *Why:* Recruiters need a single funnel view across every career, exportable.
- *How:* Filtering is server-side (`GET /api/get-pipeline-report`); aggregation is client-side in the pure `pipelineReport.ts`; rendering reuses the shared `TableMetric`.
- *Key logic:* **Parent-child combine** (JIA-431) — a parent row's stage counts merge the parent's own candidates with all child posts' candidates (`combineTimelineStages`) so the parent shows the full funnel; children stay nested, numbered `1.1`, `1.2`. Sorting preserves parent-child grouping. Column order persists per entry point in `localStorage`.

**`TableMetric.tsx`** (shared table). Extended **additively, default-off** (column reorder, per-cell tooltip, fixed columns, display-label map) so the other 11 consumers are byte-for-byte unaffected. `update-career-note/route.ts` saves notes recruiter-gated.

## T4 — Archive Career

**Archive/restore UI** (`useCareerArchiveModal` → `ArchiveCareerModal` / `RestoreCareerModal` / toasts) wired into `CareersTableV2`, `JobDescription`, `CareerDescriptionView`, and the two manage pages. Replaces destructive Delete with a 3-choice confirm (Cancel / Archive / Archive+Drop) and an Undo toast.

**Archive routes** (`archive-career`, `restore-career`, `undo-archive`).
- *What:* Soft-delete a career (and cascade to child posts), optionally drop non-Hired candidates; restore stays unpublished; undo fully reverts via captured prior status.
- *Why:* Delete was destructive and lost pipeline history.
- *Key logic:* Cascade targets resolved by `planArchiveTargets()`; archived careers forced to `inactive` + `Inactive`; **never** hard-deletes.

**`careerArchive.ts` exclude-gate.** A single `EXCLUDE_ARCHIVED` constraint is applied at **every** careers read (8 endpoints incl. the public job board) so archived careers and their children never contribute to any list, metric, or analytic. Centralization is the design point — no scattered `archived: false` checks. Surfaced via the "Archived" status filter (exclusive view).

## T5 — Improve Candidate Profile Experience

**`SubmitCVStep.tsx` / talent-vault setup → `ManualProfileWizard.tsx`** (entry + orchestration).
- *What:* A new "Create a Profile Manually" path beside Upload CV / Review CV; a 10-step wizard (Contact, Websites, Education, Experience, Skills, Projects, Certifications, Awards, References, Introduction).
- *Why:* Candidates without a CV file can still build the same profile.
- *How:* The wizard holds one `StructuredCV`-shaped state and submits to the existing `/api/whitecloak/store-cv`, so a manual profile is **indistinguishable downstream** from a parsed CV — no new storage path.
- *Key logic:* Multi-entry steps reuse the existing modal editors behind accordion rows (no fork). Draft auto-saves to `localStorage` with resume + discard guard. `Next` is disabled until required fields validate (`profileValidation`), and Skip on optional steps drops the section cleanly (no partial leak into the assembled CV).

**Phone handling** (`phoneValidation.ts`, `check-phone-unique/route.ts`, `ManualPhoneVerifyModal`, `CountrySelect`).
- *What:* Format validation + DB uniqueness; a frontend-only OTP UX that **never calls Firebase phone auth**.
- *Key logic:* The legacy Firebase phone gate (4 base sites) is **env-gated** by `NEXT_PUBLIC_PHONE_VERIFICATION_REQUIRED` — default keeps the original gate ON; `=false` skips it. Default-on means zero regression for existing flows.

**AI Introduction** (`introductionAI.ts`, `generate-introduction/route.ts`, `useGenerateIntroduction`, `RichTextField`, `ReplaceIntroductionModal`).
- *What:* Optional one-click first-person intro paragraph; rich-text editing of the result.
- *Key logic:* Pure prompt-builder/response-shaper produce sanitized `<p>` HTML (`sanitizeRichText`); confirm-before-overwrite if the field already has content; friendly note when the profile is too empty to generate from.

**Data model** (`structuredCV.ts`). Adds optional `references?: ReferenceSectionItem[]`; `store-cv` persists it via the existing spread; the legacy `digitalCV` derivation ignores it → old readers unaffected. The five existing multi-entry editors already emit the existing item shapes, so there is no mapping layer.

**Display fix** (`*SectionContent.tsx`). Stored introduction/description rich text now renders through the sanitizing `RichText` component on all profile surfaces.
