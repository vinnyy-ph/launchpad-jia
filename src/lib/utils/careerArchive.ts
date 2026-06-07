/**
 * Career archive helpers (T4 / JIA-352).
 * Pure query fragments + planners — no DB access here, so they unit-test cleanly.
 */

import type { ObjectId } from "mongodb"; // type-only: keeps this module runtime-pure

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

/** Mongo _id as the driver hands it back (ObjectId at runtime, string in tests). */
type DocId = ObjectId | string;

interface InterviewLike<TId = DocId> { _id?: TId; applicationStatus?: string | null }

/**
 * Ids of candidate "interview" docs to drop on "archive and drop all":
 * everyone NOT in the Hired stage and not already Dropped. Ongoing / null /
 * any other in-progress status becomes Dropped.
 * Generic over the id type so driver docs yield ObjectId[] and tests string[].
 */
export function selectInterviewIdsToDrop<TId = DocId>(interviews: InterviewLike<TId>[]): TId[] {
  return (interviews || [])
    .filter((iv) => !(NON_DROPPABLE_STATUSES as readonly string[]).includes(iv?.applicationStatus ?? ""))
    .map((iv) => iv._id as TId);
}

interface CareerLike { _id?: DocId; id?: string }

/** Ids (parent first, then children) that an archive should mark. */
export function planArchiveTargets(parent: CareerLike, children: CareerLike[]): Array<DocId | undefined> {
  return [parent._id, ...(children || []).map((c) => c._id)];
}

interface TeamMemberLike { email?: string | null; role?: string | null }

/**
 * Job-Owner gate shared by archive / restore / undo routes: the acting user
 * must be listed on the career's teamMembers with the "Job Owner" role.
 * Mirrors the check the legacy delete-career route used.
 * Accepts raw driver docs (Record arm) — the cast is compile-only.
 */
export function isCareerJobOwner(
  career: { teamMembers?: TeamMemberLike[] | null } | Record<string, unknown>,
  userEmail: string | null | undefined
): boolean {
  return (
    (career.teamMembers as TeamMemberLike[] | null | undefined)?.some(
      (m) => m.email === userEmail && m.role === "Job Owner"
    ) ?? false
  );
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
