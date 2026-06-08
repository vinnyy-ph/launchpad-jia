# T5 — Manual-profile inline address autocomplete

**Date:** 2026-06-08
**Branch:** `t5/ui-changes` (extends PR #18)
**Ticket:** T5 (Improve Candidate Profile Experience)

## Problem

The edit-CV contact modal (`screens/ContactInfoModal`) lets an applicant type into the Address field and pick
from a dropdown of location suggestions (no logo — plain address text). The manual-profile wizard's inline
contact step (`ManualProfile/ContactInformationStep`) has a plain "Search address" input with no dropdown.
Bring the modal's address autocomplete to that inline input.

## Source of truth

`ContactInfoModal` address autocomplete:

- Suggestions from **Photon (Komoot)**: `https://photon.komoot.io/api/?q=<query>&limit=5` — client-side
  `fetch`, **https** (no mixed-content issue, unlike the hipolabs school case), public (no auth).
- Maps `features[]` → `{ id, displayName }` where `displayName = [name, city, state, country].join(", ")`.
- Input has a static `MarkerPin01` left icon (not a data logo); suggestion rows are plain `displayName` text.
- Debounce 300ms, min query 2, select sets the address string + locks, click-outside closes.

## Architecture

### New files

**`ManualProfile/autocomplete/AddressAutocompleteField.tsx`** — mirrors the modal's address behavior.
- `Field size="sm"` with a static `MarkerPin01` left section + an absolutely-positioned dropdown of plain
  `displayName` rows. Debounce 300ms, min-2, latest-wins `AbortController`, select→lock, click-outside close.
- No logo machinery (distinct from the logo `AutocompleteField`).
- Props: `label, placeholder, withAsterisk?, value, error?, onFieldBlur?, onTextChange(address),
  onSelect(address), fetcher?, style?`. `fetcher` defaults to `searchAddresses` (injected in tests).

### Edits

**`ManualProfile/autocomplete/fetchers.ts`** — add:
- `AddressSuggestion = { id: string; displayName: string }`.
- `searchAddresses(query, signal)` — Photon `fetch`, maps + filters to `AddressSuggestion[]`.

**`ManualProfile/ContactInformationStep.tsx`** — replace only the `!manualMode` "Search address" `<Field>` with
`<AddressAutocompleteField … onTextChange/onSelect → patch({ address })>`. Manual-entry mode
(street/city/province/postal/country via `addressParts`/`composeAddress`) is untouched.
*Line endings:* the working-tree copy is pure CRLF churn (identical to HEAD); restore it to LF via
`git checkout HEAD --` before editing so the commit diff is the address change only.

**`ManualProfile/manual-profile.module.scss`** — reuse `.autocomplete`, `.acDropdown`, `.acDropdownState`,
`.acSuggestion`; add `.acSuggestionFull` (wrapping address text vs the logo rows' ellipsis).

### Not touched

The logo `AutocompleteField`, the manual address fields, the source modal.

## Tests

- `fetchers.test.ts` — `searchAddresses`: maps Photon `features` → `displayName`, joins parts, filters empties
  (mock global `fetch`).
- `AddressAutocompleteField.test.tsx` — type ≥2 → debounced fetch → dropdown renders `displayName`; `<2` no
  dropdown; click → `onSelect(displayName)`; empty state (mock `fetcher`, real timers + `waitFor`).

## Implementation order

1. Spec + commit.
2. `git checkout HEAD -- ContactInformationStep.tsx` (LF normalize, safe — pure CRLF churn).
3. `fetchers.ts`: add `searchAddresses` + `AddressSuggestion`.
4. `AddressAutocompleteField.tsx`.
5. SCSS: `.acSuggestionFull`.
6. Wire `ContactInformationStep.tsx`.
7. Tests; run jest + `tsc --noEmit`.
8. Selective commit; push → updates PR #18.

## Risks / notes

- Photon uptime: fetch failure → empty dropdown ("No locations found"), field stays usable as free text.
- Repo-wide: all 71 dirty files are CRLF line-ending churn (a `core.autocrlf`/`.gitattributes` issue). This
  change only normalizes the one file it edits; a repo-wide renormalize is a separate optional cleanup.
