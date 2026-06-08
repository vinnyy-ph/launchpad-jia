# Improve Candidate Profile Experience (T5)

Adds a **Create a Profile Manually** path as an alternative to uploading a CV. It is an
**addition, not a replacement** — the CV-upload flow is untouched. The manual wizard assembles
the same `StructuredCV` shape a parsed CV produces, so a manually-built profile is
**indistinguishable downstream** (analysis, candidate table, search) — no migration, no new
storage path.

## Behaviour

- **Entry** — the "Submit CV" step shows three cards: **Create a Profile Manually** (new),
  **Upload a CV** (existing), **Review Current CV** (existing, disabled until a CV exists).
  Available in both the job-portal apply flow and talent-vault setup.
- **Wizard** — a 10-step flow with a gradient progress bar, `Step N of 10` header, back chevron,
  and a primary `Next ›` (Step 10 → `Submit`). Steps with optional sections (4 Experience,
  6 Projects, 7 Certifications, 8 Awards, 9 References) show a `Skip`. `Next` is disabled until
  the step's required (`*`) fields validate.
  1. **Contact Information** — name, email, mobile, address.
  2. **Websites** — repeatable url + type rows.
  3. **Education** · 4. **Experience** · 6. **Projects** · 7. **Certifications** ·
     8. **Awards** — multi-entry; each filled entry collapses to an accordion row, an `Add`
     button opens the editor.
  5. **Skills** — chip input (type + Enter).
  9. **Character References** — multi-entry (new section).
  10. **Introduction** — rich-text summary; optional `✨ Generate Introduction` (AI).
- **Mobile number** — a frontend OTP flow (enter → 6-digit code → confirmed badge) matches the
  Figma. It never calls Firebase phone auth. The real gate is **format + uniqueness** (below).
- **Discard guard** — leaving / back-chevron with unsaved data opens a "Discard this Profile?"
  modal.
- **Submit** — assembles the `StructuredCV` and `POST`s `/api/whitecloak/store-cv`, then rejoins
  the existing apply flow. Submit-in-progress disables the button (no double-submit); a server
  error preserves the form data.

## Data model

`src/lib/utils/structuredCV.ts` gains one additive section (no existing field is changed):

```ts
export interface ReferenceSectionItem {
  id: string;
  name: string;        // required (*)
  email: string;       // optional
  phone: string;       // required (*) — plain field, NO OTP
  countryCode: string; // from the PH ▾ selector
  company: string;     // required (*)
  position: string;    // required (*)
  relation: string;    // optional
}

export interface StructuredCV {
  // …existing fields unchanged…
  references?: ReferenceSectionItem[]; // NEW, optional
}
```

`references` is persisted by `store-cv`'s `structuredCV` spread; the legacy `digitalCV`
derivation ignores it, so old readers are unaffected. The five multi-entry editors already emit
exactly the existing `StructuredCV` item shapes (`EducationItem === EducationSectionItem`, etc.)
— no mapping layer.

## Architecture

- **`src/lib/components/ManualProfile/`** — the wizard. `ManualProfileWizard` holds one
  `StructuredCV`-shaped state, routes the 10 steps, and owns Next/Back + the discard guard.
  Step 1 (`ContactInformationStep`) and the OTP modal (`ManualPhoneVerifyModal`) already exist.
- **Reuse for multi-entry steps** — Education/Experience/Projects/Certifications/Awards each
  reuse the existing `*Modal.tsx` editors (field forms + school/company autocomplete + logo
  enrichment) behind an accordion list. References adds a new `ReferenceModal` (plain fields).
- **`src/lib/utils/phoneValidation.ts`** — pure, unit-tested: `phoneFormat(value, countryCode)`.
- **`POST /api/job-portal/check-phone-unique`** — queries `applicant-cv` by
  `structuredCV.contactInfo.phone` (+ `countryCode`), excluding the current user's email; returns
  whether the number is free. No Firebase phone auth anywhere in the submit path.
- **Submit target** — `POST /api/whitecloak/store-cv` (existing). The manual path produces the
  same `applicant-cv` document a parsed upload produces.

## Tests

- `phoneValidation` — valid/invalid format per country mask.
- phone-uniqueness — unique vs duplicate against a mocked DB.
- `structuredCV` references round-trip + back-compat (documents lacking `references` still
  normalize).
