# Guest Careers Portal (`/careers`)

Filesystem route: `src/app/(guest-portal)/careers/page.tsx`

## Purpose

This route serves the **external (invited) recruiter experience** for managing careers. It is separate from the internal recruiter dashboard routes under `src/app/recruiter-dashboard` and is surfaced to the user as `/careers`.

## Auth & Roles

- Users must be **authenticated**.
- Access is limited to users who have the role **`GUEST_RECRUITER`** (option 1 from design discussion).
- Users are typically onboarded via **email invite links**, which:
  - Validate an invite token.
  - Create or attach a user account for the invited email.
  - Assign the `GUEST_RECRUITER` role (and related company / tenant context).

Route protection should ensure:

- Non‑authenticated users are redirected to the login flow.
- Authenticated users **without** `GUEST_RECRUITER` should be redirected away (e.g., to their appropriate dashboard or an access‑denied page).

## Behavioral Notes

- External recruiters may be able to create **multiple careers**.
- Careers created here should be associated with:
  - The owning company / tenant.
  - The creating user (who has `GUEST_RECRUITER`).
- Internal recruiters can later review / edit these careers from internal routes such as `/recruiter-dashboard/careers/edit-career`.

## Implementation Notes

- The `(guest-portal)` segment is a **route group** and does not appear in the URL. The user-visible path is `/careers`.
- Any middleware / layout logic that checks roles should be updated to treat `GUEST_RECRUITER` as allowed for this route group.
