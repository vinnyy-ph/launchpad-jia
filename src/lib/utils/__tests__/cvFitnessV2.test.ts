import {
  hasStructuredQualifications,
  deriveLegacyDescription,
  summarizeBuckets,
  filterQualificationsByTab,
  parseStructuredAnalysis,
  buildStructuredScreeningPrompt,
  StructuredCareerDescription,
  QualificationResult,
} from "../cvFitnessV2";

const structured: StructuredCareerDescription = {
  overview: "<p>Lead design.</p>",
  rolesAndResponsibilities: "<p>Own the design system.</p>",
  requiredQualifications: ["5+ years UX", "Figma expertise"],
  preferredQualifications: ["Agile experience"],
};

const quals: QualificationResult[] = [
  { type: "required", text: "5+ years UX", status: "matched", evidence: "6 yrs" },
  { type: "required", text: "Figma expertise", status: "missing", evidence: "none" },
  { type: "preferred", text: "Agile experience", status: "partial", evidence: "some" },
];

describe("hasStructuredQualifications", () => {
  it("is false for a legacy career (no structuredDescription)", () => {
    expect(hasStructuredQualifications({ description: "<p>old</p>" })).toBe(false);
  });
  it("is false when structuredDescription has no qualifications", () => {
    expect(
      hasStructuredQualifications({
        structuredDescription: { overview: "x", rolesAndResponsibilities: "", requiredQualifications: [], preferredQualifications: [] },
      })
    ).toBe(false);
  });
  it("is true when at least one qualification exists", () => {
    expect(hasStructuredQualifications({ structuredDescription: structured })).toBe(true);
  });
});

describe("deriveLegacyDescription", () => {
  it("includes every section heading and qualification text", () => {
    const html = deriveLegacyDescription(structured);
    expect(html).toContain("Overview");
    expect(html).toContain("Lead design.");
    expect(html).toContain("Roles and Responsibilities");
    expect(html).toContain("Required Qualifications");
    expect(html).toContain("5+ years UX");
    expect(html).toContain("Figma expertise");
    expect(html).toContain("Preferred Qualifications");
    expect(html).toContain("Agile experience");
  });
  it("omits empty sections", () => {
    const html = deriveLegacyDescription({ overview: "<p>Only this.</p>", rolesAndResponsibilities: "", requiredQualifications: [], preferredQualifications: [] });
    expect(html).toContain("Only this.");
    expect(html).not.toContain("Required Qualifications");
  });
});

describe("summarizeBuckets", () => {
  it("counts matched/total per type and total missing", () => {
    expect(summarizeBuckets(quals)).toEqual({
      requiredMatched: 1,
      requiredTotal: 2,
      preferredMatched: 0,
      preferredTotal: 1,
      missingCount: 1,
    });
  });
  it("handles an empty list", () => {
    expect(summarizeBuckets([])).toEqual({
      requiredMatched: 0, requiredTotal: 0, preferredMatched: 0, preferredTotal: 0, missingCount: 0,
    });
  });
});

describe("filterQualificationsByTab", () => {
  it("returns all on the 'all' tab", () => {
    expect(filterQualificationsByTab(quals, "all")).toHaveLength(3);
  });
  it("filters by status", () => {
    expect(filterQualificationsByTab(quals, "missing")).toEqual([quals[1]]);
    expect(filterQualificationsByTab(quals, "partial")).toEqual([quals[2]]);
  });
});

describe("parseStructuredAnalysis", () => {
  it("parses fenced JSON and coerces status/type vocabulary", () => {
    const raw = "```json\n" + JSON.stringify({
      matchScore: 87,
      overallFit: "Strong Fit",
      summary: "Great fit.",
      qualifications: [
        { type: "Required", text: "A", status: "Matched", evidence: "yes" },
        { type: "preferred", text: "B", status: "Partially Matched", evidence: "kinda" },
        { type: "required", text: "C", status: "Missing", evidence: "no" },
      ],
    }) + "\n```";
    const result = parseStructuredAnalysis(raw, 1000);
    expect(result.matchScore).toBe(87);
    expect(result.overallFit).toBe("Strong Fit");
    expect(result.generatedAt).toBe(1000);
    expect(result.qualifications).toEqual([
      { type: "required", text: "A", status: "matched", evidence: "yes" },
      { type: "preferred", text: "B", status: "partial", evidence: "kinda" },
      { type: "required", text: "C", status: "missing", evidence: "no" },
    ]);
  });
  it("clamps matchScore to 0..100", () => {
    const raw = JSON.stringify({ matchScore: 250, overallFit: "x", summary: "y", qualifications: [] });
    expect(parseStructuredAnalysis(raw, 0).matchScore).toBe(100);
  });
  it("throws on malformed JSON", () => {
    expect(() => parseStructuredAnalysis("not json", 0)).toThrow();
  });
});

describe("buildStructuredScreeningPrompt", () => {
  it("includes every qualification, the CV text, and the bucket vocabulary", () => {
    const prompt = buildStructuredScreeningPrompt(structured, "CANDIDATE CV TEXT", "Jane Doe", "", "BASE PROMPT");
    expect(prompt).toContain("5+ years UX");
    expect(prompt).toContain("Figma expertise");
    expect(prompt).toContain("Agile experience");
    expect(prompt).toContain("CANDIDATE CV TEXT");
    expect(prompt).toContain("matched");
    expect(prompt).toContain("partial");
    expect(prompt).toContain("missing");
  });
});
