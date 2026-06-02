import { OpenAI } from "openai";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  const openai = new OpenAI();
  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
  });

  return new Response(JSON.stringify({ text: transcription.text }));
});
