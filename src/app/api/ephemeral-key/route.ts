import axios from "axios";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { enrichInterviewInstructions } from "@/lib/VoiceAssistant/interviewInstructionEnrichment";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { config, instructions, tools, interviewID, candidateName, sessionContext } =
    await request.json();

  if (!config) {
    return new Response(JSON.stringify({ error: "Config is required" }), {
      status: 400,
    });
  }

  const turnDetection =
    config.turn_detection?.type === "semantic_vad"
      ? {
          type: "semantic_vad" as const,
          eagerness: "high" as const,
          create_response: true,
          interrupt_response: true,
        }
      : {
          type: "server_vad" as const,
          prefix_padding_ms: 400,
          silence_duration_ms: 3000,
          create_response: true,
          interrupt_response: true,
          threshold: 0.7,
        };

  const transcription: { model: string; prompt?: string } = {
    model: config.transcription_model || "whisper-1",
  };
  if (config.transcription_prompt) {
    transcription.prompt = config.transcription_prompt;
  }

  const session: Record<string, unknown> = {
    type: "realtime",
    model: config.llm_realtime_model || "gpt-4o-realtime-preview-2024-10-01",
    tool_choice: "auto",
    max_output_tokens: config.max_response_output_tokens || 4096,
    audio: {
      input: {
        transcription,
        turn_detection: turnDetection,
      },
      output: {
        voice: config.voice || "alloy",
      },
    },
  };

  if (instructions) {
    const { db } = await connectMongoDB();
    session.instructions = await enrichInterviewInstructions(db, {
      interviewID,
      baseInstructions: instructions,
      candidateName,
      sessionContext,
    });
  }

  if (tools) {
    session.tools = tools;
  }

  try {
    const { data } = await axios.post(
      "https://api.openai.com/v1/realtime/client_secrets",
      { session },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // New API returns `value`; keep client_secret for existing consumers.
    return new Response(
      JSON.stringify({
        key: {
          ...data,
          client_secret: { value: data.value },
        },
      })
    );
  } catch (err: any) {
    console.error("[ERROR] Failed to get ephemeral key:", err);
    console.log(err?.response?.data);
    return new Response(
      JSON.stringify({
        error: "Failed to get ephemeral key",
        details: err?.response?.data,
      }),
      { status: err?.response?.status || 500 }
    );
  }
});
