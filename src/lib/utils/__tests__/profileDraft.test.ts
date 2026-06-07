import { draftKey, parseDraft, serializeDraft } from "../profileDraft";

describe("profileDraft", () => {
  it("keys per email, falls back to anon", () => {
    expect(draftKey("a@b.com")).toBe("manual-profile-draft:v1:a@b.com");
    expect(draftKey("")).toBe("manual-profile-draft:v1:anon");
    expect(draftKey(undefined)).toBe("manual-profile-draft:v1:anon");
  });

  it("round-trips data + stepIndex + savedAt", () => {
    const raw = serializeDraft({ a: 1 }, 3, undefined, 1000);
    expect(parseDraft<{ a: number }>(raw)).toEqual({
      data: { a: 1 },
      stepIndex: 3,
      savedAt: 1000,
    });
  });

  it("round-trips sectionStatus when provided", () => {
    const status = { websites: "skipped", education: "submitted" };
    const raw = serializeDraft({ a: 1 }, 2, status, 1000);
    expect(parseDraft<{ a: number }>(raw)).toEqual({
      data: { a: 1 },
      stepIndex: 2,
      sectionStatus: status,
      savedAt: 1000,
    });
  });

  it("omits the sectionStatus key entirely when undefined (v1-shape parity)", () => {
    expect(serializeDraft({ a: 1 }, 0, undefined, 1000)).not.toContain("sectionStatus");
  });

  it("parses legacy drafts without sectionStatus", () => {
    const legacy = JSON.stringify({ data: { a: 1 }, stepIndex: 1, savedAt: 5 });
    const parsed = parseDraft<{ a: number }>(legacy);
    expect(parsed).not.toBeNull();
    expect(parsed?.sectionStatus).toBeUndefined();
  });

  it("returns null for empty or invalid input", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("")).toBeNull();
    expect(parseDraft("not json")).toBeNull();
    expect(parseDraft(JSON.stringify({ nope: true }))).toBeNull();
  });
});
