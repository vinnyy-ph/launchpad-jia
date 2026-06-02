import OpenAI from "openai";

export type ExtractedContactFields = {
  phone: string | null;
  currentPosition: string | null;
  company: string | null;
  location: string | null;
  skills: string[];
};

export type CvContactAiExtractorOptions = {
  model?: string;
};

const normalizeNullableString = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s : null;
};

export async function extractContactFieldsFromTextWithAi(
  text: string,
  options: CvContactAiExtractorOptions = {}
): Promise<{ fields: ExtractedContactFields; model: string; raw: string }> {
  const model = options.model || "gpt-4o-mini";

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `You are a strict information extraction engine.

Task:
Extract the candidate's contact/current role fields and skills from the provided resume text.

Return ONLY valid JSON (no markdown fences) in this exact shape:
{
  "phone": string | null,
  "currentPosition": string | null,
  "company": string | null,
  "location": string | null,
  "skills": string[]
}

Rules:
- If a value cannot be confidently found, use null.
- Do not infer values.
- Keep values concise.
- phone should be the raw phone number as written (including country code if present).
- currentPosition should be a job title / role (single line).
- company should be the current company name (single line).
- location should be the candidate's location (city, country, or full address).
- skills should be an array of clean, normalized skill names extracted from the Skills section.
- Each skill should be a short phrase (1-5 words), not a sentence or paragraph.
- Return a maximum of 50 skills.
- Return an empty array if no skills can be extracted.

Resume text:
${text}`;

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0,
  });

  const raw = completion.choices?.[0]?.message?.content || "";

  let parsed: any = null;
  try {
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      fields: { phone: null, currentPosition: null, company: null, location: null, skills: [] },
      model,
      raw,
    };
  }

  // Parse and normalize skills array
  let skills: string[] = [];
  if (Array.isArray(parsed?.skills)) {
    skills = parsed.skills
      .map((s: unknown) => (typeof s === "string" ? s.trim() : ""))
      .filter((s: string) => s.length > 0 && s.length <= 100)
      .slice(0, 15);
  }

  const fields: ExtractedContactFields = {
    phone: normalizeNullableString(parsed?.phone),
    currentPosition: normalizeNullableString(parsed?.currentPosition),
    company: normalizeNullableString(parsed?.company),
    location: normalizeNullableString(parsed?.location),
    skills,
  };

  return { fields, model, raw };
}
