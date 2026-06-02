import AssessmentGate from "@/lib/components/CandidateProfileComponents/AssessmentGate";
import { notFound } from "next/navigation";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { verifyShareableAssessmentPreviewToken } from "@/lib/utils/shareableAssessmentPreviewToken";

type Props = {
  params: Promise<{
    segments: string[];
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CandidateProfilePage({ params, searchParams }: Props) {
  const { segments } = await params;
  const sp = (await searchParams) ?? {};
  const previewTokenParam = sp.previewToken;
  const previewToken =
    typeof previewTokenParam === "string" ? previewTokenParam : Array.isArray(previewTokenParam) ? previewTokenParam[0] : undefined;
  
  let profileId = "";
  let userName = "";
  let jobTitle = "";

  if (segments.length === 1) {
    [profileId] = segments;
  } else if (segments.length === 3) {
    // Legacy format: /candidate-profile/{userName}/{jobTitle}/{profileId}
    [userName, jobTitle, profileId] = segments;
  } else {
    notFound();
  }

  if (previewToken) {
    const previewValidation = verifyShareableAssessmentPreviewToken(previewToken);
    if (!previewValidation.valid) {
      notFound();
    }

    if (previewValidation.payload.previewId !== profileId) {
      notFound();
    }

    return (
      <AssessmentGate
        userName={userName}
        jobTitle={jobTitle}
        profileId={profileId}
        previewToken={previewToken}
      />
    );
  }

  const { db } = await connectMongoDB();
  const assessment = await db.collection("shareable-assessments").findOne({ profileId });

  if (!assessment || !assessment.active) {
    notFound();
  }

  return <AssessmentGate userName={userName} jobTitle={jobTitle} profileId={profileId} />;
}
