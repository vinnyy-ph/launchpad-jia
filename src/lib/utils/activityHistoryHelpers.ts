import { Collection, Db, Filter, ObjectId } from "mongodb";

export const ACTIVITY_HISTORY_COLLECTION = "activity-history";

export interface ActivityHistoryActor {
  type?: "recruiter" | "candidate" | "system" | "automation" | "external" | string;
  id?: string;
  email?: string;
  name?: string;
  image?: string;
}

export interface ActivityHistoryEvent {
  _id?: ObjectId;
  orgID: string;
  careerId?: string;
  candidateId?: string;
  interviewUID?: string;
  action: string;
  source?: string;
  actor?: ActivityHistoryActor;
  metadata?: Record<string, any>;
  occurredAt?: Date | string | number;
  createdAt?: Date;
}

export type ActivityHistoryEventDTO = Omit<ActivityHistoryEvent, "_id"> & { _id: string };

export interface FetchActivityHistoryParams {
  orgID: string;
  careerId?: string;
  candidateId?: string;
  candidateEmail?: string;
  page?: number;
  limit?: number;
}

function normalizeOptionalString(value?: string | null): string | undefined {
  if (value == null) {
    return undefined;
  }

  const trimmed = String(value).trim();
  return trimmed || undefined;
}

function normalizeOccurredAt(value?: Date | string | number): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number") {
    const asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime())) {
      return asDate;
    }
  }

  if (typeof value === "string") {
    const asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime())) {
      return asDate;
    }
  }

  return new Date();
}

function getCollection(db: Db): Collection<ActivityHistoryEvent> {
  return db.collection<ActivityHistoryEvent>(ACTIVITY_HISTORY_COLLECTION);
}

export function buildActivityHistoryQuery({
  orgID,
  careerId,
  candidateId,
  candidateEmail,
}: {
  orgID: string;
  careerId?: string;
  candidateId?: string;
  candidateEmail?: string;
}): Filter<ActivityHistoryEvent> {
  const normalizedOrgID = normalizeOptionalString(orgID);
  if (!normalizedOrgID) {
    throw new Error("Organization ID is required");
  }

  const normalizedCareerId = normalizeOptionalString(careerId);
  const normalizedCandidateId = normalizeOptionalString(candidateId);
  const normalizedCandidateEmail = normalizeOptionalString(candidateEmail)?.toLowerCase();

  const query: Filter<ActivityHistoryEvent> = {
    orgID: normalizedOrgID,
  };

  if (normalizedCareerId) {
    query.careerId = normalizedCareerId;
  }

  if (normalizedCandidateId) {
    query.candidateId = normalizedCandidateId;
  }

  if (normalizedCandidateEmail && normalizedCandidateId) {
    delete query.candidateId;
    (query as any).$or = [
      { candidateId: normalizedCandidateId },
      { "metadata.applicant.email": normalizedCandidateEmail },
    ];
  } else if (normalizedCandidateEmail) {
    (query as any)["metadata.applicant.email"] = normalizedCandidateEmail;
  }

  return query;
}

export async function fetchActivityHistory(
  db: Db,
  params: FetchActivityHistoryParams
): Promise<{ items: ActivityHistoryEventDTO[]; total: number }> {
  const page = Math.max(1, Number(params.page || 1));
  const limit = Math.min(100, Math.max(1, Number(params.limit || 20)));
  const skip = (page - 1) * limit;

  const query = buildActivityHistoryQuery({
    orgID: params.orgID,
    careerId: params.careerId,
    candidateId: params.candidateId,
    candidateEmail: params.candidateEmail,
  });

  const collection = getCollection(db);

  const [rows, total] = await Promise.all([
    collection
      .find(query)
      .sort({ occurredAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(query),
  ]);

  const items = rows.map((row) => {
    const { _id, ...rest } = row as ActivityHistoryEvent & { _id: ObjectId };
    return {
      ...rest,
      _id: _id.toString(),
    };
  });

  return { items, total };
}

export async function recordActivityHistory(
  db: Db,
  event: ActivityHistoryEvent
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const normalizedOrgID = normalizeOptionalString(event.orgID);
    if (!normalizedOrgID) {
      return { success: false, error: "Organization ID is required" };
    }

    const action = normalizeOptionalString(event.action);
    if (!action) {
      return { success: false, error: "Action is required" };
    }

    const payload: ActivityHistoryEvent = {
      ...event,
      orgID: normalizedOrgID,
      careerId: normalizeOptionalString(event.careerId),
      candidateId: normalizeOptionalString(event.candidateId),
      interviewUID: normalizeOptionalString(event.interviewUID),
      action,
      occurredAt: normalizeOccurredAt(event.occurredAt),
      createdAt: new Date(),
    };

    const result = await getCollection(db).insertOne(payload);
    return { success: true, id: result.insertedId.toString() };
  } catch (error) {
    console.error("Error recording activity-history event:", error);
    return { success: false, error: "Failed to record activity history" };
  }
}

export async function createActivityHistoryIndexes(db: Db): Promise<void> {
  const collection = getCollection(db);

  await collection.createIndex(
    { orgID: 1, occurredAt: -1 },
    { name: "activity_org_occurred_idx" }
  );

  await collection.createIndex(
    { orgID: 1, careerId: 1, occurredAt: -1 },
    { name: "activity_org_career_occurred_idx" }
  );

  await collection.createIndex(
    { orgID: 1, candidateId: 1, occurredAt: -1 },
    { name: "activity_org_candidate_occurred_idx" }
  );

  await collection.createIndex(
    { orgID: 1, careerId: 1, candidateId: 1, occurredAt: -1 },
    { name: "activity_org_career_candidate_occurred_idx" }
  );
}

// Format activity message based on action type and metadata
export function formatActivityMessage(
  action: string,
  actorName: string,
  candidateName: string,
  metadata?: Record<string, any>
): string {
  const actor = actorName || "System";
  const candidate = candidateName || "Candidate";
  const toStage = metadata?.toStageName || metadata?.toStage || "Next Stage";
  const matchFit = typeof metadata?.matchFit === "string" ? metadata.matchFit.trim() : "";

  const actionLower = action.toLowerCase();

  if (actionLower.includes("endorse")) {
    return [
      `${actor} endorsed ${candidate}`,
      matchFit ? `as ${matchFit}` : "",
      `to the ${toStage} stage`,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (actionLower.includes("drop")) {
    return `${actor} dropped ${candidate} from ${toStage} stage`;
  }

  if (actionLower.includes("reconsider")) {
    return [
      `${actor} reconsidered ${candidate}`,
      matchFit ? `as ${matchFit}` : "",
      `to the ${toStage} stage`,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (actionLower.includes("reset")) {
    return `${actor} reset ${candidate}'s evaluation in ${toStage} stage`;
  }

  if (actionLower.includes("applied")) {
    const careerName = metadata?.jobTitle || metadata?.careerTitle || "role";
    return `${candidate} applied to the ${careerName} role`;
  }

  if (actionLower.includes("auto-endorse") || actionLower.includes("auto endorse")) {
    return [
      `Jia auto-endorsed ${candidate}`,
      matchFit ? `as ${matchFit}` : "",
      `to the ${toStage} stage`,
    ]
      .filter(Boolean)
      .join(" ");
  }

  // Default format
  return `${actor} ${action} ${candidate}`;
}

