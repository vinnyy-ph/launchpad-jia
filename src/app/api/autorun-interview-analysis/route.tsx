import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { logActivity } from "@/lib/utils/activityLogger";
import OpenAI from "openai";
import { ObjectId } from "mongodb";
import {
  parseTalentVaultAnalysis,
  talentVaultAnalysisResponseFormat,
} from "./talentVaultAnalysis";
import { toTimestampMs } from "@/app/(talent-vault)/lib/server/talentVaultProfiles";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    console.log("[Autorun Interview Analysis] Starting endpoint execution");
    
    const { interviewID } = await request.json();

    // Validate interviewID parameter
    if (!interviewID) {
      console.error("[Autorun Interview Analysis] Missing interviewID parameter");
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameter",
        },
        { status: 400 }
      );
    }

    console.log(`[Autorun Interview Analysis] Processing interviewID: ${interviewID}`);

    // Start background processing (don't await - let it run in background)
    processInterviewAnalysis(interviewID).catch((error) => {
      console.error(`[Autorun Interview Analysis] Background processing error for ${interviewID}:`, error);
    });

    // Return immediately to allow background processing
    return NextResponse.json({
      success: true,
      message: "Interview analysis and summary generation started",
      interviewID: interviewID,
    });
  } catch (error) {
    console.error("[Autorun Interview Analysis] Endpoint error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to start processing",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
});

async function processInterviewAnalysis(interviewID: string) {
  const { db } = await connectMongoDB();
  const MAX_RETRIES = 3;
  let attempt = 0;
  let success = false;

  while (attempt < MAX_RETRIES && !success) {
    attempt++;
    try {
      console.log(`[Autorun Interview Analysis] Attempt ${attempt}/${MAX_RETRIES} for ${interviewID}`);

      // Update attempts count and reset error state for new attempt
      await db.collection("interviews").updateOne(
        { interviewID: interviewID },
        {
          $set: {
            autoAnalyzedAttempts: attempt,
            autoAIAnalyzed: false,
            autoAnalysisError: null,
          }
        }
      );

      // Execute core analysis logic
      const results = await executeAnalysisCore(interviewID, db);

      // If successful, update DB with results and success flags
      const updateData: any = {
        analysis: results.analysisData,
        summary: results.formattedSummary,
        score: (results.analysisData as any)?.overall_score,
        jobFit: (results.analysisData as any)?.final_assessment,
        updatedAt: Date.now(),
        autoAIAnalyzed: true,
        autoAnalysisError: null,
      };

      if (results.isTalentVaultFlow) {
        const overallScore = Number((results.analysisData as any)?.overall_score);
        if (Number.isFinite(overallScore)) {
          updateData.score = overallScore;
        } else {
          updateData.score = null;
        }

        const finalAssessment =
          typeof (results.analysisData as any)?.final_assessment === "string"
            ? (results.analysisData as any).final_assessment.trim()
            : "";
        updateData.jobFit = finalAssessment.length > 0 ? finalAssessment : null;
      }

      await db.collection("interviews").updateOne(
        { interviewID: interviewID },
        { $set: updateData }
      );

      console.log(`[Autorun Interview Analysis] ✅ Successfully completed on attempt ${attempt}`);
      success = true;

      // Record activity history for AI interview analysis completion
      try {
        const interviewDoc = await db.collection("interviews").findOne({ interviewID: interviewID });
        const careerDoc = await db.collection("careers").findOne({ id: interviewDoc?.id });
        
        await logActivity({
          db,
          kind: "system_endorsed",
          interview: interviewDoc,
          career: careerDoc,
          extraMetadata: {
            message: "AI interview analysis completed",
            matchFit: results.analysisData.final_assessment || null,
            overallScore: results.analysisData.overall_score || null,
          },
        });
      } catch (error) {
        console.error("Failed to record activity for AI interview analysis completion:", error);
      }

      return {
        success: true,
        interviewID: interviewID,
        analysis: results.analysisData,
        summary: results.formattedSummary,
      };

    } catch (error: any) {
      console.error(`[Autorun Interview Analysis] ❌ Attempt ${attempt} failed:`, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      // Update error status
      await db.collection("interviews").updateOne(
        { interviewID: interviewID },
        {
          $set: {
            autoAIAnalyzed: false,
            autoAnalysisError: errorMessage
          }
        }
      );

      if (attempt === MAX_RETRIES) {
        console.error(`[Autorun Interview Analysis] All ${MAX_RETRIES} attempts failed for ${interviewID}`);
        throw error;
      } else {
        // Optional: backoff delay (2 seconds)
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
}

async function executeAnalysisCore(interviewID: string, db: any) {
  try {
    console.log(`[Step 1] Fetching interview data for interviewID: ${interviewID}`);
    
    // Step 1: Fetch Interview Data
    const interview = await db.collection("interviews").findOne({
      interviewID: interviewID,
    });

    if (!interview) {
      console.error(`[Step 1] Interview not found: ${interviewID}`);
      throw new Error(`Interview not found for interviewID: ${interviewID}`);
    }

    const isTalentVaultFlow = interview.flow === "talent-vault";
    const retakePreparedAtMs =
      isTalentVaultFlow && interview?.retakeInProgress === true
        ? toTimestampMs(interview?.retakePreparedAt)
        : null;

    console.log(`[Step 1] Interview found: ${interview.name} - ${interview.jobTitle}`);

    // Step 2: Fetch Transcripts
    console.log(`[Step 2] Fetching transcripts for interviewID: ${interviewID}`);
    const transcriptDocs = await db
      .collection("transcripts")
      .find({ interviewID: interviewID })
      .sort({ time: 1 })
      .toArray();

    const transcripts =
      retakePreparedAtMs !== null
        ? transcriptDocs.filter((transcriptDoc: any) => {
            const transcriptTimeMs = toTimestampMs(transcriptDoc?.time);
            return transcriptTimeMs !== null && transcriptTimeMs >= retakePreparedAtMs;
          })
        : transcriptDocs;

    if (!transcripts || transcripts.length === 0) {
      console.error(`[Step 2] No transcripts found for interviewID: ${interviewID}`);
      throw new Error(
        retakePreparedAtMs !== null
          ? `No transcripts found for current retake attempt: ${interviewID}`
          : `No transcripts found for interviewID: ${interviewID}`
      );
    }

    console.log(`[Step 2] Found ${transcripts.length} transcript messages`);

    // Format transcript data for LLM processing
    // Match frontend logic: type === "jia" is interviewer, otherwise applicant
    let intSummary = "";
    transcripts.forEach((msg: any) => {
      const speakerType = msg.type === "jia" ? "interviewer" : "applicant";
      intSummary += `${speakerType}: ${msg.content}\n`;
    });

    console.log(`[Step 2] Transcript formatted, length: ${intSummary.length} characters`);

    // Step 3: Fetch Global Settings
    console.log(`[Step 3] Fetching global settings for prompts`);
    const globalSettings = await db
      .collection("global-settings")
      .findOne({ name: "global-settings" });

    const analysisPrompt = isTalentVaultFlow
      ? globalSettings?.talentVault?.analysis_prompt?.prompt || ""
      : globalSettings?.analysis_prompt?.prompt || "";
    const summaryPrompt = isTalentVaultFlow
      ? globalSettings?.talentVault?.summary_prompt?.prompt || ""
      : globalSettings?.summary_prompt?.prompt || "";

    if (isTalentVaultFlow && (!analysisPrompt || !summaryPrompt)) {
      throw new Error(
        "Missing talentVault analysis_prompt or summary_prompt in global-settings"
      );
    }

    console.log(`[Step 3] Analysis prompt found: ${!!analysisPrompt}, Summary prompt found: ${!!summaryPrompt}`);

    // Compute TV secret prompt suffix (additions-only approach)
    let tvSecretSuffix = "";
    if (isTalentVaultFlow && interview.subprogramId) {
      try {
        if (ObjectId.isValid(interview.subprogramId)) {
          const subprogram = await db
            .collection("tv-subprograms")
            .findOne(
              { _id: new ObjectId(interview.subprogramId) },
              { projection: { secretPrompt: 1 } }
            );

          if (subprogram?.secretPrompt) {
            const secretPrompt = String(subprogram.secretPrompt).trim();
            if (secretPrompt.length > 0) {
              tvSecretSuffix = "\n\nAdditional Interview Guidelines (Secret Prompt):\n" + secretPrompt;
            }
          }
        }
      } catch (error) {
        // Fail-open: Continue without secret prompt on error
        console.error(
          `[Step 3] Warning: Could not retrieve subprogram secret prompt, continuing without it`
        );
      }
    }

    // Step 4: Generate Interview Analysis
    console.log(`[Step 4] Generating interview analysis`);
    let analysisResult = null;
    let analysisData = null;

    try {
      const analysisLLMPrompt = `
      You are a helpful assistant that can answer questions and help with tasks.
      Take the Job details and interview transcript and create an analysis based on the processing instructions.

      Job Details:
        Applicant Name: ${interview.name}
        Job Title: ${interview.jobTitle}
        Job Description: 
        ${interview.jobDescription || interview.description || ""}
  

      Interview Transcript:
      ${intSummary}

      ${analysisPrompt}
      ${tvSecretSuffix}
      `;

      console.log(`[Step 4] Calling OpenAI API for analysis`);
      const analysisCompletion = isTalentVaultFlow
        ? await openai.responses.create({
            model: "o4-mini",
            reasoning: { effort: "high" },
            input: [
              {
                role: "user",
                content: analysisLLMPrompt,
              },
            ],
            text: {
              format: talentVaultAnalysisResponseFormat,
            },
          })
        : await openai.responses.create({
            model: "o4-mini",
            reasoning: { effort: "high" },
            input: [
              {
                role: "user",
                content: analysisLLMPrompt,
              },
            ],
          });

      analysisResult = analysisCompletion.output_text;
      console.log(`[Step 4] OpenAI API response received, length: ${analysisResult.length}`);

      if (isTalentVaultFlow) {
        analysisData = parseTalentVaultAnalysis(analysisResult);
      } else {
        const cleanedResponse = analysisResult
          .replace("```json", "")
          .replace("```", "")
          .trim();
        analysisData = JSON.parse(cleanedResponse);
      }

      if (isTalentVaultFlow) {
        console.log(
          `[Step 4] Talent Vault analysis parsed successfully. bestJobFit: ${analysisData.bestJobFit?.length || 0}, matchingKeywords: ${analysisData.matchingSignals?.keywords?.length || 0}`
        );
      } else {
        console.log(
          `[Step 4] Analysis parsed successfully. Overall score: ${analysisData.overall_score}`
        );
      }

    } catch (error) {
      console.error(`[Step 4] Error generating analysis:`, error);
      throw new Error(`Failed to generate interview analysis: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    // Step 5: Generate Interview Summary
    console.log(`[Step 5] Generating interview summary`);
    let summaryResult = null;
    let formattedSummary = null;

    try {
      // Use default summary prompt if not found in global settings
      const defaultSummaryPrompt = `
      Your task is to create a short an concise summary of the interview

      - Address summary to the applicant the applicant will be reading this summary
      - provide 3 paragrams, 3 sentences maximum for the overall summary
      - followed by "Among your proudest accomplishments:" section
        - provide 5 maximum points of the best accomplishments of the applicant
      - provide only the markdown output without any other text
      `;

      const summaryLLMPrompt = `
      You are a helpful assistant that can answer questions and help with tasks.
      Take the Job details and interview transcript and create a summary of the interview.

      Job Details:
        Applicant Name: ${interview.name}
        Job Title: ${interview.jobTitle}
        Job Description: ${interview.jobDescription || interview.description || ""}

      Interview Transcript:
      ${intSummary}
  
      ${summaryPrompt || (isTalentVaultFlow ? "" : defaultSummaryPrompt)}
      ${tvSecretSuffix}
      `;

      console.log(`[Step 5] Calling OpenAI API for summary`);
      const summaryCompletion = await openai.responses.create({
        model: "o4-mini",
        reasoning: { effort: "high" },
        input: [
          {
            role: "user",
            content: summaryLLMPrompt,
          },
        ],
      });

      summaryResult = summaryCompletion.output_text;
      console.log(`[Step 5] OpenAI API response received, length: ${summaryResult.length}`);

      // Format response - remove markdown code blocks
      formattedSummary = summaryResult
        .replace("```markdown", "")
        .replace("```", "")
        .replace("markdown", "")
        .trim();

      console.log(`[Step 5] Summary formatted successfully`);

    } catch (error) {
      console.error(`[Step 5] Error generating summary:`, error);
      throw new Error(`Failed to generate interview summary: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    return {
      analysisData,
      formattedSummary,
      isTalentVaultFlow,
    };
  } catch (error) {
    throw error;
  }
}
