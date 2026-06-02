import { OpenAI } from "openai";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


type Voice = "alloy" | "ash" | "ballad" | "cedar" | "coral" | "echo" | "fable" | "onyx" | "nova" | "marin" | "sage" | "shimmer" | "verse";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { text, voice = "alloy" } = await request.json();

  if (!text) {
    return new Response(JSON.stringify({ error: "Text is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const openai = new OpenAI();
    
    // Using gpt-4o-mini-tts for all voices as it supports all 13 built-in voices 
    // and is optimized for direct text-to-speech without complex parameters.
    const speechResponse = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: voice.toLowerCase() as any,
      input: text,
    });

    return new Response(await speechResponse.arrayBuffer(), {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (error) {
    console.error("Text-to-speech error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate speech" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
