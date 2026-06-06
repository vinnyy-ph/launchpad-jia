import { draftKey, parseDraft, serializeDraft } from "../profileDraft";

describe("profileDraft", () => {
  it("keys per email, falls back to anon", () => {
    expect(draftKey("a@b.com")).toBe("manual-profile-draft:v1:a@b.com");
    expect(draftKey("")).toBe("manual-profile-draft:v1:anon");
    expect(draftKey(undefined)).toBe("manual-profile-draft:v1:anon");
  });

  it("round-trips data + stepIndex + savedAt", () => {
    const raw = serializeDraft({ a: 1 }, 3, 1000);
    expect(parseDraft<{ a: number }>(raw)).toEqual({
      data: { a: 1 },
      stepIndex: 3,
      savedAt: 1000,
    });
  });

  it("returns null for empty or invalid input", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("")).toBeNull();
    expect(parseDraft("not json")).toBeNull();
    expect(parseDraft(JSON.stringify({ nope: true }))).toBeNull();
  });
});
