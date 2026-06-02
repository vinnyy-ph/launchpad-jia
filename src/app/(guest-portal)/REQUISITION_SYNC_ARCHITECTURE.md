# Requisition Status Sync Architecture

## Overview
This document explains the current requisition status update and synchronization system between the Requisitions (Employer) page and GuestPortal page. Currently using localStorage for persistence and cross-page sync.

---

## Current Architecture (localStorage-based)

### Core Components

#### 1. **Centralized Store**
**File:** `src/lib/stores/requisitionStore.ts`
- **Purpose:** Single source of truth for requisition data
- **Key Methods:**
  - `addRequisition()` - Adds new requisition to localStorage
  - `getRequisitions()` - Retrieves all requisitions from localStorage
  - `updateRequisitionStatus(id, status, metadata, fullRequisition)` - Updates status with optional metadata (reasons, requester info)
  - `deleteRequisition(id)` - Removes requisition
  - `subscribeToChanges(callback)` - Listens for localStorage updates via CustomEvent
  - `saveToStorage()` - Private method that saves to localStorage and fires "requisitionsUpdated" event

#### 2. **Type Definitions**
**File:** `src/lib/components/Requisitions/types.ts`
- Defines `RequisitionStatus` type union
- Defines `Requisition` interface with fields:
  - `moreInfoReason` - Rich text HTML for "Requires More Info" status
  - `moreInfoBy` - Name of person who requested more info
  - `cancelReason` - Plain text for "Request to Cancel" and "Cancelled" statuses
- Defines `statusPillStyles` for consistent UI across both pages

---

## Data Flow

### Status Update Flow (Requisitions Page → GuestPortal)

1. **User Action** (in Requisitions page)
   - Location: `src/lib/components/Requisitions/Modal/ViewFormModal.tsx` OR
   - Location: `src/lib/components/Requisitions/Table/RequisitionActionsDropdown.tsx`
   
2. **Status Update Hook**
   - Location: `src/lib/components/Requisitions/Modal/useUpdateRequisitionStatus.ts`
   - Determines metadata based on status (moreInfoReason, cancelReason, etc.)
   - Calls `requisitionStore.updateRequisitionStatus()`
   
3. **Store Update**
   - Location: `src/lib/stores/requisitionStore.ts`
   - Updates or adds requisition to localStorage
   - Fires CustomEvent `"requisitionsUpdated"`
   
4. **Requisitions Page Listener**
   - Location: `src/lib/components/Requisitions/index.tsx`
   - `useEffect` subscribes to requisitionStore changes
   - Updates local state when event fires
   
5. **GuestPortal Listener**
   - Location: `src/lib/components/GuestPortal/Requisitions/RequisitionsContext.tsx`
   - `useEffect` subscribes to requisitionStore changes
   - Converts stored requisitions to RequisitionItem format
   - Updates context state → all GuestPortal components re-render

### Status Update Flow (GuestPortal → Requisitions Page)

1. **User Action** (in GuestPortal)
   - Location: `src/lib/components/GuestPortal/Requisitions/RequisitionTable.tsx`
   - `handleCancelRequest()` for "Request to Cancel"
   
2. **Direct Store Update**
   - Calls `requisitionStore.updateRequisitionStatus()` with metadata
   
3. **Event Propagation**
   - Same as steps 3-5 above
   - Both pages receive the update simultaneously

---

## File Structure & Responsibilities

### Requisitions Page (Employer Side)

#### Status Update Sources
1. **ViewFormModal.tsx**
   - Path: `src/lib/components/Requisitions/Modal/ViewFormModal.tsx`
   - Handlers:
     - `handleConfirmMakeActive()` → Active
     - `handleConfirmPutOnHold()` → On Hold
     - `handleConfirmCancel(details)` → Cancelled + cancelReason
     - `handleConfirmRequestMoreInfo(details)` → Requires More Info + moreInfoReason + moreInfoBy
     - `handleConfirmApprove()` → Active

2. **RequisitionActionsDropdown.tsx**
   - Path: `src/lib/components/Requisitions/Table/RequisitionActionsDropdown.tsx`
   - Uses `useUpdateRequisitionStatus` hook
   - Same handlers as ViewFormModal but calls hook instead of direct store

3. **useUpdateRequisitionStatus.ts**
   - Path: `src/lib/components/Requisitions/Modal/useUpdateRequisitionStatus.ts`
   - Wrapper hook that:
     - Accepts status, details, fullRequisition
     - Determines metadata based on status type
     - Calls requisitionStore.updateRequisitionStatus()
     - Simulates API call delay (500ms)

#### Display Components
1. **RequisitionRow.tsx**
   - Path: `src/lib/components/Requisitions/Table/RequisitionRow.tsx`
   - Displays status pills with helper icons
   - Shows tooltips on click for statuses with reasons
   - Tooltip logic:
     - "Requires More Info" → Shows moreInfoReason (rich text)
     - "Request to Cancel" / "Cancelled" → Shows cancelReason (plain text)
     - Formats "Others (please specify reason*) - value" to "Others: value"

2. **Tooltip Component**
   - Path: `src/lib/components/GuestPortal/Requisitions/tooltip.tsx`
   - Shared component used by both pages
   - Displays title and content (supports rich text)

#### Main Container
- **index.tsx**
  - Path: `src/lib/components/Requisitions/index.tsx`
  - Subscribes to requisitionStore changes
  - Merges localStorage data with mock data
  - Provides `updateRequisitionStatus` callback to child components

---

### GuestPortal Page (Candidate/Creator Side)

#### Status Update Sources
1. **RequisitionTable.tsx**
   - Path: `src/lib/components/GuestPortal/Requisitions/RequisitionTable.tsx`
   - `handleCancelRequest(id, reason)` - Updates to "Request to Cancel" with cancelReason

#### Display Components
1. **RequisitionRow.tsx**
   - Path: `src/lib/components/GuestPortal/Requisitions/RequisitionRow.tsx`
   - Similar to Requisitions page RequisitionRow
   - Shows status pills with helper icons
   - Tooltip on click shows reasons
   - Same formatting logic for "Others" reason

2. **MoreInfoContainer.tsx**
   - Path: `src/lib/components/GuestPortal/Form/MoreInfoContainer.tsx`
   - Displays in edit/view form when status is "Requires More Info"
   - Shows yellow banner with requester name
   - Shows white card with full moreInfoReason (rich text HTML)

3. **CreateRequisitionForm.tsx**
   - Path: `src/lib/components/GuestPortal/Form/CreateRequisitionForm.tsx`
   - Receives `status`, `moreInfoReason`, `moreInfoBy` as props
   - Conditionally renders MoreInfoContainer when status is "Requires More Info"

#### Context Provider
- **RequisitionsContext.tsx**
  - Path: `src/lib/components/GuestPortal/Requisitions/RequisitionsContext.tsx`
  - Subscribes to requisitionStore changes
  - Converts StoredRequisition to RequisitionItem format
  - Includes moreInfoReason, moreInfoBy, cancelReason in conversion
  - Merges with mock data (avoiding duplicates)

#### Main Container
- **index.tsx**
  - Path: `src/lib/components/GuestPortal/Requisitions/index.tsx`
  - Uses RequisitionsContext
  - Passes requisitions to RequisitionTable

---

## Detailed Process Flows by Status

### 1. "Request to Cancel" Process

**Initiated From:** GuestPortal (Requisition creator)

#### Step-by-Step Flow:

1. **User Action**
   - Location: `src/lib/components/GuestPortal/Requisitions/RequisitionTable.tsx`
   - User clicks "Request to Cancel" from actions dropdown
   - Component: `RequisitionActionsDropdown.tsx` shows cancel request modal

2. **Modal Interaction**
   - Location: `src/lib/components/GuestPortal/Requisitions/CancelRequestModal.tsx`
   - User selects reason from dropdown options:
     - "Position no longer needed"
     - "Filled through another channel"
     - "Budget constraints"
     - "Timeline changed"
     - "Others (please specify reason*)" + custom text input
   - If "Others" selected, user enters custom reason

3. **Submit Cancel Request**
   - `handleCancelRequest(requisitionId, reason)` called
   - Function location: `RequisitionTable.tsx` line 22-42
   
4. **Find Full Requisition**
   ```javascript
   const fullRequisition = localRequisitions.find(r => r.id === requisitionId);
   ```

5. **Update localStorage**
   ```javascript
   requisitionStore.updateRequisitionStatus(
     requisitionId, 
     "Request to Cancel",
     { cancelReason: reason },
     fullRequisition
   );
   ```

6. **Store Processing**
   - Location: `src/lib/stores/requisitionStore.ts`
   - Checks if requisition exists in localStorage
   - If exists: Updates status + adds cancelReason
   - If not exists (mock data): Creates new StoredRequisition with all data
   - Saves to localStorage
   - Fires CustomEvent `"requisitionsUpdated"`

7. **Local State Update (GuestPortal)**
   ```javascript
   setLocalRequisitions((prev) =>
     prev.map((item) =>
       item.id === requisitionId
         ? { ...item, status: "Request to Cancel", cancelReason: reason }
         : item
     )
   );
   ```
   - Immediate UI feedback without waiting for event

8. **Event Propagation**
   - CustomEvent captured by both pages simultaneously

9. **GuestPortal Context Update**
   - Location: `src/lib/components/GuestPortal/Requisitions/RequisitionsContext.tsx`
   - Subscription listener receives update (line 44-60)
   - Converts StoredRequisition → RequisitionItem (includes cancelReason)
   - Updates context state → All components re-render

10. **Requisitions Page Update**
    - Location: `src/lib/components/Requisitions/index.tsx`
    - Subscription listener receives update (line 36-42)
    - Merges stored requisitions with mock data
    - Updates state → Table re-renders

11. **UI Display (Both Pages)**
    - **Status Pill:** Pink background with "Request to Cancel" text
    - **Helper Icon:** Red helper icon appears next to status
    - **Tooltip:** Click icon to see tooltip with reason
    - **Formatting:** If reason contains "Others (please specify reason*) - value"
      - Displayed as: "Others: value"

---

### 2. "Request More Info" Process

**Initiated From:** Requisitions Page (Employer/Recruiter)

#### Step-by-Step Flow:

1. **User Action**
   - Location: `src/lib/components/Requisitions/Modal/ViewFormModal.tsx` OR
   - Location: `src/lib/components/Requisitions/Table/RequisitionActionsDropdown.tsx`
   - User clicks "Request More Info" button

2. **Modal Interaction**
   - Component: `StatusChangeModal.tsx`
   - Shows textarea with placeholder "Specify details"
   - User enters detailed reason (supports plain text)
   - Reason is saved as-is (can be converted to HTML later)

3. **Submit Request**
   - **From ViewFormModal:**
     - `handleConfirmRequestMoreInfo(details)` called (line 195-215)
     - Directly calls `requisitionStore.updateRequisitionStatus()`
   
   - **From ActionsDropdown:**
     - `handleConfirmRequestMoreInfo(details)` called (line 120-129)
     - Calls `updateStatus()` hook (line 122)
     - Hook location: `useUpdateRequisitionStatus.ts`

4. **Hook Processing (if from dropdown)**
   - Location: `src/lib/components/Requisitions/Modal/useUpdateRequisitionStatus.ts`
   - Determines metadata (line 24-32):
     ```javascript
     if (newStatus === "Requires More Info" && details) {
       metadata.moreInfoReason = details;
       metadata.moreInfoBy = fullRequisition?.submittedBy?.name || "Admin";
     }
     ```
   - Calls `requisitionStore.updateRequisitionStatus()`

5. **Store Processing**
   - Location: `src/lib/stores/requisitionStore.ts`
   - Updates or creates requisition with:
     - `status: "Requires More Info"`
     - `moreInfoReason: details`
     - `moreInfoBy: "Recruiter Name"`
   - Fires CustomEvent

6. **Event Propagation (Both Pages)**
   - Requisitions page updates immediately
   - GuestPortal Context receives update

7. **GuestPortal Display**
   - **Table View:**
     - Yellow pill with "Requires More Info" text
     - Warning icon next to status
     - Click icon → Tooltip shows reason
   
   - **Form View (Edit/View Mode):**
     - Location: `src/lib/components/GuestPortal/Form/CreateRequisitionForm.tsx`
     - Checks: `status === "Requires More Info" && moreInfoReason && moreInfoBy`
     - Renders `MoreInfoContainer` component (line 308-310)
     
   - **MoreInfoContainer Display:**
     - Location: `src/lib/components/GuestPortal/Form/MoreInfoContainer.tsx`
     - Yellow banner at top of form
     - Shows avatar circle with initials of `moreInfoBy`
     - Shows: "{moreInfoBy} | Requires More Info"
     - White card below with full `moreInfoReason` text (supports HTML)

8. **Requisitions Page Display**
   - Yellow pill with warning icon
   - Click icon → Tooltip shows reason (supports rich text/HTML)

---

### 3. "Cancel" Process (Complete Cancellation)

**Initiated From:** Requisitions Page (Employer/Recruiter)

#### Step-by-Step Flow:

1. **User Action**
   - Location: `src/lib/components/Requisitions/Modal/ViewFormModal.tsx` (line 172-174) OR
   - Location: `src/lib/components/Requisitions/Table/RequisitionActionsDropdown.tsx` (line 96-99)
   - User clicks "Cancel Requisition" option

2. **Modal Interaction**
   - Component: `StatusChangeModal.tsx`
   - Shows textarea for optional cancellation reason
   - Placeholder: "Reason for cancellation"
   - User can enter or skip

3. **Submit Cancellation**
   - **From ViewFormModal:**
     - `handleConfirmCancel(details)` called (line 177-188)
     - Directly updates localStorage with cancelReason
   
   - **From ActionsDropdown:**
     - `handleConfirmCancel(details)` called (line 102-111)
     - Uses `updateStatus()` hook

4. **Store Update**
   - Updates to `status: "Cancelled"`
   - If details provided: Adds `cancelReason`
   - Fires CustomEvent

5. **UI Display (Both Pages)**
   - **Red pill** with "Cancelled" text
   - **Helper icon** (only if cancelReason exists)
   - Click icon → Tooltip shows reason
   - Requisition becomes read-only

---

### 4. "Make Active" / "Approve" Process

**Initiated From:** Requisitions Page

#### Step-by-Step Flow:

1. **User Action**
   - Two buttons can trigger:
     - "Make Active" - for resuming held requisitions
     - "Approve" - for approving new requisitions

2. **Handler Called**
   - `handleConfirmMakeActive()` OR `handleConfirmApprove()`
   - Both update status to "Active"

3. **Store Update**
   - No metadata required
   - Simply updates: `status: "Active"`
   - Fires CustomEvent

4. **Display**
   - Green pill with "Active" text
   - No icon, no tooltip
   - Requisition is now live

---

### 5. "Put On Hold" Process

**Initiated From:** Requisitions Page

#### Step-by-Step Flow:

1. **User Action**
   - Click "Put On Hold" option

2. **Modal Confirmation**
   - Simple confirmation modal (no details input)

3. **Handler Called**
   - `handleConfirmPutOnHold()`

4. **Store Update**
   - Updates: `status: "On Hold"`
   - No metadata
   - Fires CustomEvent

5. **Display**
   - Gray pill with "On Hold" text
   - No icon, no tooltip
   - Requisition is paused

---

## Status-Specific Metadata Summary

### "Requires More Info"
- **Metadata Fields:**
  - `moreInfoReason` (string, can be HTML) - Rich text reason entered by employer
  - `moreInfoBy` (string) - Name of person who requested more info
- **Tooltip Location:** Both pages - Click warning icon on yellow pill
- **Additional Display:** GuestPortal form shows MoreInfoContainer banner

### "Request to Cancel"
- **Metadata Fields:**
  - `cancelReason` (string) - Plain text reason from dropdown + custom input
- **Tooltip Location:** Both pages - Click helper icon on pink pill
- **Formatting:** "Others (please specify reason*) - value" → "Others: value"

### "Cancelled"
- **Metadata Fields:**
  - `cancelReason` (string, optional) - Plain text reason
- **Tooltip Location:** Both pages - Click helper icon on red pill (only if reason exists)
- **Formatting:** Same as "Request to Cancel"

### Other Statuses
- **"Active"** - Green pill, no metadata, no tooltip
- **"On Hold"** - Gray pill, no metadata, no tooltip
- **"In Review"** - Blue pill, no metadata, no tooltip

---

## Requisition Mutability Rules (Read-only States)

### Business Rule

- **BR1:** Once a requisition reaches status **"Active"** (and a linked draft career is created), it becomes **fully locked**.
  - No further edits to its **form data** are allowed.
  - No further **status changes** are allowed from either side (employer or guest portal).
- **BR2:** Requisitions in **"Cancelled"** or **"Completed"** remain read-only as before; this rule clarifies that **"Active"** is also a terminal, read-only state in the requisition lifecycle.
- **BR3:** Any additional changes after a requisition is Active must happen on the **career** object (e.g., pausing or closing the career), not by mutating the originating requisition.

### Frontend – Employer Requisitions UI (Recruiter Dashboard)

- **FE1 (Edit entry points):**
  - Components such as:
    - `src/lib/components/Requisitions/Modal/ViewFormModal.tsx`
    - `src/lib/components/Requisitions/Table/RequisitionActionsDropdown.tsx`
  - **Must only surface edit flows** ("Edit details" buttons, editable form fields) when requisition status is in an **editable set**:
    - Editable statuses: `"In Review"`, `"Requires More Info"`.
    - Non-editable (read-only) statuses: `"Active"`, `"On Hold"`, `"Cancelled"`, `"Completed"`.
- **FE2 (Read-only view and no status actions for Active):**
  - When loading a requisition whose status is **Active** (or later terminal states), the employer-side form should:
    - Render fields **in read-only mode** (e.g., disabled inputs / plain text) or a read-only summary view.
    - Hide or disable **all primary actions that would mutate form data or status** (e.g., Approve, Make Active, Put On Hold, Cancel Requisition, Request More Info, Request to Cancel).
  - Any direct navigation to an edit URL for an Active requisition (e.g. deep links) should resolve to a **read-only view** plus an explanatory copy (e.g., "Active requisitions can no longer be edited or cancelled from this page.").

### Frontend – Guest Portal Requisitions UI

- **FE3 (Creator-side editing):**
  - On the Guest Portal requisitions list and form (e.g., `src/lib/components/GuestPortal/Requisitions/RequisitionTable.tsx`, `CreateRequisitionForm.tsx`):
    - When status is **Active**, the originating Guest **must not be able to edit** the original requisition form data.
    - Any edit/resubmit flows should be gated to non-read-only statuses (e.g., `"In Review"`, `"Requires More Info"`).
- **FE4 (Actions dropdown and cancel):**
  - Once a requisition is **Active**, Guest Portal must **not** show any actions that mutate status (including **Request to Cancel**).
  - UI may still show a read-only view or status pill for Active, but **no buttons/menus** that change status or form data.

### Backend / API Enforcement

- **BE1 (Edit vs. read-only statuses):**
  - Backend must enforce the same editable vs. read-only distinction as the UI:
    - Editable statuses for **form updates**: `"In Review"`, `"Requires More Info"`.
    - Read-only statuses for **form updates**: `"Active"`, `"On Hold"`, `"Cancelled"`, `"Completed"`.
- **BE2 (Update endpoint – form data):**
  - For the requisition **update** endpoint (e.g., `PUT /api/requisitions/:id`):
    - When current requisition status is **not** in the editable set, the endpoint **must reject** any request that attempts to modify `formData`.
    - Response shape (example):
      - `statusCode: 400` or `403`.
      - `message`: "Cannot edit requisition with status 'Active'. Only requisitions with status 'In Review' or 'Requires More Info' can be edited."
  - This ensures that even if the frontend fails to hide controls, **Active requisitions stay immutable** at the API layer.
- **BE3 (Status updates – lock after Active):**
  - The status update endpoint (e.g., `PATCH /api/requisitions/:id/status`) must:
    - Allow status transitions only while requisition is **not yet Active**.
    - Once status is **Active**, reject any attempt to change status (including `Request to Cancel`, `Cancelled`, `On Hold`, `Requires More Info`, etc.).
    - Return a clear error such as:
      - `statusCode: 400` or `403`.
      - `message`: "Cannot change status of an active requisition. Manage the linked career instead."

### Guards – `requisitionAuthGuard`

- **GU1 (Editable statuses list):**
  - `validateRequisitionAccess` uses an internal `EDITABLE_STATUSES` list, which must be aligned with this spec:
    - `EDITABLE_STATUSES = ["In Review", "Requires More Info"]`.
  - When an update operation is classified as a **write** for form data, and the current status is not in `EDITABLE_STATUSES`, the guard must:
    - Return `authorized: false`.
    - Include a clear error message consistent with **BE2** above.
- **GU2 (Status transitions – hard lock after Active):**
  - `validateStatusTransition` continues to govern which **status** values can be set from a given current status and role.
  - Additionally, once `currentStatus === "Active"`, all further status transitions must be rejected (regardless of role), with a clear error message consistent with **BE3**.
- **GU3 (Guest vs. employer roles):**
  - Guests are still constrained to requesting cancellation only (`"Request to Cancel"`) **before** the requisition becomes Active.
  - After Active, neither Guests nor admins/recruiters can change status or form data on the requisition; changes must be performed on the career.

---

## Mock Data Handling

### Challenge
Mock requisitions from `src/lib/components/Requisitions/mock/mockRequisitions.ts` and `src/lib/components/GuestPortal/mock/requisitions.ts` don't exist in localStorage initially.

### Solution
- `requisitionStore.updateRequisitionStatus()` accepts optional 4th parameter: `fullRequisition`
- If requisition ID not found in localStorage AND fullRequisition provided:
  - Creates new StoredRequisition with status + metadata
  - Adds to localStorage
  - Fires update event
- This allows mock data to be "promoted" to localStorage on first status update

---

## Future Migration Plan (Backend/API Integration)

### Phase 1: Create API Endpoints
**Backend endpoints needed:**
- `GET /api/requisitions` - List all requisitions
- `GET /api/requisitions/:id` - Get single requisition
- `POST /api/requisitions` - Create requisition
- `PATCH /api/requisitions/:id/status` - Update status with metadata
  - Body: `{ status, moreInfoReason?, moreInfoBy?, cancelReason? }`
- `DELETE /api/requisitions/:id` - Delete requisition

### Phase 2: Replace requisitionStore
**File to replace:** `src/lib/stores/requisitionStore.ts`

**New approach:**
- Remove localStorage logic
- Replace with API fetch calls
- Keep CustomEvent pattern for real-time updates (or use WebSocket/polling)

### Phase 3: Create/Update API Hooks

**New hooks needed:**

1. **useFetchRequisitions** (GET all)
   - Path: Create in `src/lib/hooks/` or similar
   - Replace localStorage subscription in:
     - `src/lib/components/Requisitions/index.tsx`
     - `src/lib/components/GuestPortal/Requisitions/RequisitionsContext.tsx`

2. **useFetchRequisitionById** (GET one)
   - Already exists: `src/lib/components/GuestPortal/Requisitions/useRequisitionData.ts`
   - Update to call API instead of searching context

3. **useUpdateRequisitionStatus** (PATCH status)
   - Already exists: `src/lib/components/Requisitions/Modal/useUpdateRequisitionStatus.ts`
   - Update to call API endpoint
   - Keep metadata structure the same
   - On success, trigger refetch or update cache

4. **useCreateRequisition** (POST)
   - Already exists: `src/lib/components/GuestPortal/Requisitions/useCreateRequisition.ts`
   - Update to call API endpoint

### Phase 4: Update Components

**Minimal changes needed in:**

1. **Status update handlers** - No changes needed, they call hooks
   - `ViewFormModal.tsx`
   - `RequisitionActionsDropdown.tsx`
   - `RequisitionTable.tsx`

2. **Display components** - No changes needed, they receive props
   - `RequisitionRow.tsx` (both pages)
   - `MoreInfoContainer.tsx`
   - Tooltip components

3. **Context/State management**
   - `RequisitionsContext.tsx` - Replace localStorage subscription with API hook
   - `Requisitions/index.tsx` - Replace localStorage subscription with API hook

### Phase 5: Real-time Updates

**Options:**

1. **Polling** - Fetch every X seconds
2. **WebSocket** - Server pushes updates
3. **Server-Sent Events (SSE)** - Server streams updates
4. **Optimistic Updates** - Update UI immediately, sync with API in background

**Implementation location:**
- Add to API hooks (useFetchRequisitions, etc.)
- Keep CustomEvent pattern for cross-component communication

---

## Key Metadata Fields

### Database Schema Considerations

```typescript
// Requisition model should include:
{
  id: string
  positionName: string
  status: RequisitionStatus
  moreInfoReason?: string  // HTML string
  moreInfoBy?: string      // User name or ID
  cancelReason?: string    // Plain text
  // ... other fields
}
```

### API Response Format

**Status update endpoint:**
```json
{
  "success": true,
  "requisition": {
    "id": "123",
    "status": "Requires More Info",
    "moreInfoReason": "<p>Please clarify budget</p>",
    "moreInfoBy": "John Doe",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

---

## Testing Checklist for Migration

### Status Updates
- [ ] Update from Requisitions page → Syncs to GuestPortal
- [ ] Update from GuestPortal → Syncs to Requisitions page
- [ ] All status transitions work (Active, On Hold, Cancelled, etc.)
- [ ] Metadata (reasons, requester) persists correctly

### Tooltips
- [ ] "Requires More Info" tooltip shows on both pages
- [ ] "Request to Cancel" tooltip shows on both pages
- [ ] "Cancelled" tooltip shows when reason exists
- [ ] "Others: [value]" formatting works correctly

### Mock Data
- [ ] Can update mock requisitions without errors
- [ ] Mock data promoted to database on first update

### Real-time Sync
- [ ] Multiple tabs/windows stay in sync
- [ ] No race conditions on simultaneous updates

---

## Files Reference

### Core Files (Must Update)
- `src/lib/stores/requisitionStore.ts` → Replace with API calls
- `src/lib/components/Requisitions/Modal/useUpdateRequisitionStatus.ts` → Call API endpoint
- `src/lib/components/GuestPortal/Requisitions/useRequisitionData.ts` → Call API endpoint
- `src/lib/components/Requisitions/index.tsx` → Use API hooks
- `src/lib/components/GuestPortal/Requisitions/RequisitionsContext.tsx` → Use API hooks

### UI Files (No Changes Needed)
- `src/lib/components/Requisitions/Table/RequisitionRow.tsx`
- `src/lib/components/GuestPortal/Requisitions/RequisitionRow.tsx`
- `src/lib/components/Requisitions/Modal/ViewFormModal.tsx`
- `src/lib/components/Requisitions/Table/RequisitionActionsDropdown.tsx`
- `src/lib/components/GuestPortal/Requisitions/RequisitionTable.tsx`
- `src/lib/components/GuestPortal/Form/MoreInfoContainer.tsx`
- `src/lib/components/GuestPortal/Requisitions/tooltip.tsx`

### Type Files (No Changes Needed)
- `src/lib/components/Requisitions/types.ts`
- `src/lib/components/GuestPortal/mock/requisitions.ts`

---

## Notes

- Current implementation uses localStorage CustomEvents for instant cross-page sync
- All status updates go through centralized store for consistency
- Tooltip formatting logic is duplicated in both RequisitionRow components (consider extracting to shared utility)
- Rich text (HTML) used for moreInfoReason, plain text for cancelReason
- Mock data handling allows seamless transition from mock to real data

---

**Last Updated:** November 24, 2025
**Current Version:** localStorage-based sync
**Next Phase:** Backend API integration
