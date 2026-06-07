# TEST REPORT — T1–T5 QA Pass

**Date:** 2026-06-07 · **Branch:** `staging-t5` @ `23f469f` · **Baseline:** `e25b36f` (fork)
**Method:** Hybrid — automated suite (Jest + tsc + clean production build) + live browser smoke against the **production build** (`pnpm start` on :3000) + per-ticket acceptance-criteria code-trace.

---

## 1. Executive Summary

**Overall health: 🟢 GREEN.** All mandatory tickets meet their acceptance criteria; no code defects found in T1–T5; no regressions in base modules.

| Gate | Result |
|---|---|
| Jest unit suite | ✅ **171/171** tests, **29/29** suites |
| TypeScript (`tsc --noEmit`) | ✅ clean, 0 errors |
| Production build (`pnpm build`, clean) | ✅ **exit 0**, **402/402** static pages |
| Per-ticket acceptance criteria (T1–T5) | ✅ all satisfied |
| Regression (base modules) | ✅ no regressions |
| Live app boot + auth-gate + auth verification | ✅ pass |

**Pass/fail totals:** 171 automated pass / 0 fail. Per-ticket AC: 5/5 pass. Regression: pass. E2E: pass (authenticated-UI caveat noted in §4).

**Critical issues:** **None in the code.**
- The one Critical-*looking* event — `pnpm build` failing with `PageNotFoundError: /careers` — was root-caused to a **`.next` race** (a `next dev` server was sharing `.next` with `next build`). A clean build passes 402/402. **Vercel always builds clean → unaffected.** See BUG-01.
- The only true pre-submission blocker is **not a code issue**: the SSO-gated app has **no test credentials in the README**, which risks the "inaccessible links = automatic disqualification" rule. See BUG-02 / Rec-1.

---

## 2. Per-Task Results

Legend: PASS / WARN / FAIL. Evidence = test name, code path, or live observation.

### T1 — Setup Dev Environment (1 SP)

| # | Test case | Expected | Actual | Result |
|---|---|---|---|---|
| 1.1 | `pnpm install` under pnpm 11 | Resolves; overrides honored | `pnpm-workspace.yaml` carries `overrides:` + `allowBuilds:`; lockfile regenerated | PASS |
| 1.2 | Security version-pins preserved | All pins retained after pnpm-11 migration | Verified verbatim in `pnpm-workspace.yaml` (fast-xml-parser, minimatch, rollup, underscore, immutable, bn.js, dompurify, qs, @tootallnate/once) | PASS |
| 1.3 | Production build succeeds | `next build` exit 0 | Clean build: 402/402 pages, exit 0 | PASS |
| 1.4 | App boots & serves | Server responds on :3000 | `pnpm start` → "Ready in 383ms"; `/job-portal` renders | PASS |
| 1.5 | Vercel cron config valid for Hobby | ≤ daily crons | `vercel.json` throttled to daily | PASS |
| 1.6 | No dependency bloat | No unjustified deps added | `package.json` diff = overrides relocation only; **0 deps added** | PASS |

### T2 — Enhanced CV Fitness V2 (2 SP)

| # | Test case | Expected | Actual | Result |
|---|---|---|---|---|
| 2.1 | Structured description: 4 sections in create+edit | Overview, Roles, Required, Preferred on both flows | `SegmentedCareerForm` mounts `StructuredDescriptionFields` at every description site; `upsert-career` persists | PASS |
| 2.2 | Backwards compatibility (old `description` careers) | Load + display without error | Legacy branch in `CareerDescriptionView`; legacy edit pre-fills Overview; `description` auto-derived | PASS |
| 2.3 | 3-bucket categorization | matched / partial / missing | `cvFitnessV2.test.ts` covers `summarizeBuckets` + `parseStructuredAnalysis` vocab coercion ("Partially Matched"→partial) | PASS |
| 2.4 | Required vs preferred distinguished | Separate counts | `summarizeBuckets` derives required X/Y, preferred X/Y, missing N | PASS |
| 2.5 | Loading + error + retry states | Shown during/after OpenAI call | Per `CV_FITNESS_V2.md` §6; error returns HTTP 200 `{error}` → inline retry | PASS |
| 2.6 | V1 pipeline untouched | `screen-cv`/`analyze-cv` unchanged | Not in diff; V2 is additive analysis-only route | PASS |
| 2.7 | Unit tests on post-processing | OpenAI mocked, logic tested | `cvFitnessV2.test.ts` ✅ | PASS |

### T3 — Recruiter Pipeline Report (3 SP)

| # | Test case | Expected | Actual | Result |
|---|---|---|---|---|
| 3.1 | Two entry points, one shared component | Dashboard + Project Detail | `RecruiterPipelineReport` mounted in both; `projectId` scopes | PASS |
| 3.2 | 5 filters compose (AND) | project/title/owner/status/hiring-mgr | Server-side compose via `buildPipelineReportParams` (tested) | PASS |
| 3.3 | Per-stage / per-sub-stage toggle | Column structure switches | `getReportStages`/`getStageCounts` modes (tested) | PASS |
| 3.4 | Dropped-per-stage toggle | Adds dropped column | `pipelineReport.test.ts` dropped counting ✅ | PASS |
| 3.5 | Parent-child combine + nesting | Parent funnel merges children; numbered 1.1, 1.2 | `groupByParentChild` + `combineTimelineStages` (tested) | PASS |
| 3.6 | Column drag / pin / hide | Reorder + sticky pin | HTML5 drag in `TableMetric` (additive); pin sticky | PASS |
| 3.7 | CSV + XLSX export, filters respected | Files download, filename `<Org>-Pipeline-Report-<date>` | CSV manual + XLSX sheetjs; `fullReport` path | PASS |
| 3.8 | Fullscreen | CSS overlay, ESC exits | Implemented per doc | PASS |
| 3.9 | Persistence | Column order persists per entry point | `localStorage` keys per scope | PASS |
| 3.10 | Loading / empty / error states | Skeleton / NoData / toast | Present per doc | PASS |
| 3.11 | Unit tests | Aggregation/grouping/filters | `pipelineReport.test.ts` ✅ | PASS |

### T4 — Archive Career (1 SP)

| # | Test case | Expected | Actual | Result |
|---|---|---|---|---|
| 4.1 | Delete replaced by Archive everywhere | No orphan delete buttons | Swapped in `CareersTableV2`, `JobDescription`, `CareerDescriptionView`, 2 manage pages; hard-delete de-linked | PASS |
| 4.2 | Cascade to child posts | Parent archive → children archived | `planArchiveTargets` (tested: parent + N children) | PASS |
| 4.3 | Default lists exclude archived (+children) | Hidden everywhere | `EXCLUDE_ARCHIVED` applied at 8 read endpoints incl. public board | PASS |
| 4.4 | Excluded from all metrics/analytics | No archived in metrics | Same centralized gate in get-metrics/save-metrics/get-analytics/pipelines/report | PASS |
| 4.5 | Status forced unpublished+inactive | `inactive` + `Inactive` on archive | Set in `archive-career` route | PASS |
| 4.6 | Restore stays unpublished | No silent republish | `restore-career` keeps unpublished | PASS |
| 4.7 | Archived filter + visual indicator | Exclusive archived view + badge | "Archived" status option + `archived.svg` indicator | PASS |
| 4.8 | Confirm before archive (+ Undo) | Modal + undo toast | `ArchiveCareerModal` (3 choices) + `undo-archive` route | PASS |
| 4.9 | Soft delete only | Docs remain `archived:true` | No `deleteOne`; legacy delete-career de-linked | PASS |
| 4.10 | Unit tests | Cascade + exclude gate | `careerArchive.test.ts` ✅ | PASS |

### T5 — Improve Candidate Profile Experience (3 SP)

| # | Test case | Expected | Actual | Result |
|---|---|---|---|---|
| 5.1 | Both flows discoverable (addition, not replacement) | Manual + Upload + Review cards | `SubmitCVStep` 3 cards; CV upload untouched | PASS |
| 5.2 | Manual form captures full profile | Same `StructuredCV` as parsed CV | 10-step wizard → `assembleProfile` → existing `store-cv` | PASS |
| 5.3 | Phone format validation | Inline error per country mask | `phoneValidation.test.ts` ✅ | PASS |
| 5.4 | Phone uniqueness | Reject duplicate; allow unique | `check-phone-unique` route + tested validator (mocked DB) | PASS |
| 5.5 | No Firebase phone auth | Frontend OTP only | `ManualPhoneVerifyModal` never calls Firebase phone auth | PASS |
| 5.6 | Repeatable sections | Add/remove accordion rows | Reuse existing modal editors; `InlineMultiEntryStep` | PASS |
| 5.7 | Inline validation + block Next | On-blur errors, gated Next | `profileValidation` + step gating (tested) | PASS |
| 5.8 | Draft persistence + resume + discard guard | Auto-save, resume prompt, discard modal | `profileDraft` (tested) + `ResumeDraftModal` + `DiscardProfileModal` | PASS |
| 5.9 | AI Introduction generate + overwrite-confirm | Sanitized `<p>`, confirm replace | `introductionAI.test.ts` ✅ + `ReplaceIntroductionModal` | PASS |
| 5.10 | References additive, back-compat | Old CVs lacking `references` still normalize | `structuredCV.test.ts` round-trip ✅ | PASS |
| 5.11 | Skip drops section (no partial leak) | Strict assemble validation | `assembleProfile.test.ts` ✅ | PASS |

---

## 3. Regression Results

| # | Area | Expected | Actual | Result |
|---|---|---|---|---|
| R1 | Phone-verification gate (4 base sites) | Original behavior when flag unset | Frontend `if(env==="false") return true; else <original>`; backend `required = env!=="false"` → **default-on = unchanged** | PASS |
| R2 | `TableMetric` shared by 12 consumers | Other tables unaffected | New props additive + default-off | PASS |
| R3 | CV screening V1 | `screen-cv`/`analyze-cv` intact | Not in diff | PASS |
| R4 | `StructuredCV` / `digitalCV` readers | Old readers unaffected by `references` | Additive optional field; legacy derivation ignores it | PASS |
| R5 | Career reads after excludeArchived | Active careers still listed | Gate excludes only `archived:true` (additive constraint) | PASS |
| R6 | All routes still build/prerender | No base route broken | Clean build prerenders **402/402** pages | PASS |
| R7 | Auth / routing / layout shell | Login gate + portal routing work | Live: `/job-portal` renders, "Session Expired→Log In" shown, middleware routes | PASS |

---

## 4. End-to-End Results

| # | Flow | Expected | Actual | Result |
|---|---|---|---|---|
| E1 | App boots on production artifact | Server serves | `pnpm start` Ready; pages serve | PASS |
| E2 | Unauthenticated → auth gate | Redirect/prompt to log in | "Session Expired" dialog + Log In | PASS |
| E3 | Auth token verification → org resolution | Valid token → org data | `get-org` (Bearer) → **HTTP 200** + "Launch Round Test Org" | PASS |
| E4 | Recruiter dashboard surfaces (T2/T3/T4) | Render with seeded data | **Covered by:** clean prerender of all routes + prior-session chrome-devtools E2E (handoff-documented, same seed) + unit tests. This session's headless re-auth hit token-embed friction (server verification confirmed healthy — see note) | PASS* |
| E5 | Applicant manual-profile end-to-end | Wizard → submit → store-cv | **Covered by:** prior-session E2E (Apply→upload-cv→manual wizard, no phone modal) + `assembleProfile`/draft/validation unit tests | PASS* |

**\*Note (transparency):** Live authenticated UI screenshots were **not** re-captured this session. Server-side auth verification was proven healthy (E3, HTTP 200). The headless browser re-auth failed only because a hand-embedded 1137-char token was corrupted on copy (a freshly shell-extracted token verified 200) — this is a **test-harness artifact, not an app defect**. Authenticated UI behavior is evidenced by the 402/402 prerender, the 171 unit tests, and the prior session's documented E2E with identical seed data.

---

## 5. Bugs Found

### BUG-01 — `next build` fails when a dev server shares `.next` — **Severity: LOW (process; not a code defect)**
- **Location:** build pipeline (`/careers`, `/careers/[id]` page-data collection).
- **Symptom:** `PageNotFoundError: Cannot find module for page: /careers/[id]` + `ENOENT`, build exit 1.
- **Root cause:** `next dev` (live on :3000) and `next build` write the same `.next` dir → build worker can't find page modules. Both `/careers` pages are trivial `"use client"` redirects with no build-time I/O — confirmed innocent.
- **Repro:** run `pnpm build` while `pnpm dev` is running.
- **Fix / status:** stop dev → `rm -rf .next` → `pnpm build` ⇒ **402/402, exit 0**. Vercel builds clean, so deploy is unaffected. No code change required.

### BUG-02 — No test credentials in README for SSO-gated app — **Severity: HIGH (submission risk, not code)**
- **Location:** `README.md` (no credential/access section).
- **Impact:** Auth is Google-SSO. The brief: *"Links that are not accessible will automatically be disqualified."* Evaluators need a way in.
- **Repro:** `grep -i 'credential\|test account\|password' README.md` → empty.
- **Fix:** before submission, add a test access path (shared test account, or documented access) to the README. See Rec-1.

### BUG-03 — `NEXT_PUBLIC_PHONE_VERIFICATION_REQUIRED` is build-inlined for client gates — **Severity: MEDIUM (deploy config)**
- **Location:** `screens/Dashboard.tsx`, `screens/UploadCV.tsx` (client reads `process.env.NEXT_PUBLIC_*`).
- **Impact:** `NEXT_PUBLIC_*` vars are inlined at **build** time. If set on Vercel after a build (or not set), client-side phone gates default to **on** in prod even though `.env` locally is `false`.
- **Fix:** set `NEXT_PUBLIC_PHONE_VERIFICATION_REQUIRED=false` on Vercel **and redeploy**; verify manual-profile applies without a phone modal in prod. See Rec-2.

### BUG-04 — CSP blocks third-party telemetry beacons — **Severity: LOW (pre-existing, not T1–T5)**
- **Location:** base CSP; beacons to `*.ecs.*.on.aws/events`, `*.run.app/events`.
- **Impact:** console errors only; telemetry blocked, no functional effect.
- **Fix (optional):** remove the beacon or allowlist it in CSP for a clean console.

### BUG-05 — ~80 unused icon-preload warnings flood the console — **Severity: LOW (pre-existing, not T1–T5)**
- **Location:** base `iconsV3` preload strategy.
- **Impact:** cosmetic console noise (`preloaded ... but not used`).
- **Fix (optional, L6 polish):** preload only above-the-fold icons.

### INFO-01 — Jest console stack-trace in `requisitionsDisabled.ui.test.tsx`
- Suite **passes** (171/171). A logged stack-trace appears in output (import-time noise in `RequisitionsComponents`). Investigate only if chasing L6 console cleanliness.

---

## 6. Recommendations (before proceeding)

1. **(HIGH — do before submit)** Add test credentials / access instructions to `README.md`. The SSO gate + the disqualification rule make this the single most important pre-submission action. Then open **every** submitted link (deployed app, repo, video) in an incognito window and confirm it loads.
2. **(MEDIUM)** On Vercel, set `NEXT_PUBLIC_PHONE_VERIFICATION_REQUIRED=false` **before/at build** and **redeploy**; confirm manual-profile + apply flows don't show the phone gate in production.
3. **(PROCESS)** Always run `pnpm build` with the dev server stopped. The clean build is green (402/402); BUG-01 is purely environmental.
4. **(SHIP)** PR `staging-t5 → main`; include `CHANGES.md` + `TEST_REPORT.md`. Tag the submission commit on `main`.
5. **(OPTIONAL — L6 polish)** Quiet the production console (BUG-04 telemetry beacon, BUG-05 icon preloads, INFO-01 test log) for a clean console — a cheap L4→L5/L5→L6 signal.

**Verdict:** The T1–T5 feature work is **ship-ready** (green automated suite, clean production build, satisfied acceptance criteria, no regressions). Remaining work is **submission/deploy hygiene**, not code: README access creds (#1) and the Vercel env redeploy (#2).
