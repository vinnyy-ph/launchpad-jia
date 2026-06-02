# Career Detail (`/careers/[id]`)

Filesystem route: `src/app/(guest-portal)/careers/[id]/page.tsx`

## Purpose

Displays a specific career in the Guest Careers Portal, keeping the same header and layout used across the guest experience.

## Layout & Structure

- Wrapped by the `(guest-portal)` route group's layout so the URL remains `/careers/...`.
- Uses `GuestPortalContainer` to preserve the portal's header, tabs context, and overall styling.

## Params

- `id` (string): Identifier of the career to display. The current implementation uses mock data from `src/lib/components/GuestPortal/mock/careers.ts`.

## Not Found Handling

- If no career is found for `id`, the page calls `notFound()` which renders `not-found.tsx` in this folder.

## Future Notes

- Replace mock data lookups with an API call when backend is ready.
- Optionally support SEO slugs like `/careers/{id}-{slug}` while still parsing `id`.
