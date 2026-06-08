import {
  buildBrandfetchLogoUrl,
  buildFaviconUrl,
  buildLogoDevUrl,
  buildLogoUrl,
  normalizeDomain,
} from "../logoUrls";

const KEY = "NEXT_PUBLIC_LOGODEV_PUBLISHABLE_KEY";

function restoreKey(original: string | undefined) {
  if (original === undefined) delete process.env[KEY];
  else process.env[KEY] = original;
}

describe("normalizeDomain", () => {
  it("strips protocol, www, path and lowercases", () => {
    expect(normalizeDomain("https://www.Google.com/about")).toBe("google.com");
    expect(normalizeDomain("  HTTP://Example.COM ")).toBe("example.com");
    expect(normalizeDomain("ateneo.edu")).toBe("ateneo.edu");
  });
});

describe("buildLogoDevUrl", () => {
  const original = process.env[KEY];
  afterEach(() => restoreKey(original));

  it("returns empty when no key is configured", () => {
    delete process.env[KEY];
    expect(buildLogoDevUrl("google.com", "webp")).toBe("");
  });

  it("returns empty when no domain", () => {
    process.env[KEY] = "pk_test";
    expect(buildLogoDevUrl("", "webp")).toBe("");
  });

  it("builds an img.logo.dev url with token, size and format", () => {
    process.env[KEY] = "pk_test";
    const url = buildLogoDevUrl("Google.com", "png");
    expect(url).toContain("https://img.logo.dev/google.com?");
    expect(url).toContain("token=pk_test");
    expect(url).toContain("format=png");
    expect(url).toContain("size=40");
  });
});

describe("buildBrandfetchLogoUrl", () => {
  it("builds a cdn.brandfetch.io url with a client id", () => {
    const url = buildBrandfetchLogoUrl("Microsoft.com");
    expect(url).toContain("https://cdn.brandfetch.io/microsoft.com/w/80/h/80?c=");
  });

  it("returns empty for no domain", () => {
    expect(buildBrandfetchLogoUrl("")).toBe("");
  });
});

describe("buildLogoUrl", () => {
  const original = process.env[KEY];
  afterEach(() => restoreKey(original));

  it("prefers logo.dev when a key is present", () => {
    process.env[KEY] = "pk_test";
    expect(buildLogoUrl("google.com", "webp")).toContain("img.logo.dev");
  });

  it("falls back to Brandfetch when no logo.dev key", () => {
    delete process.env[KEY];
    expect(buildLogoUrl("google.com", "webp")).toContain("cdn.brandfetch.io");
  });
});

describe("buildFaviconUrl", () => {
  it("builds a google s2 favicon url", () => {
    expect(buildFaviconUrl("google.com")).toBe(
      "https://www.google.com/s2/favicons?domain=google.com&sz=64",
    );
  });

  it("returns empty for no domain", () => {
    expect(buildFaviconUrl("")).toBe("");
  });
});
