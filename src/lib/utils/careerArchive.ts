/**
 * Career archive helpers (T4 / JIA-352).
 * Pure query fragments + planners — no DB access here, so they unit-test cleanly.
 */

/** Default gate: every careers read excludes archived unless explicitly overridden. */
export const EXCLUDE_ARCHIVED = { archived: { $ne: true } } as const;

/** Same gate as a pipeline stage, for aggregation reads. */
export const ARCHIVE_MATCH_STAGE = { $match: { archived: { $ne: true } } } as const;

/** Merge the exclude gate into an existing find() filter. */
export function withExcludeArchived<T extends object>(filter: T) {
  return { ...filter, ...EXCLUDE_ARCHIVED };
}

/**
 * Careers-LIST endpoints only. "Archived" is an exclusive view toggle:
 *   selected   -> show ONLY archived (matches Figma archived view)
 *   unselected -> hide archived (default)
 */
export function archivedConstraint(selectedStatuses: string[] = []) {
  return selectedStatuses.includes("archived")
    ? { archived: true }
    : { archived: { $ne: true } };
}

/**
 * Candidate application statuses that must NOT be dropped on archive:
 * already-hired (kept) and already-terminal-dropped (no re-drop).
 * The app's notion of "Hired stage" is the `applicationStatus` field
 * (see get-careers / get-career-applicants), not a pipeline substage.
 */
export const NON_DROPPABLE_STATUSES = ["Hired", "Dropped"] as const;

interface InterviewLike { _id?: any; applicationStatus?: string | null }

/**
 * Ids of candidate "interview" docs to drop on "archive and drop all":
 * everyone NOT in the Hired stage and not already Dropped. Ongoing / null /
 * any other in-progress status becomes Dropped.
 */
export function selectInterviewIdsToDrop(interviews: InterviewLike[]): any[] {
  return (interviews || [])
    .filter((iv) => !NON_DROPPABLE_STATUSES.includes(iv?.applicationStatus as any))
    .map((iv) => iv._id);
}

interface CareerLike { _id?: any; id?: string }

/** Ids (parent first, then children) that an archive should mark. */
export function planArchiveTargets(parent: CareerLike, children: CareerLike[]): any[] {
  return [parent._id, ...(children || []).map((c) => c._id)];
}

interface ArchiveOpts { batchId: string; by?: string | null; at?: Date }

/** The $set patch to archive ONE career, capturing its prior publish state for undo. */
export function archiveCareerPatch(career: { status?: string | null; activityStatus?: string | null }, opts: ArchiveOpts) {
  const at = opts.at ?? new Date();
  return {
    archived: true,
    archivedAt: at,
    archivedBy: opts.by ?? null,
    archiveBatchId: opts.batchId,
    status: "inactive",
    activityStatus: "Inactive",
    statusBeforeArchive: career.status ?? null,
    activityStatusBeforeArchive: career.activityStatus ?? null,
    updatedAt: at,
  };
}

/** The { $set, $unset } update to UNDO an archive on ONE career (restore prior state). */
export function undoCareerUpdate(career: { status?: string | null; activityStatus?: string | null; statusBeforeArchive?: string | null; activityStatusBeforeArchive?: string | null }) {
  return {
    $set: {
      archived: false,
      status: career.statusBeforeArchive ?? career.status ?? "inactive",
      activityStatus: career.activityStatusBeforeArchive ?? career.activityStatus ?? "Inactive",
      updatedAt: new Date(),
    },
    $unset: { archivedAt: "", archivedBy: "", archiveBatchId: "", statusBeforeArchive: "", activityStatusBeforeArchive: "" },
  };
}
