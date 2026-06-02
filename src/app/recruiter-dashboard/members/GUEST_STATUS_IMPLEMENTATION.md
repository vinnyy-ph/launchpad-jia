# Guest Status & Authentication Implementation

## Overview
Implemented a complete member/guest status lifecycle system with authentication guards for the guest portal.

---

## Status Lifecycle

### 1. **"invited"** (Initial State)
- Member/guest is created in the `members` collection
- Invitation email is sent via Mailgun
- User has NOT logged in yet
- Fields set:
  - `status: "invited"`
  - `lastLogin: null`
  - `addedAt: <timestamp>`

### 2. **"joined"** (Active State)
- User successfully logs in for the FIRST time
- System detects: `status === "invited"` AND `lastLogin === null`
- Status automatically updates: `"invited"` → `"joined"`
- `lastLogin` field is set to current timestamp
- User data (name, image) is updated from Google profile

---

## Implementation Details

### 1. `/api/auth` Route (Authentication)
**File:** `/src/app/api/auth/route.ts`

**What it does:**
- Handles all user authentication (Google SSO)
- Checks if member exists in `members` collection
- **NEW:** Automatically updates status on first login
  ```typescript
  if (member.status === "invited" && !member.lastLogin) {
    // Update to "joined" + set lastLogin
  }
  ```

### 2. `GuestAuthGuard` Component
**File:** `/src/lib/components/AuthGuard/GuestAuthGuard.tsx`

**What it does:**
- Protects all guest portal routes
- Validates user is authenticated
- Checks user role === "guest"
- Verifies guest belongs to an organization
- Allows access for status: "invited" OR "joined"
- Stores guest org info in localStorage

**Usage:**
```tsx
<GuestAuthGuard />
```

### 3. Guest Portal Layout
**File:** `/src/app/(guest-portal)/layout.tsx`

**What changed:**
- Added `<GuestAuthGuard />` component
- Now protects all routes under `/careers` and `/requisitions`

### 4. Check Member Status API
**File:** `/src/app/api/check-member-status/route.ts`

**What it does:**
- Debug endpoint to check member status
- Returns: email, name, role, status, lastLogin, addedAt

**Usage:**
```
GET /api/check-member-status?email=user@example.com&orgID=123
```

---

## Authentication Flow Diagram

```
┌─────────────────────────┐
│  Admin invites guest    │
│  Status: "invited"      │
│  lastLogin: null        │
└───────────┬─────────────┘
            │
            ▼
   ┌────────────────────┐
   │  Invitation Email  │
   │  sent (Mailgun)    │
   └────────┬───────────┘
            │
            ▼
   ┌────────────────────┐
   │  Guest clicks      │
   │  "Log In" link     │
   └────────┬───────────┘
            │
            ▼
   ┌────────────────────┐
   │  Google SSO        │
   │  Login page        │
   └────────┬───────────┘
            │
            ▼
   ┌─────────────────────────────┐
   │  /api/auth checks member    │
   │  If status="invited" AND    │
   │  lastLogin=null             │
   │  → Update to "joined"       │
   │  → Send Welcome Email       │
   └───────────┬─────────────────┘
               │
               ▼
   ┌─────────────────────────────┐
   │  Welcome Email Sent         │
   │  - Complete profile info    │
   │  - Name from Google         │
   │  - Avatar from Google       │
   │  - Organization details     │
   └───────────┬─────────────────┘
               │
               ▼
   ┌─────────────────────────────┐
   │  GuestAuthGuard validates   │
   │  - User authenticated       │
   │  - Role === "guest"         │
   │  - Has org access           │
   └───────────┬─────────────────┘
               │
               ▼
   ┌─────────────────────────────┐
   │  Access granted to          │
   │  Guest Portal               │
   │  Status: "joined"           │
   │  lastLogin: <timestamp>     │
   └─────────────────────────────┘
```

---

## Key Features

### ✅ Automatic Status Update
- First login automatically changes status from "invited" to "joined"
- No manual intervention needed

### ✅ Guest Portal Protection (Auth Guard)
- All guest portal routes are protected by `GuestAuthGuard`
- Only users with `role: "guest"` can access
- Must be authenticated via Firebase
- Located in: `/src/app/(guest-portal)/layout.tsx`

### ✅ Unified Member Storage
- Guests are stored in `members` collection (not separate `guests` collection)
- Same structure as admins and hiring managers
- Differentiated by `role: "guest"` field

### ✅ Two-Email System
1. **Invitation Email** (sent on invite):
   - Beautiful guest invitation template
   - Sent via Mailgun
   - Includes login link and company info
   - Sent when admin invites the guest

2. **Welcome Email** (sent on first login):
   - Includes complete profile from Google SSO
   - Shows user's avatar (profile picture)
   - Displays full name from Google account
   - Contains organization details
   - Confirms successful account activation
   - Sent automatically when status changes to "joined"

---

## Testing

### Test First Login & Welcome Email:
1. Admin invites guest via Members page
2. Guest receives **invitation email**
3. Guest clicks "Log In" button
4. Guest logs in with Google
5. Check database: status should change "invited" → "joined"
6. Guest receives **welcome email** with their profile info
7. Check API:
   ```
   GET /api/check-member-status?email=guest@example.com&orgID=<orgID>
   ```
8. Verify welcome email includes:
   - User's Google profile picture
   - Full name from Google account
   - Email address
   - Organization name
   - Role (guest)

### Test Guest Portal Access:
1. Guest logs in
2. Navigate to `/careers` or `/requisitions`
3. Should see guest portal (not redirected)
4. Non-guests should be blocked with error message

---

## Database Schema

### Members Collection
```javascript
{
  _id: ObjectId,
  name: String,
  email: String,
  image: String,
  orgID: String,
  role: "admin" | "hiring_manager" | "guest",
  status: "invited" | "joined",
  careers: Array<String>, // For hiring managers
  addedAt: Date,
  lastLogin: Date | null
}
```

---

## Environment Variables Required

```bash
# Mailgun for emails
MAILGUN_API_KEY=your_mailgun_api_key

# Firebase for authentication
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
# ... other Firebase config
```

---

## Future Enhancements

- [ ] Add email notification when guest first logs in (to admin)
- [ ] Add "last seen" tracking for guests
- [ ] Add guest activity logs
- [ ] Add guest access expiration dates
- [ ] Add bulk guest invite functionality
