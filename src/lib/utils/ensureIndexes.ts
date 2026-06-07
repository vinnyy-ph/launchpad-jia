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
  { collection: "interviews", key: { id: 1 } },
  { collection: "careers", key: { id: 1 } },
  { collection: "recruiter-evaluations", key: { interviewUID: 1, action: 1, createdAt: -1 } },
  { collection: "comments", key: { interviewID: 1, type: 1 } },
  { collection: "interview-history", key: { interviewUID: 1, createdAt: -1 } },
  { collection: "recruiter-history", key: { interviewUID: 1, createdAt: -1 } },
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
