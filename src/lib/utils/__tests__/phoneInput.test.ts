import { formatNationalNumber, maxNationalDigits } from "../phoneInput";

describe("formatNationalNumber", () => {
  it("groups PH numbers as 3-3-4", () => {
    expect(formatNationalNumber("9876543210", "PH")).toBe("987 654 3210");
  });

  it("groups US numbers as 3-3-4", () => {
    expect(formatNationalNumber("9876543210", "US")).toBe("987 654 3210");
  });

  it("groups SG numbers as 4-4", () => {
    expect(formatNationalNumber("91234567", "SG")).toBe("9123 4567");
  });

  it("groups AU numbers as 3-3-3", () => {
    expect(formatNationalNumber("412345678", "AU")).toBe("412 345 678");
  });

  it("groups UK numbers as 4-6", () => {
    expect(formatNationalNumber("7700900123", "UK")).toBe("7700 900123");
  });

  it("formats partial input progressively", () => {
    expect(formatNationalNumber("9", "PH")).toBe("9");
    expect(formatNationalNumber("987", "PH")).toBe("987");
    expect(formatNationalNumber("9876", "PH")).toBe("987 6");
    expect(formatNationalNumber("987654", "PH")).toBe("987 654");
  });

  it("caps digits at the country max", () => {
    expect(formatNationalNumber("98765432109999", "PH")).toBe("987 654 3210");
    expect(formatNationalNumber("9123456799", "SG")).toBe("9123 4567");
  });

  it("ignores non-digit characters", () => {
    expect(formatNationalNumber("987-654 3210", "PH")).toBe("987 654 3210");
  });

  it("returns an empty string for empty input", () => {
    expect(formatNationalNumber("", "PH")).toBe("");
  });
});

describe("maxNationalDigits", () => {
  it("returns the per-country maximum", () => {
    expect(maxNationalDigits("PH")).toBe(10);
    expect(maxNationalDigits("US")).toBe(10);
    expect(maxNationalDigits("SG")).toBe(8);
    expect(maxNationalDigits("AU")).toBe(9);
    expect(maxNationalDigits("UK")).toBe(10);
  });
});
