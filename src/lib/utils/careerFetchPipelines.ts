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

const latestByUidLookup = (from: string, as: string) => ({
  $lookup: {
    from,
    let: { interviewUID: { $toString: "$_id" } },
    pipeline: [
      { $match: { $expr: { $eq: ["$interviewUID", "$$interviewUID"] } } },
      { $sort: { createdAt: -1 } },
      { $limit: 1 },
    ],
    as,
  },
});

/**
 * Perf fix vs. the original inline pipeline: the `applicants` $lookup is gone.
 * It compared $toLower(foreign email) to $toLower(local email) — an expression
 * on the foreign field that no index can serve, forcing a full applicants scan
 * per interview doc. The account fields it produced (applicantStatus,
 * hasJiaAccount) are now joined in route code via ONE collation-indexed query
 * (collectApplicantEmailKeys + decorateApplicantAccounts below).
 * The four remaining lookups are equality-on-indexed-field (see ensureIndexes).
 */
export function buildInterviewsPipeline(args: { careerID: string | null; userEmail: string }): Document[] {
  const { careerID, userEmail } = args;
  return [
    { $match: { id: careerID } },
    EVALUATIONS_LOOKUP,
    {
      $lookup: {
        from: "comments",
        let: { interviewID: "$interviewID" },
        pipeline: [
          {
            $match: {
              $expr: {
                // Application-level comments only
                $and: [
                  { $eq: ["$interviewID", "$$interviewID"] },
                  { $eq: ["$type", "application"] },
                  { $ne: ["$deleted", true] },
                ],
              },
            },
          },
        ],
        as: "comments",
      },
    },
    latestByUidLookup("interview-history", "history"),
    latestByUidLookup("recruiter-history", "recruiterHistory"),
    {
      $addFields: {
        currentEvaluation: { $arrayElemAt: ["$evaluations", 0] },
        commentCount: { $size: "$comments" },
        newCommentCount: {
          $size: {
            $filter: {
              input: "$comments",
              as: "comment",
              cond: { $not: { $in: [userEmail, { $ifNull: ["$$comment.viewedBy", []] }] } },
            },
          },
        },
        latestApplicationMovement: { $arrayElemAt: ["$history", 0] },
        latestRecruiterAction: { $arrayElemAt: ["$recruiterHistory", 0] },
      },
    },
    { $project: { comments: 0 } },
  ];
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
