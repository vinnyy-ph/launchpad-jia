# Optimize Fetching — `get-career-interviews` & `get-career-applicants`

Bonus ticket: bring both endpoints under **1 second average response time**.

| Endpoint | Before (worst case) | After | Improvement |
|---|---|---|---|
| `GET /api/get-career-applicants` | 12.51s | **0.36s** | **35×** |
| `GET /api/get-career-interviews` | 71.5s | **1.07s** | **67×** |

Measured against deliberately brutal seeded careers (1,000 / 1,500 / 3,000 applicants on a single posting). Full tables in §4.

---

## 1. Why it was slow

Profiling against a 3,000-applicant career (production build, live Atlas cluster, real auth):

1. **Zero secondary indexes.** Every collection in the join graph (`interviews`, `recruiter-evaluations`, `comments`, `interview-history`, `recruiter-history`, `applicants`, `careers`) had only `_id`. Verified via `collection.indexes()`.
2. **Correlated `$lookup` per interview doc.** `get-career-interviews` ran **5 `$lookup` sub-pipelines for each of the 3,000 matched docs** — ~15,000 correlated sub-queries, each a collection scan without indexes.
3. **The `applicants` join was un-indexable outright.** It compared `$toLower` of the **foreign** email field — an expression on the joined collection's field that no index can ever serve, forcing a full `applicants` scan (~4,000 docs) per interview doc.
4. **`get-career-applicants` joined before paginating.** The `recruiter-evaluations` `$lookup` ran for **all** matched docs, then `$skip/$limit` threw away all but 10.
5. Interesting negative result: the top-level `$match {id}` COLLSCAN cost only **4ms** over 8,049 docs (explain `executionStats`) — at this scale the scans that hurt are the *per-doc correlated* ones, not the top-level one.

## 2. What changed

### `src/lib/utils/ensureIndexes.ts` (new)

Idempotent index bootstrap, called by both routes; memoized so only the first request per server process pays the round trips; failure-tolerant (logs and continues — routes still work unindexed). Seven indexes, including a **case-insensitive collation index** (`{locale:"en", strength:2}`) on `applicants.email`. Works on fresh deploys — no manual Atlas setup.

### `src/lib/utils/careerFetchPipelines.ts` (new)

The aggregation logic extracted into **pure, unit-tested builders** so the perf-critical structure is pinned by tests:

- `buildApplicantsPipeline` — `$sort/$skip/$limit` now run **before** the evaluations `$lookup`: only the returned page (10 docs) is joined instead of every applicant on the career. Sort keys are normalized via `$addFields` (`$toLower` name, `$toDate` timestamps) before sorting — identical semantics to the old `$project`, tolerant of mixed string/Date rows.
- `buildEvaluationsBatchPipeline`, `buildCommentCountsPipeline`, `buildLatestByUidPipeline` — single **batched, indexed** queries replacing the per-doc lookups (`$match $in → $sort → $group $first`); comment counts are computed server-side by `$group` (raw comment bodies never leave the database).
- `joinInterviewBatches`, `decorateApplicantAccounts`, `collectApplicantEmailKeys` — JS merges that reproduce the original `$addFields` semantics exactly (verified by unit tests, including edge quirks: missing-status accounts, `""`/null email matching, missing-join fields staying absent rather than `null`).

### The routes

- `get-career-applicants`: same response, same filters/sorts — pipeline from the tested builder + `ensureCareerFetchIndexes`. The route file shrank by ~116 lines.
- `get-career-interviews`: one indexed `find` for the interviews + **five batch queries run in parallel** (`Promise.all`): evaluations, comment counts, latest interview-history, latest recruiter-history, applicant accounts (collation-indexed, replacing the un-indexable `$toLower` join). Merged in JS.

### One deliberate response change (interviews endpoint only)

The old pipeline returned both the raw `$lookup` arrays (`evaluations`, `history`, `recruiterHistory`) **and** their extracted singletons (`currentEvaluation`, `latestApplicationMovement`, `latestRecruiterAction`) — exact duplicates, ~30% of the payload. Static analysis of every consumer (`PipelineStageBuilder`, `useLinkedCareerTimeline`, the career manage page, the guest-portal ViewCareer hooks, and everything they pass interview objects to) confirmed **only the singletons are read**. The raw arrays are no longer returned: payload 5.05MB → 3.66MB on the 3,000-applicant career. Everything else is verified identical (§3).

## 3. How correctness was verified

- **Response-shape oracle.** Before any code change, full responses for both endpoints × 3 stress careers (+ sorted/filtered page-2 variants) were captured from the unmodified code. After each change, fresh captures were deep-compared (order-insensitive key sort; interviews compared as `_id`-keyed sets since the endpoint has no `$sort`): applicants **byte-equivalent** including pagination order; interviews equivalent minus the 3 deliberately-removed duplicate arrays.
- **Unit tests.** 26 tests pin the builders and JS joins (suite total 218). `tsc` clean, clean production build.
- **Live UI smoke.** Career manage page (Application Timeline + All Applicants) rendered against the 3,000-applicant career on a production build with no new console errors.
- **Indexes verified in Atlas** after first request (created by the bootstrap itself).

## 4. Benchmarks

Conditions: local **production** build (`pnpm build` && `pnpm start`), live Atlas cluster, real Firebase Bearer token, mean of 10 sequential requests after 1 warmup (`scripts/benchmark-fetching.mjs`). Seeded stress data: `interviews` collection = 8,049 docs; linked: 4,829 evaluations, 3,682 comments, 10,872 interview-history, 3,214 recruiter-history, 3,985 applicants.

### `get-career-applicants` (page=1, limit=10)

| Career size | Before (mean) | After (mean) | p95 after |
|---|---|---|---|
| 1,000 | 4.73s | **0.38s** | 0.51s |
| 1,500 | 6.51s | **0.36s** | 0.38s |
| 3,000 | 12.51s | **0.36s** | 0.37s |

Response time is now **independent of career size** — the page is joined after pagination.

### `get-career-interviews` (returns ALL interviews for the career)

| Career size | Before (mean) | After (mean) | p95 after | Payload |
|---|---|---|---|---|
| 1,000 | ~25.7s | **0.65s** | 0.70s | 1.20MB |
| 1,500 | ~37.2s | **0.75s** | 0.82s | 1.80MB |
| 3,000 | ~71.5s | **1.07s** | 1.10s | 3.66MB |

**Target met for careers up to ~1,500 applicants** (already far beyond a realistic single posting). The deliberately extreme 3,000-applicant case lands at 1.07s — a 67× improvement; its remaining cost is transferring 3,000 full candidate documents from the remote Atlas cluster, so it is bounded by network locality (the local-dev → Atlas link used here is the conservative case; a same-region deployment is faster). This endpoint's contract returns *all* interviews (the timeline UI consumes the full set), so the floor scales with career size by design.

### Reproduce

```bash
# 1. Seed the stress data (idempotent; tags everything seedTag:"perf-demo")
node <path-to>/seed-perf-data.js   # prints the stress careerIDs

# 2. Production build + start
pnpm build && pnpm start

# 3. Benchmark (token = any signed-in user's Firebase ID token)
BENCH_TOKEN=<idToken> node scripts/benchmark-fetching.mjs --career <careerID> --runs 10
```

## 5. Files

| File | Role |
|---|---|
| `src/lib/utils/ensureIndexes.ts` | Index bootstrap (7 indexes, memoized, failure-tolerant) |
| `src/lib/utils/careerFetchPipelines.ts` | Pure pipeline builders + JS join logic |
| `src/lib/utils/__tests__/ensureIndexes.test.ts` | Index spec + memoization tests |
| `src/lib/utils/__tests__/careerFetchPipelines.test.ts` | Builder structure + join-semantics tests |
| `src/app/api/get-career-applicants/route.tsx` | Paginate-before-lookup + indexes |
| `src/app/api/get-career-interviews/route.tsx` | Parallel batched joins + indexes |
| `scripts/benchmark-fetching.mjs` | Reproducible benchmark |
