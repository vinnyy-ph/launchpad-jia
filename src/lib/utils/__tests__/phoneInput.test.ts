import {
  buildPhoneFromNationalInput,
  extractNationalNumber,
  formatNationalNumber,
  getDialCode,
  maxNationalDigits,
} from "../phoneInput";

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

describe("getDialCode", () => {
  it("returns the per-country dial code", () => {
    expect(getDialCode("PH")).toBe("+63");
    expect(getDialCode("US")).toBe("+1");
    expect(getDialCode("SG")).toBe("+65");
    expect(getDialCode("AU")).toBe("+61");
    expect(getDialCode("UK")).toBe("+44");
  });
});

// Pins the behaviour of the inline dial-code-splitting block these helpers
// replaced in ContactInformationStep / ManualPhoneVerifyModal / ReferenceEntryForm.
describe("extractNationalNumber", () => {
  it("strips the dial-code digits from an E.164 value", () => {
    expect(extractNationalNumber("+639876543210", "PH")).toBe("9876543210");
    expect(extractNationalNumber("+14155552671", "US")).toBe("4155552671");
  });

  it("ignores formatting characters", () => {
    expect(extractNationalNumber("+63 987 654 3210", "PH")).toBe("9876543210");
  });

  it("returns digits unchanged when the dial code is absent", () => {
    expect(extractNationalNumber("9876543210", "PH")).toBe("9876543210");
  });

  it("returns an empty string for empty input", () => {
    expect(extractNationalNumber("", "PH")).toBe("");
  });
});

describe("buildPhoneFromNationalInput", () => {
  it("prefixes the dial code and sanitises to E.164", () => {
    expect(buildPhoneFromNationalInput("987 654 3210", "PH")).toBe("+639876543210");
    expect(buildPhoneFromNationalInput("4155552671", "US")).toBe("+14155552671");
  });

  it("caps the national number at the country max", () => {
    expect(buildPhoneFromNationalInput("98765432109999", "PH")).toBe("+639876543210");
    expect(buildPhoneFromNationalInput("912345679999", "SG")).toBe("+6591234567");
  });

  it("round-trips with extractNationalNumber", () => {
    const phone = buildPhoneFromNationalInput("9876543210", "PH");
    expect(extractNationalNumber(phone, "PH")).toBe("9876543210");
  });

  it("returns the bare dial code for empty input", () => {
    // sanitizeInternationalPhoneInput receives just the dial code digits.
    expect(buildPhoneFromNationalInput("", "PH")).toBe("+63");
  });
});
