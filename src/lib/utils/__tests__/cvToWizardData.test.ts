import { cvToWizardData } from "../cvToWizardData";
import type { ParsedCv } from "../parseCvFile";

function parsed(overrides: Record<string, unknown> = {}): ParsedCv {
  return {
    name: "Maria Clara Santos",
    email: "top@level.com",
    structuredCV: {
      introduction: "Engineer.",
      contactInfo: {
        email: "maria@cv.com",
        phone: "+639171234567",
        isPhoneVerified: true,
        countryCode: "",
        address: "Cebu City",
        linkedin: "https://linkedin.com/in/maria",
        websites: [{ id: "w1", url: "https://maria.dev", type: "Website" }],
      },
      experience: [{ id: "e1", title: "Dev", company: "Acme" }],
      skills: ["React", "TypeScript"],
      education: [{ school: "UP" }],
      projects: [],
      certifications: [],
      awards: [],
      ...(overrides.structuredCV as object),
    },
    ...overrides,
  } as unknown as ParsedCv;
}

describe("cvToWizardData", () => {
  it("splits a 3-part name into first / middle-initial / last", () => {
    const d = cvToWizardData(parsed());
    expect(d.contact.firstName).toBe("Maria");
    expect(d.contact.middleInitial).toBe("C");
    expect(d.contact.lastName).toBe("Santos");
  });

  it("splits two- and one-token names", () => {
    expect(cvToWizardData(parsed({ name: "John Doe" })).contact).toMatchObject({
      firstName: "John",
      middleInitial: "",
      lastName: "Doe",
    });
    expect(cvToWizardData(parsed({ name: "Cher" })).contact).toMatchObject({
      firstName: "Cher",
      middleInitial: "",
      lastName: "",
    });
  });

  it("prefers contactInfo fields and never trusts parsed phone verification", () => {
    const d = cvToWizardData(parsed());
    expect(d.contact.email).toBe("maria@cv.com");
    expect(d.contact.phone).toBe("+639171234567");
    expect(d.contact.address).toBe("Cebu City");
    expect(d.contact.isPhoneVerified).toBe(false);
  });

  it("folds linkedin into the websites list as a Linkedin entry", () => {
    const d = cvToWizardData(parsed());
    const linkedin = d.websites.find((w) => w.type === "Linkedin");
    expect(linkedin?.url).toBe("https://linkedin.com/in/maria");
    expect(linkedin?.id).toBeTruthy();
    expect(d.websites.some((w) => w.url === "https://maria.dev")).toBe(true);
  });

  it("maps arrays and assigns ids, keeping skills and introduction", () => {
    const d = cvToWizardData(parsed());
    expect(d.experience).toHaveLength(1);
    expect(d.experience[0].id).toBeTruthy();
    expect(d.experience[0].title).toBe("Dev");
    expect(d.education[0].school).toBe("UP");
    expect(d.skills).toEqual(["React", "TypeScript"]);
    expect(d.introduction).toBe("Engineer.");
  });

  it("falls back to one blank entry for empty/absent sections", () => {
    const d = cvToWizardData(parsed());
    expect(d.projects).toHaveLength(1);
    expect(d.certifications).toHaveLength(1);
    expect(d.awards).toHaveLength(1);
    expect(d.references).toHaveLength(1); // never emitted by the parser
  });

  it("handles a completely empty parse without throwing", () => {
    const empty = { name: "", structuredCV: {} } as unknown as ParsedCv;
    const d = cvToWizardData(empty);
    expect(d.contact.firstName).toBe("");
    expect(d.skills).toEqual([]);
    expect(d.education).toHaveLength(1);
  });
});
