import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { ensureCareerFetchIndexes } from "@/lib/utils/ensureIndexes";
import {
  buildInterviewsPipeline, collectApplicantEmailKeys, decorateApplicantAccounts,
} from "@/lib/utils/careerFetchPipelines";

/**
 * [Bonus: Optimize fetching] This route was averaging 25–72s on careers with
 * 1k–3k applicants (see OPTIMIZE_FETCHING.md). Three fixes:
 *  1. ensureCareerFetchIndexes — the four correlated $lookups now hit indexes
 *     instead of scanning their collections once per interview doc.
 *  2. The old `applicants` $lookup compared $toLower on the FOREIGN field, which
 *     no index can serve (full applicants scan × N interviews). Replaced with one
 *     batched, collation-indexed query + decorateApplicantAccounts (same output).
 *  3. Pipeline is otherwise unchanged — response shape is identical.
 */
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { db } = await connectMongoDB();
  await ensureCareerFetchIndexes(db);
  const { searchParams } = new URL(request.url);
  const careerID = searchParams.get("careerID");
  const userEmail = request.user.email;

  try {
    type InterviewDoc = Record<string, unknown> & { email?: string | null };
    type ApplicantDoc = { email?: string | null; status?: string | null };

    const interviewDocs = (await db
      .collection("interviews")
      .aggregate(buildInterviewsPipeline({ careerID, userEmail }))
      .toArray()) as InterviewDoc[];

    const { emails, hasEmpty } = collectApplicantEmailKeys(interviewDocs);
    const accountFilter = hasEmpty
      ? { $or: [{ email: { $in: [...emails, ""] } }, { email: null }, { email: { $exists: false } }] }
      : { email: { $in: emails } };
    const applicantDocs = (emails.length || hasEmpty
      ? await db
          .collection("applicants")
          .find(accountFilter, { projection: { email: 1, status: 1 } })
          .collation({ locale: "en", strength: 2 })
          .toArray()
      : []) as ApplicantDoc[];

    return NextResponse.json(decorateApplicantAccounts(interviewDocs, applicantDocs));
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch interviews" },
      { status: 500 }
    );
  }
});
