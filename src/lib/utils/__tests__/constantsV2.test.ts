const APPLICANT_KEY = "NEXT_PUBLIC_APPLICANT_APP_DOMAIN";
const EMPLOYER_KEY = "NEXT_PUBLIC_EMPLOYER_APP_DOMAIN";

/**
 * pathConstants is computed at module load from env vars, so each scenario
 * sets the env and re-requires the module with a fresh module registry.
 */
function loadPathConstants(applicantDomain?: string, employerDomain?: string) {
  const prevApplicant = process.env[APPLICANT_KEY];
  const prevEmployer = process.env[EMPLOYER_KEY];

  if (applicantDomain === undefined) delete process.env[APPLICANT_KEY];
  else process.env[APPLICANT_KEY] = applicantDomain;
  if (employerDomain === undefined) delete process.env[EMPLOYER_KEY];
  else process.env[EMPLOYER_KEY] = employerDomain;

  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { pathConstants } = require("../constantsV2");

  if (prevApplicant === undefined) delete process.env[APPLICANT_KEY];
  else process.env[APPLICANT_KEY] = prevApplicant;
  if (prevEmployer === undefined) delete process.env[EMPLOYER_KEY];
  else process.env[EMPLOYER_KEY] = prevEmployer;

  return pathConstants;
}

describe("pathConstants portal URL derivation", () => {
  it("falls back to the legacy production domains when env vars are unset", () => {
    const pc = loadPathConstants(undefined, undefined);
    expect(pc.employee).toBe("https://www.hellojia.ai");
    expect(pc.employer).toBe("https://www.hirejia.ai");
    expect(pc.employerLanding).toBe("/");
  });

  it("keeps the bare employer URL on multi-domain deploys", () => {
    const pc = loadPathConstants("hellojia.ai", "hirejia.ai");
    expect(pc.employee).toBe("https://hellojia.ai");
    expect(pc.employer).toBe("https://hirejia.ai");
    expect(pc.employerLanding).toBe("/");
  });

  it("points the employer landing at /employers on single-domain deploys", () => {
    const domain = "launchpad-jia-tan.vercel.app";
    const pc = loadPathConstants(domain, domain);
    expect(pc.employee).toBe(`https://${domain}`);
    expect(pc.employer).toBe(`https://${domain}/employers`);
    expect(pc.employerLanding).toBe("/employers");
  });

  it("uses http for localhost domains", () => {
    const pc = loadPathConstants("localhost:3000", "localhost:3000");
    expect(pc.employee).toBe("http://localhost:3000");
    expect(pc.employer).toBe("http://localhost:3000/employers");
    expect(pc.employerLanding).toBe("/employers");
  });

  it("keeps the static path constants intact", () => {
    const pc = loadPathConstants(undefined, undefined);
    expect(pc.home).toBe("/");
    expect(pc.jobOpenings).toBe("/job-openings");
    expect(pc.dashboard).toBe("/dashboard");
    expect(pc.whitecloak).toBe("https://www.whitecloak.com");
  });
});
