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

interface SubstageLike { id?: string; name?: string }
interface StageLike { id?: string; type?: string; substages?: SubstageLike[] }

/** Resolve the "Hired" substage id from a career's own pipeline; fallback "4". */
export function resolveHiredSubstageId(pipelineStages?: StageLike[]): string {
  if (Array.isArray(pipelineStages)) {
    for (const stage of pipelineStages) {
      const hired = stage?.substages?.find((s) => s?.name === "Hired");
      if (hired?.id) return hired.id;
    }
  }
  return "4";
}

interface InterviewLike { _id?: any; substageId?: string; applicationStatus?: string }

/** Ids of interviews to drop on "archive and drop all": non-Hired, not already dropped. */
export function selectInterviewIdsToDrop(
  interviews: InterviewLike[],
  hiredSubstageId: string
): any[] {
  return (interviews || [])
    .filter((iv) => iv?.applicationStatus !== "Dropped" && iv?.substageId !== hiredSubstageId)
    .map((iv) => iv._id);
}

interface CareerLike { _id?: any; id?: string }

/** Ids (parent first, then children) that an archive should mark. */
export function planArchiveTargets(parent: CareerLike, children: CareerLike[]): any[] {
  return [parent._id, ...(children || []).map((c) => c._id)];
}
