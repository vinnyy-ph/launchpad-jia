import {
  buildIntroductionPrompt,
  shapeIntroductionHtml,
  hasProfileContentForIntro,
} from "../introductionAI";
import type { StructuredCV, ExperienceSectionItem } from "../structuredCV";

function makeProfile(p: Partial<StructuredCV> = {}): StructuredCV {
  return {
    introduction: "",
    contactInfo: {
      email: "",
      phone: "",
      countryCode: "",
      address: "",
      linkedin: "",
      websites: [],
    },
    experience: [],
    skills: [],
    education: [],
    projects: [],
    certifications: [],
    awards: [],
    ...p,
  };
}

function exp(partial: Partial<ExperienceSectionItem>): ExperienceSectionItem {
  return {
    id: "e1",
    title: "",
    company: "",
    employmentType: "",
    location: "",
    workSetup: "",
    startDate: { month: "", year: "" },
    endDate: { month: "", year: "" },
    isCurrentRole: false,
    description: "",
    ...partial,
  };
}

describe("hasProfileContentForIntro", () => {
  it("is false for an empty profile", () => {
    expect(hasProfileContentForIntro(makeProfile())).toBe(false);
  });

  it("is true when any professional section has content", () => {
    expect(hasProfileContentForIntro(makeProfile({ skills: ["React"] }))).toBe(true);
  });
});

describe("buildIntroductionPrompt", () => {
  const prompt = buildIntroductionPrompt(
    makeProfile({
      experience: [exp({ title: "Senior Engineer", company: "Acme", description: "<p>Built apps</p>" })],
      skills: ["React", "TypeScript"],
    }),
  );

  it("includes filled sections with plain-text descriptions", () => {
    expect(prompt).toContain("Senior Engineer at Acme");
    expect(prompt).toContain("Built apps");
    expect(prompt).not.toContain("<p>");
    expect(prompt).toContain("React, TypeScript");
  });

  it("omits empty sections", () => {
    expect(prompt).not.toContain("Education:");
    expect(prompt).not.toContain("Awards:");
  });

  it("instructs first-person, single paragraph, no fabrication", () => {
    expect(prompt.toLowerCase()).toContain("first person");
    expect(prompt.toLowerCase()).toContain("do not invent");
  });
});

describe("shapeIntroductionHtml", () => {
  it("wraps a single paragraph and escapes HTML-special chars", () => {
    expect(shapeIntroductionHtml("Built <script> tools & things")).toBe(
      "<p>Built &lt;script&gt; tools &amp; things</p>",
    );
  });

  it("strips code fences and collapses newlines into one paragraph", () => {
    expect(shapeIntroductionHtml("```\nHello\nworld\n```")).toBe("<p>Hello world</p>");
  });

  it("strips surrounding quotes", () => {
    expect(shapeIntroductionHtml('"I am an engineer."')).toBe("<p>I am an engineer.</p>");
  });

  it("returns empty string for blank input", () => {
    expect(shapeIntroductionHtml("   ")).toBe("");
  });
});
