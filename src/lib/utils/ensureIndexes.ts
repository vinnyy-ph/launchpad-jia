import type { Db, CreateIndexesOptions } from "mongodb";

/**
 * [Bonus: Optimize fetching] Index bootstrap for the two candidate-fetching
 * endpoints (get-career-interviews, get-career-applicants).
 *
 * Why: both endpoints aggregate `interviews` with correlated $lookups; without
 * these indexes every lookup is a foreign-collection scan per interview doc
 * (measured 25–72s on 1k–3k-interview careers; see OPTIMIZE_FETCHING.md).
 *
 * createIndex is idempotent server-side; this memoizes so only the first
 * request per server process pays the round trips. On failure we log and
 * continue — the routes still work unindexed, just slower.
 */
export const CAREER_FETCH_INDEXES: Array<{
  collection: string;
  key: Record<string, 1 | -1>;
  options?: CreateIndexesOptions;
}> = [
  // Both routes' top-level match: interviews by career id (non-unique by design).
  { collection: "interviews", key: { id: 1 } },
  // get-career-applicants: findOne({ id: careerID }) for pipelineStages.
  { collection: "careers", key: { id: 1 } },
  // Serves both the applicants $lookup ($eq uid+action, sort createdAt desc)
  // and the interviews batch pipeline (match uid+action, sort, $group $first).
  { collection: "recruiter-evaluations", key: { interviewUID: 1, action: 1, createdAt: -1 } },
  // Comment-count batch: match interviewID $in + type; `deleted` is a residual filter.
  { collection: "comments", key: { interviewID: 1, type: 1 } },
  // Latest-by-uid batches: match uid $in, sort { interviewUID, createdAt desc }.
  { collection: "interview-history", key: { interviewUID: 1, createdAt: -1 } },
  { collection: "recruiter-history", key: { interviewUID: 1, createdAt: -1 } },
  // Case-insensitive account join — the query must pass the SAME collation
  // ({ locale:"en", strength:2 }) or this index is unusable for it.
  { collection: "applicants", key: { email: 1 }, options: { collation: { locale: "en", strength: 2 } } },
];

let ensured: Promise<void> | null = null;

export function ensureCareerFetchIndexes(db: Db): Promise<void> {
  if (!ensured) {
    ensured = Promise.all(
      CAREER_FETCH_INDEXES.map(({ collection, key, options }) =>
        db.collection(collection).createIndex(key, options)
      )
    )
      .then(() => undefined)
      .catch((err) => {
        console.error("ensureCareerFetchIndexes failed (continuing unindexed):", err);
      });
  }
  return ensured;
}

export function __resetEnsureIndexesForTests(): void {
  ensured = null;
}
