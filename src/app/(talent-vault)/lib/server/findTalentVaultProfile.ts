import { ObjectId, type Db } from "mongodb";
import { deriveTalentVaultSummary } from "@/app/(talent-vault)/lib/talentVaultStatus";

type FindTalentVaultProfileParams = {
  applicantId?: unknown;
  email?: string | null;
};

function getApplicantIdCandidates(applicantId: unknown) {
  if (!applicantId) return [];

  const candidates: any[] = [applicantId];
  const applicantIdString =
    typeof applicantId === "string"
      ? applicantId
      : typeof (applicantId as any)?.toString === "function"
      ? (applicantId as any).toString()
      : null;

  if (applicantIdString && !candidates.includes(applicantIdString)) {
    candidates.push(applicantIdString);
  }

  if (applicantIdString && ObjectId.isValid(applicantIdString)) {
    const objectIdCandidate = ObjectId.createFromHexString(applicantIdString);
    const hasObjectIdCandidate = candidates.some(
      (candidate) =>
        candidate instanceof ObjectId && candidate.equals(objectIdCandidate)
    );

    if (!hasObjectIdCandidate) {
      candidates.push(objectIdCandidate);
    }
  }

  return candidates;
}

export async function findTalentVaultProfile(
  db: Db,
  { applicantId, email }: FindTalentVaultProfileParams
) {
  const profiles = db.collection("tv-profiles");
  const applicantIdCandidates = getApplicantIdCandidates(applicantId);
  const normalizedEmail = email?.trim().toLowerCase();

  if (applicantIdCandidates.length > 0) {
    const profileByApplicantId = await profiles.findOne(
      applicantIdCandidates.length === 1
        ? { applicantId: applicantIdCandidates[0] }
        : { applicantId: { $in: applicantIdCandidates } }
    );

    if (profileByApplicantId) {
      return profileByApplicantId;
    }
  }

  if (!normalizedEmail) {
    return null;
  }

  const profileByExactEmail = await profiles.findOne({
    "userInfo.email": normalizedEmail,
  });

  if (profileByExactEmail) {
    return profileByExactEmail;
  }

  return profiles.findOne({
    $expr: {
      $eq: [{ $toLower: "$userInfo.email" }, normalizedEmail],
    },
  });
}

export async function resolveTalentVaultForAuth(
  db: Db,
  params: FindTalentVaultProfileParams
) {
  let talentVaultProfile = await findTalentVaultProfile(db, params);
  let talentVaultSummary = deriveTalentVaultSummary(talentVaultProfile);

  if (
    talentVaultProfile &&
    talentVaultSummary.status === "active" &&
    talentVaultProfile.state !== "completed"
  ) {
    const parsedCompletedAt = talentVaultProfile.completedAt
      ? new Date(talentVaultProfile.completedAt)
      : null;
    const completedAt =
      parsedCompletedAt && !Number.isNaN(parsedCompletedAt.getTime())
        ? parsedCompletedAt
        : new Date();
    const updatedAt = new Date();

    await db.collection("tv-profiles").updateOne(
      { _id: talentVaultProfile._id },
      {
        $set: {
          state: "completed",
          status: "active",
          completedAt,
          updatedAt,
        },
      }
    );

    talentVaultProfile = {
      ...talentVaultProfile,
      state: "completed",
      status: "active",
      completedAt,
      updatedAt,
    };
    talentVaultSummary = deriveTalentVaultSummary(talentVaultProfile);
  }

  return talentVaultSummary;
}

