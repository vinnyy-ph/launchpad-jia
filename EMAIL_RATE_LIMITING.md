# Email Rate Limiting Implementation

## Overview

Comprehensive rate limiting system for inbound emails via Mailgun webhook to prevent abuse and flooding.

## Rate Limit Tiers

### 1. Per-Sender Limits

Applies to individual email addresses (validated against `applicants` collection):

- **5 emails** per 5 minutes
- **10 emails** per hour
- **30 emails** per day

### 2. Per-IP Limits

Applies to source IP addresses:

- **20 emails** per hour

### 3. Per-Thread Limits

Applies to job application threads (identified by normalized subject):

- **3 emails** per 10 minutes per job application

### 4. Size-Based Limits

Applies to attachments:

- **Individual attachment**: Max 20MB per file
- **Frequency**: Max 3 messages with attachments per 10 minutes per sender
- **Daily quota**: Max 50MB total attachments per day per sender

## Technical Implementation

### Database Structure

Collection: `mailgun-rate-limits`

Document schema:

```typescript
{
  type: string,        // "sender" | "ip" | "thread" | "attachment"
  key: string,         // email address | IP | threadId | email
  timestamp: Date,     // when the event occurred
  size?: number,       // (optional) for attachment type - size in bytes
  _id: ObjectId
}
```

Indexes:

- TTL index on `timestamp` (expires after 24 hours)
- Compound index on `{ type, key, timestamp }`

### Processing Flow

1. **Extract Metadata**

   - Sender email from `from` field (validated against `applicants`)
   - Client IP from headers: `x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`, or `Received`

2. **Sender Validation**

   - Extract email address (handles "Name <email>" format)
   - Query `applicants` collection (case-insensitive regex match)
   - Reject if not found

3. **Rate Limit Checks** (before processing)

   - Per-sender: Check 5min, 1hour, 1day windows
   - Per-IP: Check 1hour window
   - Per-thread: Resolve/create thread, check 10min window
   - Per-attachment: Check count and cumulative size

4. **Processing**

   - Sanitize HTML/text content
   - Validate attachments (magic bytes, file type)
   - Check individual attachment size (20MB max)
   - Upload to R2 with presigned URLs
   - Generate processed email body with inline images

5. **Record Events** (after successful insert)
   - Insert rate limit documents for sender, IP, thread
   - Record attachment event with size metadata
   - All inserts run in parallel via `Promise.all()`

### Rejection Responses

When rate limits are exceeded, returns:

```json
{
  "ok": true,
  "rejected": true,
  "reason": "Rate limit exceeded: N/M in Xs"
}
```

Example reasons:

- `"Rate limit exceeded: 5/5 in 300s"` (sender 5min)
- `"Too many attachments: 3+ in 10 minutes"` (attachment frequency)
- `"Daily size limit exceeded: 52MB / 50MB"` (attachment quota)

### Helper Functions

#### `checkRateLimit(db, type, key, limit, windowMs)`

Counts documents matching type/key within time window.

- Returns `{ allowed: boolean, reason?: string, current?: number, limit?: number }`
- Fails open (returns `allowed: true`) on errors

#### `recordRateLimit(db, type, key, metadata?)`

Inserts new rate limit event document.

- Non-blocking (errors logged but not thrown)
- Accepts optional metadata (e.g., `{ size: 1024 }` for attachments)

#### `checkSizeLimits(db, senderEmail, attachmentSize)`

Checks attachment-specific limits:

1. Count attachments in last 10 minutes (max 3)
2. Sum attachment sizes in last 24 hours (max 50MB including current)

- Returns `{ allowed: boolean, reason?: string }`
- Fails open on errors

## Configuration

Environment variables required:

- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- `MAILGUN_API_KEY` (for fetching stored messages)
- `MAILGUN_WEBHOOK_KEY` (for signature validation)
- `MAILGUN_ENFORCE_SIGNATURE` (optional, default: false in non-production)

MongoDB connection via `connectMongoDB()` utility.

## Monitoring

Rate limit events are logged with context:

```javascript
console.log("mg-receive-email: rate limit exceeded (sender 5min)", {
  senderEmail,
  reason: "Rate limit exceeded: 5/5 in 300s",
});
```

Successful processing logs recorded events:

```javascript
console.log("mg-receive-email: recorded rate limit events", {
  sender: "user@example.com",
  ip: "1.2.3.4",
  thread: "507f1f77bcf86cd799439011",
  attachmentCount: 2,
});
```

## Edge Cases

1. **Sender validation errors**: Continue processing (fail open) to avoid blocking legitimate emails
2. **Rate limit check errors**: Fail open (allow email through) but log warnings
3. **Rate limit recording errors**: Non-fatal, log warning and continue
4. **Missing IP**: Skip IP rate limiting if extraction fails
5. **Duplicate messages**: Skip rate limit recording (detected via `mailgunMessageId` index)
6. **Merged attachments**: Rate limits already checked before merge, no double-counting

## Testing Recommendations

1. **Unit tests**: Mock `checkRateLimit` to return different scenarios
2. **Integration tests**: Insert rate limit documents, verify rejection at thresholds
3. **Load tests**: Send bursts of emails from same sender/IP/thread
4. **Size tests**: Send attachments near/over 20MB and 50MB daily limits
5. **IP extraction**: Test with various proxy headers and Received formats
