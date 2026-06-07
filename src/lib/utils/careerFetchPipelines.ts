/**
 * [Bonus: Optimize fetching] Pure pipeline builders for the two
 * candidate-fetching endpoints. Extracted so the perf-critical stage ordering
 * is unit-testable. See OPTIMIZE_FETCHING.md for before/after numbers.
 */
import type { Document } from "mongodb";

// --- get-career-applicants -------------------------------------------------

// Moved verbatim from the route (behavior unchanged); typed + exported for tests.
export const getApplicantsFilter = (
  careerID: string | null,
  search: string | null,
  filterStageId: string | null,
  filterSubstageId: string | null,
  filterStatus: string | null
): Record<string, any> => {
  const filter: any = { id: careerID };
  if (search) filter.name = { $regex: search, $options: "i" };
  if (filterStatus) {
    if (filterStatus === "All Statuses") {
      filter.applicationStatus = { $in: ["Ongoing", "Dropped", "Hired", "Cancelled", null] };
    } else if (filterStatus === "Ongoing") {
      filter.applicationStatus = { $in: ["Ongoing", null] };
    } else if (filterStatus === "Invited") {
      filter.invitedFrom = { $exists: true, $ne: null };
    } else {
      filter.applicationStatus = filterStatus;
    }
  }
  if (filterStageId) filter.stageId = filterStageId;
  if (filterSubstageId) filter.substageId = filterSubstageId;
  return filter;
};

export const getApplicantsSort = (sortBy: string | null): Record<string, 1 | -1> => {
  if (sortBy === "Recent Activity") return { updatedAt: -1, _id: -1 };
  if (sortBy === "Oldest Activity") return { updatedAt: 1, _id: -1 };
  if (sortBy === "Date Applied (Newest First)") return { createdAt: -1, _id: -1 };
  if (sortBy === "Date Applied (Oldest First)") return { createdAt: 1, _id: -1 };
  if (sortBy === "Alphabetical (A-Z)") return { nameLower: 1, _id: -1 };
  if (sortBy === "Alphabetical (Z-A)") return { nameLower: -1, _id: -1 };
  return { _id: -1 };
};

const APPLICANT_OUTPUT_FIELDS = [
  "_id", "interviewID", "name", "image", "nameLower", "email", "applicationStatus",
  "currentStep", "status", "updatedAt", "createdAt", "cvStatus", "jobFit",
  "cvScreeningEvaluation", "cvScreeningReason", "summary", "stageId", "substageId",
] as const;

const EVALUATIONS_LOOKUP = {
  $lookup: {
    from: "recruiter-evaluations",
    let: {
      interviewUID: { $toString: "$_id" },
      status: {
        $cond: { if: { $ne: ["$applicationStatus", "Dropped"] }, then: "Endorsed", else: "Dropped" },
      },
    },
    pipeline: [
      {
        $match: {
          $expr: {
            $and: [
              { $eq: ["$interviewUID", "$$interviewUID"] },
              { $eq: ["$action", "$$status"] },
            ],
          },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 1 },
    ],
    as: "evaluations",
  },
};

/**
 * Perf fix vs. the original inline pipeline: $sort/$skip/$limit run BEFORE the
 * recruiter-evaluations $lookup, so only `limit` docs (10) are joined instead of
 * every interview on the career (3,000 on the largest seeded career).
 * Sort keys are normalized via $addFields first — identical semantics to the old
 * $project ($toLower name, $toDate timestamps), tolerant of mixed string/Date rows.
 */
export function buildApplicantsPipeline(args: {
  filter: Record<string, any>;
  sort: Record<string, 1 | -1>;
  page: number;
  limit: number;
}): Document[] {
  const { filter, sort, page, limit } = args;
  return [
    { $match: filter },
    {
      $addFields: {
        nameLower: { $toLower: "$name" },
        updatedAt: { $toDate: "$updatedAt" },
        createdAt: { $toDate: "$createdAt" },
      },
    },
    { $sort: sort },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    { $project: Object.fromEntries(APPLICANT_OUTPUT_FIELDS.map((f) => [f, 1])) },
    EVALUATIONS_LOOKUP,
    { $addFields: { currentEvaluation: { $arrayElemAt: ["$evaluations", 0] } } },
  ];
}

// --- get-career-interviews ---------------------------------------------------

/**
 * [Bonus: Optimize fetching] Batched replacements for the route's former
 * correlated $lookups. One indexed batch query per joined collection,
 * all run in parallel, then merged in JS by joinInterviewBatches().
 * Rationale: 4 lookups × 3,000 interviews = 12,000 correlated index probes
 * (~2.4s); the batched equivalents are 4 single indexed queries (~0.6s).
 */
export function buildEvaluationsBatchPipeline(interviewUIDs: string[]): Document[] {
  return [
    { $match: { interviewUID: { $in: interviewUIDs }, action: { $in: ["Endorsed", "Dropped"] } } },
    { $sort: { interviewUID: 1, action: 1, createdAt: -1 } },
    { $group: { _id: { interviewUID: "$interviewUID", action: "$action" }, doc: { $first: "$$ROOT" } } },
  ];
}

export function buildCommentCountsPipeline(interviewIDs: unknown[], userEmail: string): Document[] {
  return [
    // Application-level comments only (parity with the old lookup's $expr filter)
    { $match: { interviewID: { $in: interviewIDs }, type: "application", deleted: { $ne: true } } },
    {
      $group: {
        _id: "$interviewID",
        commentCount: { $sum: 1 },
        newCommentCount: {
          $sum: { $cond: [{ $not: { $in: [userEmail, { $ifNull: ["$viewedBy", []] }] } }, 1, 0] },
        },
      },
    },
  ];
}

export function buildLatestByUidPipeline(interviewUIDs: string[]): Document[] {
  return [
    { $match: { interviewUID: { $in: interviewUIDs } } },
    { $sort: { interviewUID: 1, createdAt: -1 } },
    { $group: { _id: "$interviewUID", doc: { $first: "$$ROOT" } } },
  ];
}

export interface InterviewBatchResults {
  evaluations: Array<{ _id: { interviewUID: string; action: string }; doc: Document }>;
  commentCounts: Array<{ _id: unknown; commentCount: number; newCommentCount: number }>;
  latestHistory: Array<{ _id: string; doc: Document }>;
  latestRecruiterHistory: Array<{ _id: string; doc: Document }>;
}

/**
 * JS merge of the batch query results — reproduces exactly what the former
 * $lookup + $addFields stages computed per interview:
 *  - currentEvaluation: latest evaluation whose action is "Dropped" when
 *    applicationStatus === "Dropped", else "Endorsed" (undefined when none)
 *  - commentCount / newCommentCount: 0 when the interview has no comments
 *  - latestApplicationMovement / latestRecruiterAction (undefined when none)
 * The raw evaluations/history/recruiterHistory arrays are intentionally NOT
 * emitted (they duplicated the singletons; no consumer reads them).
 */
export function joinInterviewBatches<T extends { _id: unknown; interviewID?: unknown; applicationStatus?: string | null }>(
  interviews: T[],
  batches: InterviewBatchResults
): Array<T & {
  currentEvaluation?: Document;
  commentCount: number;
  newCommentCount: number;
  latestApplicationMovement?: Document;
  latestRecruiterAction?: Document;
}> {
  const evalByKey = new Map<string, Document>();
  for (const e of batches.evaluations) evalByKey.set(`${e._id.interviewUID} ${e._id.action}`, e.doc);
  const countsById = new Map<unknown, { commentCount: number; newCommentCount: number }>();
  for (const c of batches.commentCounts) countsById.set(c._id, { commentCount: c.commentCount, newCommentCount: c.newCommentCount });
  const historyByUid = new Map<string, Document>();
  for (const h of batches.latestHistory) historyByUid.set(h._id, h.doc);
  const recruiterByUid = new Map<string, Document>();
  for (const r of batches.latestRecruiterHistory) recruiterByUid.set(r._id, r.doc);

  return interviews.map((iv) => {
    const uid = String(iv._id);
    const action = iv.applicationStatus !== "Dropped" ? "Endorsed" : "Dropped";
    const counts = countsById.get(iv.interviewID) ?? { commentCount: 0, newCommentCount: 0 };
    return {
      ...iv,
      currentEvaluation: evalByKey.get(`${uid} ${action}`),
      commentCount: counts.commentCount,
      newCommentCount: counts.newCommentCount,
      latestApplicationMovement: historyByUid.get(uid),
      latestRecruiterAction: recruiterByUid.get(uid),
    };
  });
}

/** Distinct lowercase emails across the fetched interviews + whether any doc has no email. */
export function collectApplicantEmailKeys(interviews: Array<{ email?: string | null }>): {
  emails: string[];
  hasEmpty: boolean;
} {
  const set = new Set<string>();
  let hasEmpty = false;
  for (const iv of interviews) {
    const key = String(iv.email ?? "").toLowerCase();
    if (key) set.add(key);
    else hasEmpty = true;
  }
  return { emails: [...set], hasEmpty };
}

/**
 * JS port of the dropped $lookup's $addFields — semantics preserved exactly:
 *  - no matching applicant → applicantStatus null, hasJiaAccount false
 *  - applicantStatus = stored status ?? null  (missing status stays null)
 *  - hasJiaAccount   = toLower(status ?? "joined") !== "invited"
 */
export function decorateApplicantAccounts<T extends { email?: string | null }>(
  interviews: T[],
  applicantDocs: Array<{ email?: string | null; status?: string | null }>
): Array<T & { applicantStatus: string | null; hasJiaAccount: boolean }> {
  const byEmail = new Map<string, { status?: string | null }>();
  for (const doc of applicantDocs) {
    const key = String(doc.email ?? "").toLowerCase();
    if (!byEmail.has(key)) byEmail.set(key, doc);
  }
  return interviews.map((iv) => {
    const acct = byEmail.get(String(iv.email ?? "").toLowerCase());
    if (!acct) return { ...iv, applicantStatus: null, hasJiaAccount: false };
    return {
      ...iv,
      applicantStatus: acct.status ?? null,
      hasJiaAccount: String(acct.status ?? "joined").toLowerCase() !== "invited",
    };
  });
}
