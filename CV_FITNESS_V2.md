# Enhanced CV Fitness V2 (JIA-401)

Structured career descriptions + qualification-level CV screening.

This document is both the **design spec** for the feature and the **maintainer reference**
(matching the repo convention of `EMAIL_RATE_LIMITING.md`, `STAGE_DURATION_ANALYTICS.md`).

---

## 1. Problem

**Before (V1):**

- A career's job description is a single freeform rich-text HTML string (`career.description`).
- CV screening (`/api/screen-cv`, `/api/analyze-cv`) feeds that string + the candidate's CV to
  OpenAI `o4-mini` and gets back a flat verdict: `{ result, reason, confidence, jobFitScore }`.
- The recruiter sees one fit badge ("Strong Fit") + a paragraph of reasoning
  (the "Evaluation by Jia" card in `CandidateCVAnalysisV2.tsx`).

There is no structure to the job requirements and no per-requirement view of how the candidate
measures up.

**After (V2):**

- The career description is **structured** into four sections: **Overview**, **Roles &
  Responsibilities**, **Required Qualifications**, **Preferred Qualifications**.
- CV screening buckets **each qualification** as **Matched / Partially Matched / Missing**, with a
  short evidence note explaining the call.
- The "Evaluation by Jia" card shows a Match Score, counts of required/preferred met and missing,
  an overall summary, and a **View Analysis** modal listing every qualification, filterable by
  bucket.

**Hard constraint (from the ticket):** the new description must be **backwards compatible** —
existing careers (old `description`-only shape) must still load, display, and screen without errors.

---

## 2. Scope

In scope:

- Structured description in the career **create and edit** flows.
- Structured display of the description.
- A new V2 screening path that produces the matched/partial/missing buckets.
- The enhanced "Evaluation by Jia" card + "View Analysis" modal.
- Loading + error states, backwards-compat fallbacks, unit tests.

Out of scope (deliberately, to protect the stable pipeline):

- The automated screening pipeline (`/api/screen-cv`) that auto-promotes candidates and emails
  them stays **untouched**. V2 is an additive, recruiter-triggered analysis layer.
- Driving pass/fail promotion off the structured score.

---

## 3. Data model (additive, backwards-compatible)

The project uses the **MongoDB native driver (no Mongoose)** — there is no schema enforcement
layer. Backwards compatibility is therefore purely application-level: read old documents, fall back
on absent fields; write new documents with extra optional fields.

### 3.1 Career document

Existing `description: string` (HTML) is **kept**. One optional field is added:

```ts
interface StructuredCareerDescription {
  overview: string;                  // rich text (HTML)
  rolesAndResponsibilities: string;  // rich text (HTML)
  requiredQualifications: string[];  // one entry per qualification (repeatable rows)
  preferredQualifications: string[]; // one entry per qualification (repeatable rows)
}

interface CareerDescriptionFields {
  description: string;                          // legacy — always present, always kept in sync
  structuredDescription?: StructuredCareerDescription; // new — present on V2 careers
  descriptionVersion?: 2;                       // explicit tag; presence of structuredDescription is the real discriminator
}
```

**Two-directional compatibility:**

- **New → old:** when a structured career is saved, the legacy `description` HTML is **re-derived**
  from the four sections (Overview + Roles & Responsibilities + Required + Preferred concatenated
  into headed HTML). Every existing reader of `description` — the V1 screening prompt, the
  career→interview copy, search, any legacy display — keeps working unchanged.
- **Old → new:** when a document is read, `structuredDescription` present ⇒ render the structured
  view; absent ⇒ render the legacy `description`. No migration of existing documents is required.

Qualifications are stored as `string[]` (the requirement text only). The per-CV evidence and bucket
status are **not** stored on the career — they are produced by screening and stored on the interview
(below). This keeps the career document the single source of truth for *what* is required, and the
interview the source of truth for *how this candidate measured up*.

### 3.2 Interview document

V1 fields (`cvStatus`, `cvScreeningReason`, `confidence`, `jobFitScore`) are **left intact**. One
optional result field is added:

```ts
interface CvAnalysisV2 {
  matchScore: number;        // 0–100, drives the donut
  overallFit: string;        // reuses existing vocab: "Strong Fit" | "Good Fit" | "Maybe Fit" | "Bad Fit" | "No Fit"
  summary: string;           // the "Overall Summary" paragraph
  qualifications: Array<{
    type: "required" | "preferred";
    text: string;            // the qualification, echoed from the career
    status: "matched" | "partial" | "missing";
    evidence: string;        // how the CV addresses it — the modal row subtext
  }>;
  generatedAt: number;       // epoch ms
}
```

The card count badges (`Required X/Y`, `Preferred X/Y`, `Missing N`) are **derived** from
`qualifications` at render time, not stored separately, so they can never drift from the list.

The career's `structuredDescription` is **not** denormalized onto the interview — the V2 route
already fetches the career fresh (the existing `analyze-cv` route does
`careers.findOne({ id: interviewData.id })`), so it reads `careerDetails.structuredDescription`
directly.

---

## 4. Backend

### 4.1 `src/lib/utils/cvFitnessV2.ts` (new, pure — the unit-test target)

Pure functions, no I/O, so they are deterministically testable:

| Function | Responsibility |
|---|---|
| `hasStructuredQualifications(career)` | Guard: does this career have a usable `structuredDescription`? Decides V2 vs V1 fallback. |
| `buildStructuredScreeningPrompt(structuredDescription, parsedCV, name, secretPrompt, basePrompt)` | Builds the OpenAI prompt. Lists every required + preferred qualification and instructs the model to classify each as matched/partial/missing with an evidence note, plus an overall summary, `matchScore`, and `overallFit`. Returns the strict JSON shape the parser expects. |
| `parseStructuredAnalysis(rawModelOutput)` | Strips ` ```json ` fences, `JSON.parse`, validates the shape, coerces the status vocabulary (e.g. `"Partially Matched"` → `"partial"`, `"Match"` → `"matched"`). Throws / returns a typed error on malformed output. |
| `summarizeBuckets(qualifications)` | Derives `{ requiredMatched, requiredTotal, preferredMatched, preferredTotal, missingCount }` for the card badges. Deterministic — the prime unit-test target. |
| `filterQualificationsByTab(qualifications, tab)` | Filters for the modal tabs (`all` / `matched` / `partial` / `missing`). |

### 4.2 `src/app/api/analyze-cv-v2/route.tsx` (new)

Mirrors the structure and auth of the existing `analyze-cv` route (`withAuth`, same data fetch:
interview + applicant CV + career + global-settings prompt). It is **analysis-only** — no stage
auto-promotion, no candidate emails.

Flow:

1. Resolve interview, CV, career, and the global `cv_screening_prompt`.
2. If `!hasStructuredQualifications(career)` → return `{ fallback: true }`; the caller keeps the V1
   display. (Backwards compatibility for legacy careers.)
3. `buildStructuredScreeningPrompt(...)` → `openai.responses.create({ model: "o4-mini", reasoning: { effort: "high" } })`.
4. `parseStructuredAnalysis(...)`. On malformed JSON or an OpenAI failure → return `{ error: "<message>" }`
   with HTTP 200 (matching the existing routes' error convention) so the UI can render an error
   state + retry.
5. `$set` `cvAnalysisV2` onto the interview; insert a `recruiter-history` row
   (`"Generated CV Screening Result (V2)"`).
6. Return the `cvAnalysisV2` object.

The V1 routes `/api/screen-cv` and `/api/analyze-cv` are **not modified**.

---

## 5. Frontend

### 5.1 Career form — create + edit

`src/lib/components/CareerComponents/SegmentedCareerForm.tsx` is a feature component (≈6.3k lines),
**not** a base design-system primitive, so it is in scope to edit. The description step (it appears
in more than one place in the form — every site is updated) swaps the single description
`RichTextEditor` for a new composed sub-form:

- New `StructuredDescriptionFields.tsx` — Overview (`RichTextEditor`), Roles & Responsibilities
  (`RichTextEditor`), Required Qualifications, Preferred Qualifications.
- New `QualificationListInput.tsx` — a repeatable add/remove row input for the two qualification
  lists.

Both are siblings under `CareerComponents/` and **compose** existing primitives (do not fork them).

Form behavior:

- `careerForm.structuredDescription` holds the four sections.
- `careerForm.description` is kept **auto-derived** from the four sections (so downstream readers
  stay intact — see §3.1).
- **Legacy edit:** opening a career with no `structuredDescription` pre-fills **Overview** with the
  existing `description` HTML so no content is lost; the recruiter restructures from there.
- Validation: Overview required (mirrors the existing description-required rule); qualification
  lists may be empty.

### 5.2 Description display

`src/lib/components/CareerComponents/CareerDescriptionView.tsx` gains a structured branch: if
`structuredDescription` is present, render four labelled sections (Overview, Roles &
Responsibilities, Required Qualifications list, Preferred Qualifications list); otherwise render the
existing legacy HTML. Backwards compatible.

### 5.3 "Evaluation by Jia" card — enhanced

The recruiter card lives inside
`src/lib/components/CandidateComponents/CandidateCVAnalysisV2.tsx` (the header — Jia logo +
Regenerate — and the loading/empty states already match the Figma). The card **body** becomes
conditional:

- `interview.cvAnalysisV2` present → render new `EvaluationByJiaV2.tsx`:
  - `MatchScoreDonut.tsx` — SVG ring showing `matchScore%` (exact Figma gradient/colors).
  - Three count badges — `Required X/Y` (green), `Preferred X/Y` (amber), `Missing N` (red).
  - Overall Summary + fit badge + summary text.
  - `View Analysis` button.
- absent → the existing V1 body (`CareerFit` badge + `cvScreeningReason`). Backwards compatible.

New `ViewAnalysisModal.tsx`: header (donut + summary) → filter tabs `All / Matched / Partially
Matched / Missing` → per-qualification rows (status badge + qualification text + evidence) →
pagination → `Done`. Filtering uses `filterQualificationsByTab`.

All colors, spacing, typography, and radii are transcribed from the Figma MCP tokens verbatim at
implementation time (frame `14180:18` — "JIA-401 Enhanced CV Analysis V2").

### 5.4 Regenerate wiring

The card's regenerate action calls `/api/analyze-cv-v2` when the career is structured, and the V1
regenerate otherwise. On success it refetches the interview and the card re-renders from the new
`cvAnalysisV2`.

### 5.5 Secondary surface

The guest-portal card
`GuestPortalComponents/.../CVScreening/EvaluationByJia.tsx` is a **secondary** mount. If
`EvaluationByJiaV2` / `ViewAnalysisModal` drop in cleanly as shared components it is also wired
there; otherwise it keeps the V1 display. The primary (demoed) surface is the recruiter
`CandidateCVAnalysisV2`.

---

## 6. States (L6 functionality gates)

- **Card loading** — reuse the existing regenerate spinner while `analyze-cv-v2` runs.
- **Card error + retry** — if V2 generation returns `{ error }`, show an inline error with a retry
  (Regenerate) affordance. (Screening calls are slow and can fail — this is the most common L5→L4
  drop on this ticket.)
- **Modal empty** — a structured career with zero qualifications shows an empty state.
- **Legacy fallback** — every structured-data branch falls back to V1 when the data is absent.
- **Form** — field validation; save loading and save error reuse the existing form patterns.
- **No CV uploaded** — existing handling preserved.

---

## 7. Testing

`src/lib/utils/__tests__/cvFitnessV2.test.ts` (Jest, repo convention; OpenAI mocked — only
post-processing is tested):

- `summarizeBuckets` — all-matched, all-missing, mixed, and empty inputs produce correct counts.
- `parseStructuredAnalysis` — valid JSON → typed object; malformed JSON → error; status coercion
  (`"Partially Matched"` → `"partial"`); ` ```json ` fence stripping.
- `hasStructuredQualifications` — legacy career → `false`; structured career → `true`.
- `buildStructuredScreeningPrompt` — output contains every required and preferred qualification and
  the CV text.
- `filterQualificationsByTab` — each tab returns the right subset.

Target ≈6–8 cases. The existing suite (17 tests) must stay green.

---

## 8. Base-module compliance

Per the do-not-modify list in `LAUNCH_NOTES.md`:

- **New** files: `cvFitnessV2.ts`, `analyze-cv-v2/route.tsx`, `StructuredDescriptionFields.tsx`,
  `QualificationListInput.tsx`, `EvaluationByJiaV2.tsx`, `MatchScoreDonut.tsx`,
  `ViewAnalysisModal.tsx`, the test file, this doc.
- **Edited** feature files (none are base primitives): `SegmentedCareerForm.tsx`,
  `CareerDescriptionView.tsx`, `CandidateCVAnalysisV2.tsx`.
- **Untouched:** `middleware.ts`, `lib/firebase/*`, `lib/mongoDB/*`, `lib/context/*`,
  `lib/hooks/*`, `lib/components/ui` primitives, the V1 routes `screen-cv` and `analyze-cv`, and all
  config.

---

## 9. File summary

| Path | New/Edit | Purpose |
|---|---|---|
| `src/lib/utils/cvFitnessV2.ts` | new | Prompt builder, parser, bucket summariser, guards. |
| `src/lib/utils/__tests__/cvFitnessV2.test.ts` | new | Unit tests for the above. |
| `src/app/api/analyze-cv-v2/route.tsx` | new | V2 screening endpoint (analysis-only). |
| `src/lib/components/CareerComponents/StructuredDescriptionFields.tsx` | new | The 4-section form. |
| `src/lib/components/CareerComponents/QualificationListInput.tsx` | new | Repeatable qualification rows. |
| `src/lib/components/CandidateComponents/EvaluationByJiaV2.tsx` | new | Enhanced card body. |
| `src/lib/components/CandidateComponents/MatchScoreDonut.tsx` | new | SVG match-score ring. |
| `src/lib/components/CandidateComponents/ViewAnalysisModal.tsx` | new | Filterable qualification modal. |
| `src/lib/components/CareerComponents/SegmentedCareerForm.tsx` | edit | Mount the structured form (create+edit). |
| `src/lib/components/CareerComponents/CareerDescriptionView.tsx` | edit | Structured display branch. |
| `src/lib/components/CandidateComponents/CandidateCVAnalysisV2.tsx` | edit | Conditional V2 card body + regenerate wiring. |

---

## 10. Commit plan (staging → PR → main)

Atomic commits, `feat(T2)` / `test(T2)` / `docs(T2)` format:

1. `feat(T2): add cvFitnessV2 util + unit tests`
2. `feat(T2): add analyze-cv-v2 screening route`
3. `feat(T2): structured career description form (create + edit)`
4. `feat(T2): structured career description view`
5. `feat(T2): V2 evaluation card + view-analysis modal`
6. `docs(T2): add CV_FITNESS_V2 reference`

Then PR `staging → main` (direct push to `main` is blocked).
