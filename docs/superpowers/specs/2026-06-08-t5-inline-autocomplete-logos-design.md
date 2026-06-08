# T5 — Manual-profile inline autocomplete + logos

**Date:** 2026-06-08
**Branch:** `t5/ui-changes`
**Ticket:** T5 (Improve Candidate Profile Experience)

## Problem

The edit-CV overlay modals (`screens/ExperienceModal`, `EducationModal`, `CertificationModal`) let an
applicant type a company / school / issuing-organization name, pick from a logo-rich dropdown, and have the
selected entity's logo render in the input. The manual-profile wizard's **inline** entry forms
(`ManualProfile/{Experience,Education,Certification}EntryForm`) capture the same fields with plain text
inputs — no dropdown, no logo. Bring the modal behavior to the three inline forms.

The section item types already persist the needed fields (`companyDomain/companyLogoUrl`,
`schoolDomain/schoolLogoUrl`, `issuingOrganizationDomain/issuingOrganizationLogoUrl`) and
`structuredCV` normalizers already round-trip them, so the save path needs **no** change. This is input UI
plus one server route.

## Decisions (confirmed with user)

- **Logo placeholder position: left** — match the edit-CV modals (`sectionPosition="left"`) for cross-editor consistency.
- **College search: prod-safe server proxy + logos** — the modal's school search calls
  `http://universities.hipolabs.com` from the client, which browsers block as mixed content on the live
  `https` site. A same-origin server route proxies it (server→http is fine) and returns the school `domain`
  so college logos work via logo.dev/Brandfetch with fallback.

## Sources of truth

- Company / issuer suggestions: existing `GET /api/whitecloak/logo-brand-search?q=&strategy=typeahead`
  (Brandfetch) → `{ results: [{ name, domain, logoUrl }] }`. Reused as-is.
- School suggestions: **new** `GET /api/talent-vault/university-search?q=` proxying hipolabs.
- `Field` UI primitive supports `section` + `sectionPosition="left"` + `size="sm"` together.
- `api.get(url, { signal })` (axios) attaches the auth Bearer token and supports `AbortSignal`.

## Architecture

### New files

**`src/app/api/talent-vault/university-search/route.ts`** — `withAuth` GET.
- `q` trimmed; `< 2` chars → `{ results: [] }`.
- Server-side `fetch("http://universities.hipolabs.com/search?name=" + enc(q))` with a 5s `AbortController`
  timeout; any error/timeout → `{ results: [] }` (graceful, never 5xx the typeahead).
- Map each hit → `{ name, country, domain: normalizeDomain(domains[0]), website: web_pages[0] }`, drop
  entries without a name, de-dupe by `name|country|domain`, slice 12.
- Response shape: `{ results: SchoolResult[] }`.

**`src/lib/components/ManualProfile/autocomplete/logoUrls.ts`** — pure, unit-tested helpers:
- `normalizeDomain(value)` — strip protocol/`www.`/path, lowercase.
- `buildLogoDevUrl(domain, format)` — `https://img.logo.dev/{domain}?token=&size=40&format=` or `""` when no
  key / domain. Key from `NEXT_PUBLIC_LOGODEV_PUBLISHABLE_KEY`.
- `buildBrandfetchLogoUrl(domain)` — `https://cdn.brandfetch.io/{domain}/w/80/h/80?c={clientId}` (client id
  from `NEXT_PUBLIC_BRANDFETCH_CLIENT_ID`, fallback `1idbHCuB66Z-QiSsg0M`).
- `buildLogoUrl(domain, format)` — logo.dev first, else Brandfetch.
- `buildFaviconUrl(domain)` — Google s2 favicon.
- `LOGO_FORMATS = ["webp","png","jpg"]`.

**`src/lib/components/ManualProfile/autocomplete/fetchers.ts`**
- `Suggestion = { key: string; name: string; domain: string; logoUrl?: string; meta?: string }`.
- `searchBrands(q, signal)` → calls logo-brand-search, maps to `Suggestion` (no meta), filters name+domain.
- `searchSchools(q, signal)` → calls university-search, maps to `Suggestion` (meta = country,
  `logoUrl` built from domain), filters name.

**`src/lib/components/ManualProfile/autocomplete/AutocompleteField.tsx`** — one shared component used by all
three inline fields. Internally renders `Field size="sm"` with a left `LogoBadge` section + an absolutely
positioned dropdown.
- Props:
  ```ts
  interface AutocompleteFieldProps {
    label: string; placeholder: string; withAsterisk?: boolean;
    value: string; domain?: string; logoUrl?: string;
    error?: string; onFieldBlur?: () => void;
    onTextChange: (name: string) => void;             // free typing — caller clears domain+logo
    onSelect: (s: { name: string; domain: string; logoUrl: string }) => void;
    fetcher: (q: string, signal: AbortSignal) => Promise<Suggestion[]>;
    fallbackIcon: ComponentType<{ width?: number; height?: number; className?: string }>;
    showMeta?: boolean; loadingLabel?: string; emptyLabel?: string;
  }
  ```
- Behavior (mirrors modals): debounce 300ms, min query 2, latest-wins via `AbortController`, selection-lock
  set on pick / cleared on retype, dropdown opens on focus when unlocked + has results, click-outside closes.
- `LogoBadge` (internal): renders `<img>` walking logo.dev `webp→png→jpg` → Brandfetch CDN → Google favicon →
  `fallbackIcon`, advancing on `onError`. Resets on `domain/logoUrl/name` change.

### Edits

- `ExperienceEntryForm.tsx` — replace the company `<Field>` with `<AutocompleteField fetcher={searchBrands}
  fallbackIcon={Building05}>`, wiring `company/companyDomain/companyLogoUrl`.
- `CertificationEntryForm.tsx` — same for `issuingOrganization*` (`searchBrands`, `Building05`).
- `EducationEntryForm.tsx` — school `<AutocompleteField fetcher={searchSchools} fallbackIcon={GraduationHat01}
  showMeta>` wiring `school/schoolDomain/schoolLogoUrl`.
- `manual-profile.module.scss` — add dropdown/suggestion/logo classes ported from
  `form-modal.module.scss` (`.autocomplete`, `.acDropdown`, `.acDropdownState`, `.acSuggestion`,
  `.acSuggestionText`, `.acSuggestionName`, `.acSuggestionMeta`, `.acLogoWrap`, `.acLogoImg`, `.acLogoIcon`),
  scaled for `size="sm"`.

### Not touched

- The three source modals (working base modules) keep their inline implementations. The new shared component
  duplicates that logic by design; the modals are **not** refactored (base-module safety).
- `structuredCV` types/normalizers — already sufficient.
- Existing unused `GET /api/talent-vault/universities` (Mongo, no domain) — left as-is (flagged dead, not deleted).
- CSP — `img-src` already allows `https:` (covers logo.dev, Brandfetch, favicon); `connect-src` is same-origin
  for the new route. No change.

## Tests

- `autocomplete/__tests__/logoUrls.test.ts` — normalizeDomain cases; buildLogoDevUrl empty without key /
  populated with key; buildLogoUrl prefers logo.dev then Brandfetch; favicon.
- `autocomplete/__tests__/AutocompleteField.test.tsx` (fake timers, mocked fetcher) — typing ≥2 fires fetcher
  after debounce and renders suggestions; `< 2` chars no dropdown; click suggestion → `onSelect` with
  name/domain/logo; free typing → `onTextChange`; loading + empty states.
- Re-run existing `{Education,Experience,Certifications}Step` tests — label/placeholder preserved so they
  should stay green; fix any that assert on the old plain input.

## Implementation order

1. `logoUrls.ts` + test → `verify: jest logoUrls green`.
2. `fetchers.ts` (depends on logoUrls).
3. `AutocompleteField.tsx` + test → `verify: jest AutocompleteField green`.
4. `university-search/route.ts` → `verify: typecheck + manual shape reasoning`.
5. SCSS classes.
6. Wire the three entry forms → `verify: tsc, existing step tests green`.
7. Full targeted jest + `tsc --noEmit` → `verify: all green`.
8. Selective `git add` of T5 files only; commit. (72 unrelated WIP files stay uncommitted.)

## Risks / notes

- hipolabs uptime: proxy returns `[]` on failure → dropdown shows "No schools found", field stays usable as
  free text. Acceptable degradation.
- School logo coverage is thinner than companies; favicon + graduation-icon fallback covers misses.
- Demo material: the proxy fixes a latent edit-CV mixed-content bug — good `[challenges]`/`[code-explanation]`.
