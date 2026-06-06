import {
  assembleStructuredCV,
  INITIAL_SECTION_STATUS,
  type ProfileSectionStatus,
  type WizardData,
} from "../assembleProfile";
import type { ContactStepValue } from "@/lib/components/ManualProfile/ContactInformationStep";
import type { ContactWebsite, ExperienceSectionItem } from "@/lib/utils/structuredCV";

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
