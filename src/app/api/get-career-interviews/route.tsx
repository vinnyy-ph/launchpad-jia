import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { ensureCareerFetchIndexes } from "@/lib/utils/ensureIndexes";
import {
  buildEvaluationsBatchPipeline,
  buildCommentCountsPipeline,
  buildLatestByUidPipeline,
  collectApplicantEmailKeys,
  decorateApplicantAccounts,
  joinInterviewBatches,
  type InterviewBatchResults,
} from "@/lib/utils/careerFetchPipelines";

/**
 * [Bonus: Optimize fetching] This route was averaging 25–72s on careers with
 * 1k–3k applicants (see OPTIMIZE_FETCHING.md). What changed:
 *  1. ensureCareerFetchIndexes — every joined collection now has a covering index.
 *  2. The original aggregation ran 5 correlated $lookups per interview doc
 *     (12,000+ index probes on a 3,000-applicant career; the applicants join
 *     was un-indexable outright). Replaced with: one indexed find for the
 *     interviews + FIVE batch queries that run in PARALLEL (evaluations,
 *     comment counts, latest history, latest recruiter action, applicant
 *     accounts), merged in JS by joinInterviewBatches/decorateApplicantAccounts.
 *  3. The redundant raw `evaluations`/`history`/`recruiterHistory` arrays are no
 *     longer returned — every consumer reads only the extracted singletons
 *     (currentEvaluation/latestApplicationMovement/latestRecruiterAction),
 *     which are unchanged. ~30% smaller payload.
 */
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { db } = await connectMongoDB();
  await ensureCareerFetchIndexes(db);
  const { searchParams } = new URL(request.url);
  const careerID = searchParams.get("careerID");
  const userEmail = request.user.email;

  try {
    type InterviewDoc = Record<string, unknown> & {
      _id: unknown;
      email?: string | null;
      interviewID?: unknown;
      applicationStatus?: string | null;
    };
    type ApplicantDoc = { email?: string | null; status?: string | null };

    const interviews = (await db
      .collection("interviews")
      .find({ id: careerID })
      .toArray()) as unknown as InterviewDoc[];

    const interviewUIDs = interviews.map((iv) => String(iv._id));
    const interviewIDs = interviews.map((iv) => iv.interviewID);
    const { emails, hasEmpty } = collectApplicantEmailKeys(interviews);
    const accountFilter = hasEmpty
      ? { $or: [{ email: { $in: [...emails, ""] } }, { email: null }, { email: { $exists: false } }] }
      : { email: { $in: emails } };

    const [evaluations, commentCounts, latestHistory, latestRecruiterHistory, applicantDocs] =
      await Promise.all([
        db.collection("recruiter-evaluations").aggregate(buildEvaluationsBatchPipeline(interviewUIDs)).toArray(),
        db.collection("comments").aggregate(buildCommentCountsPipeline(interviewIDs, userEmail)).toArray(),
        db.collection("interview-history").aggregate(buildLatestByUidPipeline(interviewUIDs)).toArray(),
        db.collection("recruiter-history").aggregate(buildLatestByUidPipeline(interviewUIDs)).toArray(),
        emails.length || hasEmpty
          ? db
              .collection("applicants")
              .find(accountFilter, { projection: { email: 1, status: 1 } })
              .collation({ locale: "en", strength: 2 })
              .toArray()
          : Promise.resolve([]),
      ]);

    const batches: InterviewBatchResults = {
      evaluations: evaluations as InterviewBatchResults["evaluations"],
      commentCounts: commentCounts as InterviewBatchResults["commentCounts"],
      latestHistory: latestHistory as InterviewBatchResults["latestHistory"],
      latestRecruiterHistory: latestRecruiterHistory as InterviewBatchResults["latestRecruiterHistory"],
    };

    const joined = joinInterviewBatches(interviews, batches);

    return NextResponse.json(decorateApplicantAccounts(joined, applicantDocs as ApplicantDoc[]));
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch interviews" },
      { status: 500 }
    );
  }
});
