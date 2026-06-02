# Multi-Role Support for Same Email

## Problem
When testing, you noticed that the same email could not have different roles (e.g., someone being an admin in Org A and a guest in Org B). The system was treating this as invalid and failing authentication.

## Solution
Updated the authentication flow to support **multiple roles for the same email** across different organizations.

---

## What Changed

### 1. **Auth Route** (`/api/auth/route.ts`)

**Before:**
```typescript
if (orgMember.length > 0) {
  const member = orgMember[0];  // ❌ Only updates first membership
  
  // Update only ONE member record
  await db.collection("members").updateOne(...)
  
  return NextResponse.json(member);
}
```

**After:**
```typescript
if (orgMember.length > 0) {
  // ✅ Loop through ALL memberships
  for (const member of orgMember) {
    // Update EACH member record independently
    await db.collection("members").updateOne(
      { email: email, orgID: member.orgID },  // ← Scoped by org
      { ... }
    );
    
    // Send welcome email only for guests
    if (member.role === "guest") {
      await sendEmail(...);
    }
  }
  
  return NextResponse.json(orgMember[0]);
}
```

---

## How It Works Now

### Scenario: Same email, multiple roles

**Example:**
- `john@example.com` is an **admin** in **Org A**
- `john@example.com` is a **guest** in **Org B**

### Database Structure:

```json
// members collection
[
  {
    "_id": "...",
    "email": "john@example.com",
    "orgID": "orgA_id",
    "role": "admin",
    "status": "joined",
    "name": "John Doe",
    "image": "https://..."
  },
  {
    "_id": "...",
    "email": "john@example.com",
    "orgID": "orgB_id",
    "role": "guest",
    "status": "invited",
    "name": "John",
    "image": "https://dicebear..."
  }
]
```

### Authentication Flow:

```
1. John logs in with Google
   ↓
2. Auth route finds BOTH records
   ↓
3. Loop through each membership:
   
   For Org A (admin):
   ✅ Update lastLogin
   ✅ Update name/image from Google
   
   For Org B (guest):
   ✅ Update status: "invited" → "joined"
   ✅ Update lastLogin
   ✅ Update name/image from Google
   ✅ Send welcome email (guest only)
   ↓
4. Return first membership to frontend
   ↓
5. Frontend handles org switching UI
```

---

## Key Features

### ✅ **Same Email, Multiple Organizations**
```
john@example.com can be:
- Admin in Organization A
- Hiring Manager in Organization B  
- Guest in Organization C
- All at the same time!
```

### ✅ **Independent Status Tracking**
Each membership has its own:
- Status (`"invited"` or `"joined"`)
- `lastLogin` timestamp
- Profile data
- Role

### ✅ **Guest-Only Welcome Emails**
```typescript
if (member.role === "guest") {
  // Only guests get welcome emails
  await sendEmail({...});
}
```
Admins and hiring managers don't get welcome emails on first login.

### ✅ **Profile Sync Across All Roles**
When you login, ALL your memberships across ALL orgs get updated with your latest Google profile:
- Name
- Avatar/Image
- lastLogin timestamp

---

## Example Use Cases

### Use Case 1: External Consultant
```
Sarah is a consultant who works with multiple companies:
- Admin at Company A (her main client)
- Guest at Company B (occasional reviewer)
- Guest at Company C (project advisor)

✅ Same email (sarah@consultant.com)
✅ Different roles per organization
✅ One Google login for everything
```

### Use Case 2: Internal Promotions
```
Mike started as a guest and got promoted:
- Guest at Company X (initial role)
- Later promoted to Hiring Manager at Company X

✅ Can keep both records for history
✅ Or admin can remove old guest role
✅ System handles multiple roles gracefully
```

### Use Case 3: Testing
```
During testing, developers can:
- Create admin role for test@example.com in Org A
- Create guest role for test@example.com in Org B
- Login with same Google account
- Switch between organizations

✅ No conflicts
✅ Independent testing
✅ Clean data separation
```

---

## Database Query Details

### Add Member
```typescript
// Check if member exists in THIS org
const member = await db.collection("members").findOne({ 
  email, 
  orgID  // ← Scoped by organization
});

if (member) {
  // Member exists in this org
  if (member.status !== "invited") {
    return error("Member already exists");
  }
  // Resend invitation
}

// Create new member (even if email exists in other orgs)
await db.collection("members").insertOne({
  email,
  orgID,  // ← Different orgID = different record
  role,
  ...
});
```

### Authentication
```typescript
// Find ALL memberships for this email
const orgMember = await db.collection("members").aggregate([
  { $match: { email: email } },  // ← Find all records with this email
  {
    $lookup: {
      from: "organizations",
      // Join with organization details
      ...
    }
  }
]).toArray();

// Update ALL memberships
for (const member of orgMember) {
  await db.collection("members").updateOne(
    { email: email, orgID: member.orgID },  // ← Update each org separately
    { $set: { name, image, lastLogin, ... } }
  );
}
```

---

## Email Templates Updated

All email templates now use the correct WhiteCloak logo:

```typescript
const WHITECLOAK_LOGO_URL = process.env.NEXT_PUBLIC_WHITECLOAK_LOGO_URL || 
  'https://tmkxsbrhgrbqzyhtylox.supabase.co/storage/v1/object/public/sample/image28.png';
```

**Files updated:**
1. `/api/add-member/route.ts` ✅
2. `/api/send-invitation/route.ts` ✅
3. `/api/send-guest-invitation/route.ts` ✅
4. `/api/email-preview/route.ts` ✅

---

## Testing

### Test Multiple Roles:

1. **Create admin role**
   ```bash
   POST /api/add-member
   {
     "email": "test@example.com",
     "orgID": "orgA",
     "role": "admin"
   }
   ```

2. **Create guest role (same email, different org)**
   ```bash
   POST /api/add-member
   {
     "email": "test@example.com",
     "orgID": "orgB",
     "role": "guest"
   }
   ```

3. **Login with Google**
   - Both records updated ✅
   - Welcome email sent only for guest role ✅
   - Can switch between organizations in UI ✅

4. **Verify database**
   ```bash
   # Should see 2 records
   db.members.find({ email: "test@example.com" })
   
   # Result:
   [
     { email: "test@example.com", orgID: "orgA", role: "admin", status: "joined" },
     { email: "test@example.com", orgID: "orgB", role: "guest", status: "joined" }
   ]
   ```

---

## Summary

✅ **Same email can have multiple roles**  
✅ **Each org membership is independent**  
✅ **All memberships updated on login**  
✅ **Welcome emails only for guests**  
✅ **Profile data synced across all orgs**  
✅ **Clean separation of concerns**  

The system now fully supports multi-role, multi-organization scenarios! 🎉
