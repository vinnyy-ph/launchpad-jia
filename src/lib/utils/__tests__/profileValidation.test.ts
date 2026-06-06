import {
  compareDates,
  isValidEmail,
  isValidUrl,
  validateAwardItem,
  validateCertificationItem,
  validateContact,
  validateEducationItem,
  validateExperienceItem,
  validateIntroduction,
  validateProjectItem,
  validateReferenceItem,
  validateWebsite,
} from "../profileValidation";
import type { ContactStepValue } from "@/lib/components/ManualProfile/ContactInformationStep";
import type {
  AwardSectionItem,
  CertificationSectionItem,
  EducationSectionItem,
  ExperienceSectionItem,
  ProjectSectionItem,
  ReferenceSectionItem,
} from "@/lib/utils/structuredCV";

const validContact: ContactStepValue = {
  firstName: "Karina",
  lastName: "Yu",
  middleInitial: "S",
  email: "karina@example.com",
  phone: "+639175703210",
  isPhoneVerified: false,
  address: "Manila, Philippines",
  addressManual: false,
  addressParts: { street: "", city: "", province: "", postal: "", country: "" },
};

const validExperience: ExperienceSectionItem = {
  id: "1",
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
};

describe("primitives", () => {
  it("isValidEmail", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });

  it("isValidUrl accepts with/without scheme", () => {
    expect(isValidUrl("www.example.com")).toBe(true);
    expect(isValidUrl("https://example.com/x")).toBe(true);
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });

  it("compareDates orders by year then month, skips blanks", () => {
    expect(compareDates({ month: "January", year: "2020" }, { month: "January", year: "2022" })).toBe(-1);
    expect(compareDates({ month: "March", year: "2022" }, { month: "January", year: "2022" })).toBe(1);
    expect(compareDates({ month: "January", year: "2022" }, { month: "January", year: "2022" })).toBe(0);
    expect(compareDates({ month: "", year: "" }, { month: "January", year: "2022" })).toBe(0);
  });
});

describe("validateContact", () => {
  it("passes a fully valid contact", () => {
    expect(validateContact(validContact)).toEqual({});
  });
  it("flags every empty required field", () => {
    const e = validateContact({ ...validContact, firstName: "", lastName: " ", middleInitial: "" });
    expect(e.firstName).toBeDefined();
    expect(e.lastName).toBeDefined();
    expect(e.middleInitial).toBeDefined();
  });
  it("flags a malformed email", () => {
    expect(validateContact({ ...validContact, email: "bad" }).email).toBeDefined();
  });
  it("flags a malformed phone", () => {
    expect(validateContact({ ...validContact, phone: "123" }).phone).toBeDefined();
  });
  it("validates manual address parts when manual mode is on", () => {
    const e = validateContact({
      ...validContact,
      address: "",
      addressManual: true,
      addressParts: { street: "", city: "", province: "", postal: "", country: "" },
    });
    expect(e.street).toBeDefined();
    expect(e.city).toBeDefined();
    expect(e.country).toBeDefined();
    expect(e.address).toBeUndefined();
  });
});

describe("validateWebsite", () => {
  it("allows an empty url (optional)", () => {
    expect(validateWebsite({ id: "1", url: "", type: "" })).toEqual({});
  });
  it("flags a malformed url", () => {
    expect(validateWebsite({ id: "1", url: "foo bar", type: "" }).url).toBeDefined();
  });
});

describe("validateExperienceItem", () => {
  it("passes a valid item", () => {
    expect(validateExperienceItem(validExperience)).toEqual({});
  });
  it("flags missing title/company/start", () => {
    const e = validateExperienceItem({
      ...validExperience,
      title: "",
      company: "",
      startDate: { month: "", year: "" },
    });
    expect(e.title).toBeDefined();
    expect(e.company).toBeDefined();
    expect(e.startDate).toBeDefined();
  });
  it("flags end before start", () => {
    const e = validateExperienceItem({
      ...validExperience,
      endDate: { month: "January", year: "2019" },
    });
    expect(e.endDate).toBeDefined();
  });
  it("skips end date when currently working", () => {
    const e = validateExperienceItem({
      ...validExperience,
      isCurrentRole: true,
      endDate: { month: "", year: "" },
    });
    expect(e.endDate).toBeUndefined();
  });
});

describe("validateEducationItem", () => {
  const base: EducationSectionItem = {
    id: "1",
    school: "Ateneo",
    schoolDomain: "",
    schoolLogoUrl: "",
    degree: "",
    fieldOfStudy: "",
    startDate: { month: "January", year: "2018" },
    endDate: { month: "January", year: "2022" },
    description: "",
  };
  it("passes valid; flags empty school + reversed dates", () => {
    expect(validateEducationItem(base)).toEqual({});
    expect(validateEducationItem({ ...base, school: "" }).school).toBeDefined();
    expect(validateEducationItem({ ...base, endDate: { month: "January", year: "2017" } }).endDate).toBeDefined();
  });
});

describe("validateProjectItem", () => {
  const base: ProjectSectionItem = {
    id: "1",
    name: "App",
    isCurrent: false,
    startDate: { month: "January", year: "2021" },
    endDate: { month: "June", year: "2021" },
    description: "",
  };
  it("passes valid; flags name/start; end before start", () => {
    expect(validateProjectItem(base)).toEqual({});
    expect(validateProjectItem({ ...base, name: "" }).name).toBeDefined();
    expect(validateProjectItem({ ...base, startDate: { month: "", year: "" } }).startDate).toBeDefined();
    expect(validateProjectItem({ ...base, endDate: { month: "January", year: "2020" } }).endDate).toBeDefined();
  });
});

describe("validateCertificationItem", () => {
  const base: CertificationSectionItem = {
    id: "1",
    name: "AWS",
    issuingOrganization: "Amazon",
    issuingOrganizationDomain: "",
    issuingOrganizationLogoUrl: "",
    issueDate: { month: "January", year: "2021" },
    expirationDate: { month: "January", year: "2024" },
    credentialId: "",
    credentialUrl: "",
  };
  it("passes valid; flags name/org; bad url; exp before issue", () => {
    expect(validateCertificationItem(base)).toEqual({});
    expect(validateCertificationItem({ ...base, name: "", issuingOrganization: "" })).toEqual(
      expect.objectContaining({ name: expect.any(String), issuingOrganization: expect.any(String) }),
    );
    expect(validateCertificationItem({ ...base, credentialUrl: "bad url" }).credentialUrl).toBeDefined();
    expect(validateCertificationItem({ ...base, expirationDate: { month: "January", year: "2020" } }).expirationDate).toBeDefined();
  });
});

describe("validateAwardItem", () => {
  it("flags empty title", () => {
    const base: AwardSectionItem = {
      id: "1", title: "Best", issuer: "", issuerDomain: "", issuerLogoUrl: "",
      issueDate: { month: "", year: "" }, description: "",
    };
    expect(validateAwardItem(base)).toEqual({});
    expect(validateAwardItem({ ...base, title: "" }).title).toBeDefined();
  });
});

describe("validateReferenceItem", () => {
  const base: ReferenceSectionItem = {
    id: "1",
    name: "Bob",
    email: "bob@example.com",
    phone: "+639175703210",
    countryCode: "PH",
    company: "Acme",
    position: "CTO",
    relation: "",
  };
  it("passes valid; flags required + bad email/phone", () => {
    expect(validateReferenceItem(base)).toEqual({});
    const e = validateReferenceItem({ ...base, name: "", phone: "", company: "", position: "" });
    expect(e.name).toBeDefined();
    expect(e.phone).toBeDefined();
    expect(e.company).toBeDefined();
    expect(e.position).toBeDefined();
    expect(validateReferenceItem({ ...base, email: "bad" }).email).toBeDefined();
  });
});

describe("validateIntroduction", () => {
  it("flags empty", () => {
    expect(validateIntroduction("hi")).toEqual({});
    expect(validateIntroduction("   ").introduction).toBeDefined();
  });

  it("treats tag-only HTML as empty (required)", () => {
    expect(validateIntroduction("<p></p>").introduction).toBeTruthy();
  });

  it("accepts HTML with real text", () => {
    expect(validateIntroduction("<p>hi</p>").introduction).toBeUndefined();
  });
});
