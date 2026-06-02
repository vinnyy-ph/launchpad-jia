import { NextResponse } from "next/server";
import OpenAI from "openai";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

const MAX_JSON_REPAIR_ATTEMPTS = 3;

function extractLikelyJson(rawValue: string) {
  const trimmed = `${rawValue || ""}`.trim();
  if (!trimmed) {
    throw new Error("Empty LLM response.");
  }

  const withoutCodeFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const firstBraceIndex = withoutCodeFence.indexOf("{");
  const lastBraceIndex = withoutCodeFence.lastIndexOf("}");

  if (firstBraceIndex !== -1 && lastBraceIndex !== -1 && lastBraceIndex >= firstBraceIndex) {
    return withoutCodeFence.slice(firstBraceIndex, lastBraceIndex + 1);
  }

  return withoutCodeFence;
}

function parseAutofillJson(rawValue: string) {
  const candidate = extractLikelyJson(rawValue);
  const parsed = JSON.parse(candidate);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("LLM response is not a JSON object.");
  }

  return parsed;
}

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { chunks } = await request.json();
  const corePrompt = `
    You are an assistant that extracts structured data from a resume text.
    "digitalCV" is a legacy markdown format kept for backward compatibility.
    "structuredCV" is the new normalized object and should not try to mirror every legacy field one-to-one.
    
    CV chunks:
    ${chunks.map((chunk: any) => chunk.pageContent).join("\n")}

    JSON template: 
    {
      errorRemarks: <error remarks>,
      digitalCV:
        [
          {name: "Introduction", content: <markdown>},
          {name: "Current Position", content: <markdown>},
          {name: "Contact Info", content: <markdown>},
          {name: "Skills", content: <markdown>},
          {name: "Experience", content: <markdown>},
          {name: "Education", content: <markdown>},
          {name: "Projects", content: <markdown>},
          {name: "Certifications", content: <markdown>},
          {name: "Awards", content: <markdown>},
        ],
      structuredCV: {
        introduction: "<string>",
        skills: ["<string>"],
        contactInfo: {
          email: "<string>",
          phone: "<string>",
          countryCode: "<string>",
          address: "<string>",
          linkedin: "<string>",
          websites: [{ id: "<string>", url: "<string>", type: "<string>" }] // exclude LinkedIn URLs here
        },
        experience: [
          {
            id: "<string>",
            title: "<string>",
            company: "<string>",
            employmentType: "<string>",
            location: "<string>",
            workSetup: "<string>",
            startDate: { month: "<Month>", year: "<YYYY>" },
            endDate: { month: "<Month>", year: "<YYYY>" },
            isCurrentRole: <boolean>,
            description: "<string>"
          }
        ],
        education: [
          {
            id: "<string>",
            school: "<string>",
            degree: "<string>",
            fieldOfStudy: "<string>",
            startDate: { month: "<Month>", year: "<YYYY>" },
            endDate: { month: "<Month>", year: "<YYYY>" },
            description: "<string>"
          }
        ],
        projects: [
          {
            id: "<string>",
            name: "<string>",
            isCurrent: <boolean>,
            startDate: { month: "<Month>", year: "<YYYY>" },
            endDate: { month: "<Month>", year: "<YYYY>" },
            description: "<string>"
          }
        ],
        certifications: [
          {
            id: "<string>",
            name: "<string>",
            issuingOrganization: "<string>",
            issueDate: { month: "<Month>", year: "<YYYY>" },
            expirationDate: { month: "<Month>", year: "<YYYY>" },
            credentialId: "<string>",
            credentialUrl: "<string>"
          }
        ],
        awards: [
          {
            id: "<string>",
            title: "<string>",
            issuer: "<string>",
            issueDate: { month: "<Month>", year: "<YYYY>" },
            description: "<string>"
          }
        ]
      },
      name: "<Name of the applicant>",
      email: "<Email of the applicant>",
      numExperience: <string|null>,
      phone: <string|null>,
      location: <string|null>,
      currentPosition: <string|null>,
      company: <string|null>,
    }

    Processing Instructions:
      - Fill the "content" fields with detailed information.
      - Keep "digitalCV" as the legacy markdown display format for backward compatibility.
      - Also populate "structuredCV" using the exact keys shown in the template.
      - Do not add extra keys to "structuredCV".
      - Do NOT include the name of the applicant in the "content" fields.
      - If information is not explicitly present in the CV, do not invent, infer, or add placeholder text such as "Not available", "Not provided", "None listed", or similar.
      - For missing values, use only null, empty string "", empty arrays [], or empty date parts exactly as required by the template and rules below.
      - For structuredCV arrays (experience/education/projects/certifications/awards), return [] if no data.
      - For missing text fields in structuredCV, return empty string.
      - For missing date parts, return { month: "", year: "" }.
      - For digitalCV sections:
        - If a section has no actual information from the CV, set its "content" to an empty string.
        - Do not output fallback phrases or placeholder bullets.
      - For current roles/projects:
        - experience.isCurrentRole = true when ongoing; keep endDate as empty values.
        - projects.isCurrent = true when ongoing; keep endDate as empty values.
      - For the "numExperience" field:
        - Return the total professional experience in one of these formats: "1 month", "2 months", "1 year", "1.5 years", "2 years".
        - If the total experience cannot be determined, set it to null.
      - For the "phone" field:
        - Return the phone number in international country-code format with a leading "+" and no spaces, e.g. "+639171234567".
        - Normalize local formats to the country-code format when the country can be inferred from the CV.
        - Do not return numbers with spaces, parentheses, or hyphens.
        - Return null if not found.
      - For structuredCV.contactInfo.phone:
        - Use the same international country-code format with a leading "+" and no spaces.
        - Do not include spaces, parentheses, or hyphens.
      - For the "location" field:
        - Extract the candidate's location (city, country, or full address).
        - Return a single-line string, or null if not found.
      - For the "currentPosition" field:
        - Extract the current job title/role (single line).
        - Return "Student" if the person is a student or fresh graduate.
        - Return null if not found or cannot be determined.
      - For the "company" field:
        - Extract the current company name (single line).
        - Return null if not found or if the person is a student/fresh graduate.
      - For the "Current Position" section, return a concise single-line summary in this exact format:
        - "Current Job Position" for working professionals. For example, "Software Engineer" or "Data Analyst".
        - "Student" if the person is a student or fresh graduate.
        - Ensure no additional special characters or symbols are included.
      - Use correct and valid markdown in the "content" fields:
        - Contact info links must be markdown links.
        - Section titles use bold text (equivalent to <h2>), 
        - Paragraphs are normal text, 
        - Lists are in bullet points, etc.
      - "Contact Info" section must include the following if available:
        - Name
        - Email
        - Phone
        - Address
        - LinkedIn
        - GitHub
        - Twitter
      - For structuredCV.contactInfo:
        - Put LinkedIn only in the "linkedin" field.
        - Do NOT include LinkedIn URL in "websites".
      - For the "Skills" section in digitalCV:
        - Extract ONLY the actual skill names, not section headers like "Skills", "Technical Skills", "Soft Skills"
        - Each skill should be on its own line with a bullet point (-)
        - Remove any leading dashes or special characters from skill names
        - Example format:
          - JavaScript
          - React
          - Project Management
        - DO NOT include category headers or subsection titles
      - Extract actual skill names and place them within the new "skills" array inside structuredCV.
      - For the "errorRemarks", return a message if the text does not appear to be a CV; otherwise, set it to null.
      - Follow the JSON template strictly.
      - Return only the valid JSON output.
      - On every markdown content, just include the user's information and avoid additional unnecessary details such as the content title.
      - DO NOT include \`\`\`json or \`\`\` around the response.
    `;

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const requestCompletion = async (prompt: string) =>
    openai.responses.create({
      model: "gpt-5-nano",
      reasoning: { effort: "low" },
      input: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

  let lastOutputText = "";
  let parsedResult: any = null;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_JSON_REPAIR_ATTEMPTS; attempt += 1) {
    const prompt =
      attempt === 0
        ? corePrompt
        : `
          Fix the following response so it becomes valid JSON.
          Requirements:
          - Return exactly one valid JSON object.
          - Do not wrap the response in markdown code fences.
          - Do not add commentary before or after the JSON.
          - Preserve the original data as much as possible.
          - If a field is invalid JSON, correct it while keeping the intended value.

          Invalid response:
          ${lastOutputText}
        `;

    const completion = await requestCompletion(prompt);
    lastOutputText = `${completion.output_text || ""}`.trim();

    try {
      parsedResult = parseAutofillJson(lastOutputText);
      break;
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error("Invalid JSON.");
    }
  }

  if (!parsedResult) {
    console.error("autofill-cv failed to produce valid JSON:", lastError);
    return NextResponse.json(
      {
        error: "invalid_autofill_json",
        message:
          "We couldn't process the CV response into valid data. Please try again.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    parsed: parsedResult,
    result: JSON.stringify(parsedResult),
  });
});
