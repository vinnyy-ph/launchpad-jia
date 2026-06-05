import { normalizeStructuredCVInput, type ReferenceSectionItem } from "../structuredCV";

describe("structuredCV references (T5)", () => {
  it("preserves a references array through normalize (round-trip)", () => {
    const ref: ReferenceSectionItem = {
      id: "r1", name: "Jane Cruz", email: "jane@x.com", phone: "+639171234567",
      countryCode: "PH", company: "Acme", position: "Manager", relation: "Former boss",
    };
    const result = normalizeStructuredCVInput({ references: [ref] });
    expect(result.references).toEqual([ref]);
  });

  it("defaults references to [] for documents lacking the field (back-compat)", () => {
    const result = normalizeStructuredCVInput({ introduction: "hi" });
    expect(result.references).toEqual([]);
  });

  it("drops malformed reference entries and coerces missing optionals to ''", () => {
    const result = normalizeStructuredCVInput({
      references: [{ name: "Bob" }, "garbage", null],
    });
    expect(result.references).toEqual([
      { id: expect.any(String), name: "Bob", email: "", phone: "", countryCode: "", company: "", position: "", relation: "" },
    ]);
  });
});
