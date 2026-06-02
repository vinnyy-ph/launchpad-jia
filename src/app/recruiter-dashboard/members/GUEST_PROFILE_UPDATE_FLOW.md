# Guest Profile Update Flow

## Problem
When a guest is initially invited, we only have their email address. We need to update the database with their actual first name, last name, and avatar from Google when they login.

## Solution
Two-stage profile management:

---

## Stage 1: Initial Invitation (Placeholder Data)

### What happens when admin invites a guest:

```typescript
// Initial member creation in /api/add-member
const newMember = {
  email: "guest@example.com",
  name: "Guest",                    // ← Placeholder from email
  image: "https://..dicebear..",    // ← Placeholder avatar
  status: "invited",
  lastLogin: null,
  role: "guest",
  orgID: "...",
  addedAt: new Date()
}
```

**Invitation Email Sent:**
- Uses placeholder name ("Guest")
- Invitation template
- Login button included

---

## Stage 2: First Login (Real Google Profile Data)

### What happens when guest logs in with Google:

```typescript
// In /api/auth route
if (isFirstLogin) {
  // Update database with REAL Google profile data
  await db.collection("members").updateOne(
    { email: email, orgID: member.orgID },
    {
      $set: {
        name: "John Doe",           // ← Real name from Google
        image: "https://...jpg",    // ← Real avatar from Google
        status: "joined",
        lastLogin: new Date()
      }
    }
  );
  
  // Send welcome email with REAL profile data
  await sendEmail({
    recipient: email,
    html: getGuestWelcomeTemplate(
      "John Doe",              // ← Real name
      "guest@example.com",
      "https://...jpg",        // ← Real avatar
      "Company Name",
      "guest"
    ),
    subject: "Welcome to Jia, John Doe! 🎉"
  });
}
```

---

## Profile Data Sources

### Initial Invite (Placeholder):
| Field | Source | Example |
|-------|--------|---------|
| `email` | Admin input | `john.doe@example.com` |
| `name` | Extracted from email | `John` (from email prefix) |
| `image` | Generated avatar | `https://api.dicebear.com/...` |
| `status` | Set to "invited" | `"invited"` |

### After Google Login (Real):
| Field | Source | Example |
|-------|--------|---------|
| `email` | Same | `john.doe@example.com` |
| `name` | **Google profile** | `John Doe` (Full name) |
| `image` | **Google profile** | `https://lh3.googleusercontent.com/...` |
| `status` | Updated | `"joined"` |

---

## Subsequent Logins

### Every time the guest logs in:

```typescript
// In /api/auth route
else {
  // Update profile data (in case user changed their Google profile)
  await db.collection("members").updateOne(
    { email: email, orgID: member.orgID },
    {
      $set: {
        name: name,        // ← Always update from Google
        image: image,      // ← Always update from Google
        lastLogin: new Date()
      }
    }
  );
}
```

**Why update every time?**
- User might change their Google profile name
- User might change their Google profile picture
- Ensures database always has latest profile data

---

## Email Templates

### 1. Invitation Email (uses placeholder)
```
Hi Guest!              ← Placeholder name from email

[WhiteCloak Logo]
Company Name
has invited you to join Jia

[Hands Icon]

Welcome to Jia!

[Log In Button]
```

### 2. Welcome Email (uses real Google data)
```
[Google Avatar]        ← Real profile picture

Welcome, John Doe! 🎉  ← Real full name

You've successfully joined Company Name as a guest on Jia!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your Account Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: John Doe         ← Real name
Email: john@example.com
Role: guest
Organization: Company Name
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Visit Guest Portal Button]
```

---

## Database Updates Timeline

```
Time 0: Admin invites guest
┌─────────────────────────────────┐
│ members collection             │
│ email: guest@example.com       │
│ name: "Guest" (placeholder)    │
│ image: "dicebear..." (generated)│
│ status: "invited"              │
│ lastLogin: null                │
└─────────────────────────────────┘

Time 1: Guest logs in with Google
┌─────────────────────────────────┐
│ members collection             │
│ email: guest@example.com       │
│ name: "John Doe" (from Google) │ ← UPDATED
│ image: "lh3.google..." (real)  │ ← UPDATED
│ status: "joined"               │ ← UPDATED
│ lastLogin: 2024-11-24T...      │ ← UPDATED
└─────────────────────────────────┘

Time 2+: Every subsequent login
┌─────────────────────────────────┐
│ members collection             │
│ email: guest@example.com       │
│ name: "John Doe" (refreshed)   │ ← REFRESHED
│ image: "lh3.google..." (refreshed)│ ← REFRESHED
│ status: "joined"               │
│ lastLogin: [current time]      │ ← UPDATED
└─────────────────────────────────┘
```

---

## Files Modified

### 1. `/api/add-member/route.ts`
- Creates member with placeholder name/image
- Sends invitation email

### 2. `/api/auth/route.ts`
- **First login**: Updates to real Google profile, changes status to "joined", sends welcome email
- **Subsequent logins**: Refreshes profile data from Google

### 3. Email Templates
- `/api/add-member/route.ts` - Invitation email (placeholder)
- `/api/auth/route.ts` - Welcome email (real profile)
- `/api/send-invitation/route.ts` - Preview endpoint
- `/api/send-guest-invitation/route.ts` - Alternative endpoint

---

## Testing

### Verify Placeholder → Real Profile Update:

1. **Invite guest via admin panel**
   ```bash
   POST /api/add-member
   {
     "email": "test@example.com",
     "role": "guest",
     "orgID": "..."
   }
   ```

2. **Check database (should have placeholder)**
   ```bash
   GET /api/check-member-status?email=test@example.com&orgID=...
   ```
   Expected:
   ```json
   {
     "name": "Test",
     "image": "https://api.dicebear.com/...",
     "status": "invited",
     "lastLogin": null
   }
   ```

3. **Guest logs in with Google**

4. **Check database again (should have real data)**
   ```bash
   GET /api/check-member-status?email=test@example.com&orgID=...
   ```
   Expected:
   ```json
   {
     "name": "John Doe",
     "image": "https://lh3.googleusercontent.com/...",
     "status": "joined",
     "lastLogin": "2024-11-24T..."
   }
   ```

5. **Check email inbox**
   - Should receive 2 emails:
     1. Invitation email (with placeholder "Test")
     2. Welcome email (with real "John Doe" + avatar)

---

## Summary

✅ **Initial invite**: Placeholder name/image from email  
✅ **First login**: Real name/image from Google + welcome email  
✅ **Subsequent logins**: Profile data refreshed from Google  
✅ **Two emails**: Invitation (placeholder) + Welcome (real profile)  
✅ **Always up-to-date**: Database syncs with Google on every login
