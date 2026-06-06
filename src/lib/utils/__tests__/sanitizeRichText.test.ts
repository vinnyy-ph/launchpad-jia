import { sanitizeRichText } from "../sanitizeRichText";

describe("sanitizeRichText", () => {
  it("keeps basic formatting tags", () => {
    expect(sanitizeRichText("<b>hi</b> <i>there</i>")).toBe("<b>hi</b> <i>there</i>");
    expect(sanitizeRichText("<ul><li>a</li><li>b</li></ul>")).toBe(
      "<ul><li>a</li><li>b</li></ul>",
    );
  });

  it("strips attributes from allowed tags", () => {
    expect(sanitizeRichText('<b onclick="evil()">hi</b>')).toBe("<b>hi</b>");
  });

  it("removes scripts and disallowed tags (keeping inner text)", () => {
    expect(sanitizeRichText("<script>alert(1)</script>")).toBe("alert(1)");
    expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).toBe("x");
    expect(sanitizeRichText('<img src=x onerror=alert(1)>')).toBe("");
  });

  it("returns an empty string for empty input", () => {
    expect(sanitizeRichText("")).toBe("");
  });
});
