import {
  assembleStructuredCV,
  INITIAL_SECTION_STATUS,
  nextSectionStatus,
  sanitizeSectionStatus,
  STEP_SECTION,
  type ProfileSectionStatus,
  type WizardData,
} from "../assembleProfile";
import type { ContactStepValue } from "@/lib/components/ManualProfile/ContactInformationStep";
import type { ContactWebsite, ExperienceSectionItem } from "@/lib/utils/structuredCV";

// NOTE: full wizard→Submit integration (drive a Skip, assert the section drops from
// the store-cv payload) is intentionally not unit-tested here — assembleStructuredCV
// plus the STEP_SECTION / nextSectionStatus wiring below cover the logic without
// rendering the wizard. When an e2e harness for the wizard is added, also assert
// skipped-section drops on Submit.

const contact: ContactStepValue = {
  firstName: "K",
  lastName: "Y",
  middleInitial: "S",
  email: "k@example.com",
  phone: "+639175703210",
  isPhoneVerified: false,
  address: "Manila",
  addressManual: false,
  addressParts: { street: "", city: "", province: "", postal: "", country: "" },
};

function exp(over: Partial<ExperienceSectionItem> = {}): ExperienceSectionItem {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Engineer",
    company: "Google",
    companyDomain: "",
    companyLogoUrl: "",
    employmentType: "",
    location: "",
    workSetup: "",
    startDate: { month: "January", year: "2020" },
    endDate: { month: "January", year: "2022" },
    isCurrentRole: false,
    description: "",
    ...over,
  };
}
const validExp = () => exp();
const partialExp = () => exp({ company: "", endDate: { month: "", year: "" } }); // title only, missing company + end
const blankExp = () =>
  exp({ title: "", company: "", startDate: { month: "", year: "" }, endDate: { month: "", year: "" } });

function baseData(over: Partial<WizardData> = {}): WizardData {
  return {
    contact,
    websites: [],
    education: [],
    experience: [],
    skills: ["TS"],
    projects: [],
    certifications: [],
    awards: [],
    references: [],
    introduction: "Hi",
    ...over,
  };
}

// Default every section to "submitted" so the validator filter is what's exercised.
function status(over: Partial<ProfileSectionStatus> = {}): ProfileSectionStatus {
  return {
    websites: "submitted",
    education: "submitted",
    experience: "submitted",
    projects: "submitted",
    certifications: "submitted",
    awards: "submitted",
    references: "submitted",
    ...over,
  };
}

describe("assembleStructuredCV", () => {
  it("drops a skipped section even when its entries are valid", () => {
    const cv = assembleStructuredCV(
      baseData({ experience: [validExp()] }),
      status({ experience: "skipped" }),
    );
    expect(cv.experience).toEqual([]);
  });

  it("untouched + valid → kept; untouched + partial → dropped (validator backstop)", () => {
    expect(
      assembleStructuredCV(baseData({ experience: [validExp()] }), status({ experience: "untouched" }))
        .experience,
    ).toHaveLength(1);
    expect(
      assembleStructuredCV(baseData({ experience: [partialExp()] }), status({ experience: "untouched" }))
        .experience,
    ).toEqual([]);
  });

  it("submitted section with mixed entries keeps only the fully-valid one", () => {
    const cv = assembleStructuredCV(
      baseData({ experience: [validExp(), partialExp(), blankExp()] }),
      status(),
    );
    expect(cv.experience).toHaveLength(1);
    expect(cv.experience[0].title).toBe("Engineer");
    expect(cv.experience[0].company).toBe("Google");
  });

  it("websites: blank dropped, invalid-url dropped, valid kept (+ linkedin)", () => {
    const websites: ContactWebsite[] = [
      { id: "1", url: "", type: "Personal" },
      { id: "2", url: "notaurl", type: "Blog" },
      { id: "3", url: "www.linkedin.com/in/x", type: "Linkedin" },
    ];
    const cv = assembleStructuredCV(baseData({ websites }), status());
    expect(cv.contactInfo.websites).toHaveLength(1);
    expect(cv.contactInfo.websites[0].url).toBe("www.linkedin.com/in/x");
    expect(cv.contactInfo.linkedin).toBe("www.linkedin.com/in/x");
  });

  it("passes contact / skills / introduction through untouched", () => {
    const cv = assembleStructuredCV(baseData(), status());
    expect(cv.contactInfo.email).toBe("k@example.com");
    expect(cv.skills).toEqual(["TS"]);
    expect(cv.introduction).toBe("Hi");
  });

  it("INITIAL_SECTION_STATUS is all untouched", () => {
    expect(Object.values(INITIAL_SECTION_STATUS).every((s) => s === "untouched")).toBe(true);
  });
});

describe("STEP_SECTION mapping", () => {
  it("maps the multi-entry steps to their sections (off-by-one guard)", () => {
    expect(STEP_SECTION).toEqual({
      1: "websites",
      2: "education",
      3: "experience",
      5: "projects",
      6: "certifications",
      7: "awards",
      8: "references",
    });
  });
});

describe("nextSectionStatus", () => {
  const base = INITIAL_SECTION_STATUS;

  it("submit → submitted, skip → skipped, enter → untouched for the step's section", () => {
    expect(nextSectionStatus(base, 3, "submit").experience).toBe("submitted");
    expect(nextSectionStatus(base, 3, "skip").experience).toBe("skipped");
    const skipped = nextSectionStatus(base, 3, "skip");
    expect(nextSectionStatus(skipped, 3, "enter").experience).toBe("untouched");
  });

  it("only touches the step's own section", () => {
    const after = nextSectionStatus(base, 3, "skip");
    expect(after.projects).toBe("untouched");
    expect(after.websites).toBe("untouched");
  });

  it("is a no-op (same ref) for non-section steps (Contact/Skills/Intro)", () => {
    expect(nextSectionStatus(base, 0, "submit")).toBe(base);
    expect(nextSectionStatus(base, 4, "skip")).toBe(base);
    expect(nextSectionStatus(base, 9, "submit")).toBe(base);
  });
});

describe("sanitizeSectionStatus", () => {
  it("returns INITIAL for non-object input (legacy v1 drafts, garbage)", () => {
    expect(sanitizeSectionStatus(undefined)).toEqual(INITIAL_SECTION_STATUS);
    expect(sanitizeSectionStatus(null)).toEqual(INITIAL_SECTION_STATUS);
    expect(sanitizeSectionStatus("skipped")).toEqual(INITIAL_SECTION_STATUS);
    expect(sanitizeSectionStatus(42)).toEqual(INITIAL_SECTION_STATUS);
  });

  it("passes a fully valid map through unchanged", () => {
    const valid: ProfileSectionStatus = {
      ...INITIAL_SECTION_STATUS,
      experience: "skipped",
      projects: "submitted",
    };
    expect(sanitizeSectionStatus(valid)).toEqual(valid);
  });

  it("merges partial maps over INITIAL defaults", () => {
    expect(sanitizeSectionStatus({ awards: "skipped" })).toEqual({
      ...INITIAL_SECTION_STATUS,
      awards: "skipped",
    });
  });

  it("rejects invalid values per section and drops unknown keys", () => {
    const out = sanitizeSectionStatus({
      experience: "SKIPPED", // wrong case → invalid
      projects: 3,
      awards: "skipped",
      bogusSection: "skipped",
    });
    expect(out).toEqual({ ...INITIAL_SECTION_STATUS, awards: "skipped" });
    expect("bogusSection" in out).toBe(false);
  });
});
