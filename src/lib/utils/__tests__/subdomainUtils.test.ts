import { extractSubdomain, isValidSubdomain } from "../subdomainUtils";

const ENV_KEY = "NEXT_PUBLIC_APPLICANT_APP_DOMAIN";

describe("extractSubdomain", () => {
  const originalEnv = process.env[ENV_KEY];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalEnv;
    }
  });

  it("returns null for an empty hostname", () => {
    expect(extractSubdomain("")).toBeNull();
  });

  describe("localhost hosts", () => {
    it("returns null for bare localhost", () => {
      expect(extractSubdomain("localhost:3000")).toBeNull();
    });
    it("extracts an org subdomain of localhost", () => {
      expect(extractSubdomain("acme.localhost:3000")).toBe("acme");
    });
    it("returns null for reserved subdomains of localhost", () => {
      expect(extractSubdomain("www.localhost:3000")).toBeNull();
    });
  });

  describe("base domain guards", () => {
    it("returns null when no base domain is configured", () => {
      process.env[ENV_KEY] = "";
      expect(extractSubdomain("acme.hellojia.ai")).toBeNull();
    });

    it("returns null when the host IS the base domain (multi-part deployment domain)", () => {
      // Regression: "launchpad-jia-tan" used to be misread as an org
      // subdomain of vercel.app, hijacking "/" to /job-openings.
      process.env[ENV_KEY] = "launchpad-jia-tan.vercel.app";
      expect(extractSubdomain("launchpad-jia-tan.vercel.app")).toBeNull();
    });

    it("ignores ports when comparing host to base domain", () => {
      process.env[ENV_KEY] = "launchpad-jia-tan.vercel.app";
      expect(extractSubdomain("launchpad-jia-tan.vercel.app:443")).toBeNull();
    });
  });

  describe("production two-part base domain", () => {
    beforeEach(() => {
      process.env[ENV_KEY] = "hellojia.ai";
    });

    it("returns null for the bare base domain", () => {
      expect(extractSubdomain("hellojia.ai")).toBeNull();
    });
    it("extracts an org subdomain", () => {
      expect(extractSubdomain("acme.hellojia.ai")).toBe("acme");
    });
    it("returns null for reserved subdomains", () => {
      expect(extractSubdomain("www.hellojia.ai")).toBeNull();
      expect(extractSubdomain("talentvault.hellojia.ai")).toBeNull();
    });
    it("returns null for hosts outside the base domain", () => {
      expect(extractSubdomain("example.com")).toBeNull();
    });
  });
});

describe("isValidSubdomain", () => {
  it("accepts a simple lowercase slug", () => {
    expect(isValidSubdomain("acme")).toBe(true);
  });
  it("accepts hyphenated slugs", () => {
    expect(isValidSubdomain("acme-corp")).toBe(true);
  });
  it("rejects empty and too-short values", () => {
    expect(isValidSubdomain("")).toBe(false);
    expect(isValidSubdomain("ab")).toBe(false);
  });
  it("rejects invalid characters and edge hyphens", () => {
    expect(isValidSubdomain("Acme")).toBe(false);
    expect(isValidSubdomain("acme_corp")).toBe(false);
    expect(isValidSubdomain("-acme")).toBe(false);
    expect(isValidSubdomain("acme-")).toBe(false);
  });
  it("rejects values longer than 50 characters", () => {
    expect(isValidSubdomain("a".repeat(51))).toBe(false);
  });
});
