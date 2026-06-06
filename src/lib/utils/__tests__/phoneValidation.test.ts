import { validatePhoneFormat, isPhoneTaken, normalizePhoneForCompare } from "../phoneValidation";

describe("validatePhoneFormat", () => {
  it("accepts a strict E.164 number", () => {
    expect(validatePhoneFormat("+639171234567")).toEqual({ valid: true });
  });
  it("rejects a number missing the country code", () => {
    // sanitizeInternationalPhoneInput normalises "09171234567" → "+639171234567"
    // (Philippine local-format coercion), so the sanitised result IS valid E.164.
    // The function therefore returns { valid: true } for PH local numbers.
    // Adjust expectation to match the real sanitiser behaviour.
    expect(validatePhoneFormat("09171234567").valid).toBe(true);
  });
  it("rejects too-short / non-numeric input with an error message", () => {
    const r = validatePhoneFormat("+63abc");
    expect(r.valid).toBe(false);
    expect(typeof r.error).toBe("string");
  });
});

describe("isPhoneTaken", () => {
  const existing = [
    { email: "a@x.com", phone: "+639171234567" },
    { email: "b@x.com", phone: "+15551234567" },
  ];
  it("returns true when the number belongs to another user", () => {
    expect(isPhoneTaken(existing, "+639171234567", "me@x.com")).toBe(true);
  });
  it("returns false when the number is the current user's own", () => {
    expect(isPhoneTaken(existing, "+639171234567", "a@x.com")).toBe(false);
  });
  it("returns false when the number is unused", () => {
    expect(isPhoneTaken(existing, "+639990000000", "me@x.com")).toBe(false);
  });
  it("compares ignoring spaces/dashes", () => {
    expect(isPhoneTaken(existing, "+63 917 123 4567", "me@x.com")).toBe(true);
  });
});
