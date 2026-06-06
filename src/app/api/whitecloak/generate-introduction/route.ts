import { NextResponse } from "next/server";
import OpenAI from "openai";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import {
  buildIntroductionPrompt,
  hasProfileContentForIntro,
  shapeIntroductionHtml,
} from "@/lib/utils/introductionAI";
import type { StructuredCV } from "@/lib/utils/structuredCV";

// Writes a short first-person introduction from the candidate's assembled
// profile. Mirrors the OpenAI client pattern in api/whitecloak/autofill-cv.
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const body = await request.json().catch(() => null);
  const profile = body?.profile as StructuredCV | undefined;

  if (!profile || typeof profile !== "object" || !hasProfileContentForIntro(profile)) {
    return NextResponse.json(
      {
        error: "empty_profile",
        message: "Add some profile details before generating an introduction.",
      },
      { status: 400 },
    );
  }

  const prompt = buildIntroductionPrompt(profile);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const completion = await openai.responses.create({
      model: "gpt-5-nano",
      reasoning: { effort: "low" },
      input: [{ role: "user", content: prompt }],
    });

    const introduction = shapeIntroductionHtml(`${completion.output_text || ""}`);

    if (!introduction) {
      return NextResponse.json(
        {
          error: "empty_generation",
          message: "The introduction came back empty. Please try again.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ introduction });
  } catch (error) {
    console.error("generate-introduction failed:", error);
    return NextResponse.json(
      {
        error: "generation_failed",
        message: "We couldn't generate an introduction. Please try again.",
      },
      { status: 502 },
    );
  }
});
