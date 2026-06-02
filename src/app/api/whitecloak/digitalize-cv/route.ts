// TODO (Vince) - For Merging

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { chunks, forTalentVault = false } = await request.json();

  const educationFieldInstruction = forTalentVault
    ? `"education": Array<{
      institution: <string|null>,
      degree: <string|null>,
      fieldOfStudy: <string|null>,
      startDate: <string|null>,
      endDate: <string|null>
    }>,`
    : "";
  const matchingSignalsFieldInstruction = forTalentVault
    ? `"matchingSignals": {
      roleTitles: Array<string>,
      hardSkills: Array<string>,
      domains: Array<string>,
      industries: Array<string>,
      seniority: <"intern"|"junior"|"associate"|"mid"|"senior"|null>,
      keywords: Array<string>,
      confidence: <number>
    }`
    : "";
  const forTalentVaultInstruction = forTalentVault
    ? `- In digitalCV "Education" section, basic bullet points only
    - For the separate "education" field:
      - Extract all education entries fill in the array with institution, degree, fieldOfStudy, start/end dates if available. Otherwise null.
      - Degree MUST omit field of study (i.e Bachelor of Science in Computer Science -> Bachelor of Science)
      - Field of study should only include the major (i.e Computer Science), and omit degree type.
      - Institution name MUST have proper capitalization
      - Start/End date should be in "<Complete Month Name> YYYY" format. YYYY only if no month. Otherwise null.
    - For the separate "matchingSignals" field:
      - Populate using CV evidence only (no assumptions beyond the CV text).
      - roleTitles: 3-8 canonical role titles.
      - hardSkills: 6-18 concrete skills/tools/frameworks/languages.
      - domains: 0-8 domain areas (e.g. frontend, backend, data, product, operations).
      - industries: 0-6 industries only if explicitly implied by CV.
      - seniority: only one of "intern", "junior", "associate", "mid", "senior", or null if unclear.
      - keywords: 8-15 high-signal phrases (1-4 words each).
      - confidence: decimal number from 0 to 1.
      - All list entries MUST be lowercase and deduplicated.
      - Exclude generic soft terms from keywords (e.g. hardworking, team player, fast learner, good communication).`
    : "";

  const corePrompt = `
    You are an assistant that extracts structured data from a resume text.
    
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
      name: "<Name of the applicant>",
      email: "<Email of the applicant>",
      numExperience: <string|null>,
      phone: <string|null>,
      location: <string|null>,
      currentPosition: <string|null>,
      company: <string|null>,
      ${educationFieldInstruction}
      ${matchingSignalsFieldInstruction}
    }

    Processing Instructions:
      - Fill the "content" fields with detailed information.
      - Do NOT include the name of the applicant in the "content" fields.
      - For the "numExperience" field:
        - Return the total professional experience in one of these formats: "1 month", "2 months", "1 year", "1.5 years", "2 years".
        - If the total experience cannot be determined, set it to null.
      - For the "phone" field:
        - Extract the phone number as written (including country code if present).
        - Return the raw phone number string, or null if not found.
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
      - For the "Skills" section:
        - Extract ONLY the actual skill names, not section headers like "Skills", "Technical Skills", "Soft Skills"
        - Each skill should be on its own line with a bullet point (-)
        - Remove any leading dashes or special characters from skill names
        - Example format:
          - JavaScript
          - React
          - Project Management
        - DO NOT include category headers or subsection titles
      - For the "errorRemarks", return a message if the text does not appear to be a CV; otherwise, set it to null.
      ${forTalentVaultInstruction}
      - Follow the JSON template strictly.
      - Return only the valid JSON output.
      - On every markdown content, just include the user's information and avoid additional unnecessary details such as the content title.
      - You MUST use dash (-) for bullet points in markdown.
      - DO NOT include \`\`\`json or \`\`\` around the response.
    `;
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const completion = await openai.responses.create({
    model: "gpt-5-nano",
    reasoning: { effort: "low" },
    input: [
      {
        role: "user",
        content: corePrompt,
      },
    ],
  });

  const extractedCv = completion.output_text;
  
  // Parse and log the extracted CV for debugging
  try {
    const cleaned = extractedCv.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsedCv = JSON.parse(cleaned);
    console.log("Extracted CV:", JSON.stringify(parsedCv, null, 2));
  } catch (error) {
    console.log("Raw extracted CV (failed to parse):", extractedCv);
    console.error("Error parsing extracted CV:", error);
  }

  return NextResponse.json({
    result: extractedCv,
  });
});
