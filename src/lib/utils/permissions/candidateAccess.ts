import { Db, ObjectId } from "mongodb";

// Set to false to return routes to baseline behavior quickly.
// Defaults to true when env var is not set.
export const ENHANCED_RESTRICTED_CANDIDATE_ACCESS_ENABLED =
  String(process.env.ENHANCED_RESTRICTED_CANDIDATE_ACCESS_ENABLED).toLowerCase() !== "false";

export function shouldIncludeInactiveNoHistoryAccess(
  filterStatus: string,
  hasPreScreeningFilters: boolean
): boolean {
  return (
    ENHANCED_RESTRICTED_CANDIDATE_ACCESS_ENABLED &&
    filterStatus === "All Application Statuses" &&
    !hasPreScreeningFilters
  );
}

function getEmailLookupValues(userEmail: string): string[] {
  const trimmedEmail = String(userEmail || "").trim();
  if (!trimmedEmail) {
    return [];
  }

  const normalizedEmail = trimmedEmail.toLowerCase();
  return [...new Set([normalizedEmail, trimmedEmail])];
}

function splitProjectCareerReferences(rawCareerRefs: any[]): {
  objectIds: ObjectId[];
  guidIds: string[];
} {
  const objectIdByHex = new Map<string, ObjectId>();
  const guidIdSet = new Set<string>();

  const addRef = (value: any) => {
    if (value == null) {
      return;
    }

    if (value instanceof ObjectId) {
      objectIdByHex.set(value.toHexString(), value);
      return;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }

      if (ObjectId.isValid(trimmed)) {
        const objectId = new ObjectId(trimmed);
        objectIdByHex.set(objectId.toHexString(), objectId);
      } else {
        guidIdSet.add(trimmed);
      }
      return;
    }

    if (typeof value === "object") {
      const nestedId = value._id ?? value.id;
      if (nestedId != null) {
        addRef(nestedId);
      }
    }
  };

  rawCareerRefs.forEach(addRef);

  return {
    objectIds: [...objectIdByHex.values()],
    guidIds: [...guidIdSet],
  };
}

/**
 * Returns a list of ADDITIONAL Career IDs (as strings) that a restricted user (Hiring Manager) 
 * is allowed to access beyond their direct team membership.
 * 
 * Access is granted if:
 * 1. User is the creator of the career.
 * 2. User is a member or owner of a project that contains the career.
 * 
 * @param db - The MongoDB database instance
 * @param orgID - The organization ID
 * @param userEmail - The email of the restricted user
 * @param debug - Enable debug timing logs
 * @returns Promise<string[]> - Array of unique career IDs
 */
export async function getExpandedCandidateAccessIDs(
  db: Db,
  orgID: string,
  userEmail: string,
  debug = false
): Promise<string[]> {
  const startedAt = Date.now();

  try {
    const emailLookupValues = getEmailLookupValues(userEmail);

    if (emailLookupValues.length === 0) {
      return [];
    }

    // 1. Get careers where user is the creator
    // 2. Get careers from projects where user is a member OR owner
    const [createdCareers, projectAccess] = await Promise.all([
      db
        .collection("careers")
        .find(
          {
            orgID,
            "createdBy.email": { $in: emailLookupValues },
          },
          { projection: { _id: 1, id: 1 }, limit: 2000 }
        )
        .toArray(),
      db
        .collection("projects")
        .find(
          {
            orgID,
            $or: [
              { "members.email": { $in: emailLookupValues } },
              { "owner.email": { $in: emailLookupValues } },
            ],
          },
          { projection: { careers: 1 } }
        )
        .toArray(),
    ]);

    // Extract career ObjectIds from projects
    const rawProjectCareerIds = projectAccess.flatMap((p: any) =>
      Array.isArray(p?.careers) ? p.careers : []
    );

    const { objectIds: projectCareerObjectIds, guidIds: projectCareerGuidIds } =
      splitProjectCareerReferences(rawProjectCareerIds);

    // Resolve these ObjectId to actual Career documents to get their GUIDs (.id)
    // We search for both _id (ObjectId) and id (GUID string) for legacy compatibility.
    let resolvedProjectCareers: any[] = [];
    const projectCareerFilters: any[] = [];

    if (projectCareerObjectIds.length > 0) {
      projectCareerFilters.push({ _id: { $in: projectCareerObjectIds } });
    }

    if (projectCareerGuidIds.length > 0) {
      projectCareerFilters.push({ id: { $in: projectCareerGuidIds } });
    }

    if (projectCareerFilters.length > 0) {
      const projectCareerMatch =
        projectCareerFilters.length === 1
          ? projectCareerFilters[0]
          : { $or: projectCareerFilters };

      resolvedProjectCareers = await db
        .collection("careers")
        .find(
          {
            orgID,
            ...projectCareerMatch,
          },
          { projection: { _id: 1, id: 1 } }
        )
        .toArray();
    }

    const expandedIDs = [...new Set([
      ...createdCareers.flatMap((c: any) => [
        c._id?.toString(),
        c.id?.toString()
      ].filter(Boolean)),
      ...resolvedProjectCareers.flatMap((c: any) => [
          c._id?.toString(),
          c.id?.toString()
      ].filter(Boolean))
    ])] as string[];

    if (debug) {
      console.log(
        `[candidate-access] expanded lookup ${Date.now() - startedAt}ms (created=${createdCareers.length}, projects=${projectAccess.length}, resolved=${resolvedProjectCareers.length}, expanded=${expandedIDs.length})`
      );
    }

    return expandedIDs;

  } catch (error) {
    console.error("Error in getExpandedCandidateAccessIDs:", error);
    return [];
  }
}

/**
 * Returns interview emails that match any of the provided career IDs in this org.
 * Handles legacy interview career fields (`id`, `careerID`, `careerId`).
 */
export async function getAccessibleInterviewEmails(
  db: Db,
  orgID: string,
  careerIDs: string[]
): Promise<string[]> {
  if (!orgID || !Array.isArray(careerIDs) || careerIDs.length === 0) {
    return [];
  }

  return db.collection("interviews").distinct("email", {
    orgID,
    $or: [
      { id: { $in: careerIDs } },
      { careerID: { $in: careerIDs } },
      { careerId: { $in: careerIDs } },
    ],
  });
}

/**
 * Returns candidate emails in this organization with no interview/application history.
 */
export async function getInactiveNoHistoryCandidateEmails(
  db: Db,
  orgID: string,
  scopedEmails?: string[]
): Promise<string[]> {
  if (!orgID) {
    return [];
  }

  const affiliationMatch: any = { orgID };
  if (Array.isArray(scopedEmails) && scopedEmails.length > 0) {
    affiliationMatch["applicantInfo.email"] = { $in: scopedEmails };
  }

  const orgCandidateEmails = await db
    .collection("affiliations")
    .distinct("applicantInfo.email", affiliationMatch);

  if (orgCandidateEmails.length === 0) {
    return [];
  }

  const emailsWithApplicationHistory = await db.collection("interviews").distinct("email", {
    orgID,
    email: { $in: orgCandidateEmails },
  });

  const emailsWithApplicationHistorySet = new Set(emailsWithApplicationHistory);
  return orgCandidateEmails.filter(
    (email: string) => !emailsWithApplicationHistorySet.has(email)
  );
}
