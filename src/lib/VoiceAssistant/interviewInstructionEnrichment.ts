import { ObjectId } from "mongodb";
import type { Db } from "mongodb";

/**
 * Session continuity block appended to realtime instructions (resumed interviews).
 */
export function buildContinuityBlock(sessionContext: unknown): string {
  if (!sessionContext || typeof sessionContext !== "object") return "";

  const ctx = sessionContext as Record<string, unknown>;
  const {
    transcript,
    reconnectCount,
    questionsStatus,
    allQuestions,
    questionsAsked,
    lastQuestionIndex,
  } = ctx;

  let block = "\n\n--- SESSION CONTINUITY ---";
  block +=
    "\nThis is a RESUMED session. The candidate was disconnected or had to reload.";
  block +=
    "\nYou MUST apologize briefly for the interruption, then continue exactly where you left off.";
  block += "\nDO NOT re-introduce yourself or re-explain the interview format.";

  if (reconnectCount && typeof reconnectCount === "number" && reconnectCount > 1) {
    block += `\nThe candidate has reconnected ${reconnectCount} time(s). Keep the apology brief.`;
  }

  if (Array.isArray(questionsStatus) && questionsStatus.length > 0) {
    const answered = questionsStatus.filter((qs: any) => qs.status === "answered");
    const askedNoAnswer = questionsStatus.filter((qs: any) => qs.status === "asked");
    const unanswered = questionsStatus.filter((qs: any) => qs.status === "unanswered");

    if (answered.length > 0) {
      block += "\n\nQuestions COMPLETED (asked and answered — do NOT repeat these):";
      answered.forEach((qs: any) => {
        block += `\n  ${qs.index + 1}. ${qs.question}`;
        if (qs.answer) {
          block += `\n     Candidate's answer: "${qs.answer}"`;
        }
      });
    }

    if (askedNoAnswer.length > 0) {
      block +=
        "\n\nQuestions ASKED BUT NOT ANSWERED (the session broke before the candidate could respond — you MUST re-ask these):";
      askedNoAnswer.forEach((qs: any) => {
        block += `\n  ${qs.index + 1}. ${qs.question}`;
      });
      block +=
        "\nRe-ask these questions. The candidate was interrupted and did not get to answer.";
    }

    if (unanswered.length > 0) {
      block += "\n\nQuestions NOT YET ASKED (you MUST ask all of these):";
      unanswered.forEach((qs: any) => {
        block += `\n  ${qs.index + 1}. ${qs.question}`;
      });
    }

    const totalRemaining = askedNoAnswer.length + unanswered.length;
    if (totalRemaining > 0) {
      block += `\n\nTotal remaining: ${totalRemaining} question(s). Do NOT end the interview until every question has a direct and complete answer from the candidate.`;
    }
  } else if (Array.isArray(allQuestions) && allQuestions.length > 0) {
    const askedSet = new Set(
      Array.isArray(questionsAsked) ? (questionsAsked as unknown[]) : []
    );
    const remaining = (allQuestions as unknown[]).filter(
      (_: unknown, i: number) => !askedSet.has(i)
    );
    if (remaining.length > 0) {
      block += "\n\nQuestions REMAINING (you MUST ask all of these):";
      remaining.forEach((q: string) => {
        const originalIdx = (allQuestions as string[]).indexOf(q);
        block += `\n  ${originalIdx + 1}. ${q}`;
      });
      block += `\n\nTotal remaining: ${remaining.length} question(s). Do NOT end the interview until all are answered.`;
    }
  }

  if (Array.isArray(transcript) && transcript.length > 0) {
    block += "\n\nConversation so far:";
    for (const turn of transcript as { role?: string; text?: string }[]) {
      const speaker = turn.role === "user" ? "Candidate" : "Jia";
      block += `\n${speaker}: ${turn.text ?? ""}`;
    }
  }

  if (lastQuestionIndex != null && typeof lastQuestionIndex === "number" && lastQuestionIndex > 0) {
    block += `\n\nResume from around question #${lastQuestionIndex + 1}. Do NOT start over.`;
  }

  block += "\n--- END SESSION CONTINUITY ---";
  return block;
}

export interface EnrichInstructionsParams {
  interviewID?: string | null;
  baseInstructions: string;
  candidateName?: string | null;
  sessionContext?: unknown;
}

/**
 * Appends secret prompts (career / talent vault), privacy line, and continuity — same
 * semantics as the former inline block in `/api/ephemeral-key`.
 */
export async function enrichInterviewInstructions(
  db: Db,
  params: EnrichInstructionsParams
): Promise<string> {
  let finalInstructions = params.baseInstructions;

  if (params.interviewID) {
    try {
      const interview = await db.collection("interviews").findOne({
        interviewID: params.interviewID,
      });

      if (interview && interview.flow !== "talent-vault") {
        const career = await db.collection("careers").findOne({
          id: interview.id,
        });

        if (career && career.interviewSecretPrompt) {
          finalInstructions += `\n\nAdditional Interview Guidelines (Secret Prompt):\n${career.interviewSecretPrompt}`;
        }
      } else if (interview && interview.flow === "talent-vault") {
        if (interview.subprogramId && ObjectId.isValid(interview.subprogramId)) {
          try {
            const subprogram = await db.collection("tv-subprograms").findOne(
              { _id: new ObjectId(interview.subprogramId) },
              { projection: { "interview.interviewSecretPrompt": 1 } }
            );

            if (subprogram?.interview?.interviewSecretPrompt?.trim()) {
              const promptValue = subprogram.interview.interviewSecretPrompt.trim();
              finalInstructions += `\n\nAdditional Interview Guidelines (Secret Prompt):\n${promptValue}`;
            }
          } catch (subprogramError) {
            console.error("Error fetching Talent Vault subprogram prompt:", subprogramError);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching secret prompt:", error);
    }
  }

  if (params.candidateName) {
    finalInstructions += `\n\nDo NOT address the candidate by their name (${params.candidateName}).`;
  }

  if (params.sessionContext) {
    finalInstructions += buildContinuityBlock(params.sessionContext);
  }

  return finalInstructions;
}
