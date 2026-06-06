import { composeAddress, createEmptyAddressParts } from "../addressFormat";

describe("composeAddress", () => {
  it("joins all parts in order with comma-space", () => {
    expect(
      composeAddress({
        street: "123 Street",
        city: "Pasig City",
        province: "Metro Manila",
        postal: "1600",
        country: "Philippines",
      }),
    ).toBe("123 Street, Pasig City, Metro Manila, 1600, Philippines");
  });

  it("skips empty parts", () => {
    expect(
      composeAddress({
        street: "123 Street",
        city: "Pasig City",
        province: "",
        postal: "",
        country: "Philippines",
      }),
    ).toBe("123 Street, Pasig City, Philippines");
  });

  it("trims whitespace around parts", () => {
    expect(
      composeAddress({
        street: "  123 Street ",
        city: " Pasig City",
        province: "",
        postal: "",
        country: "Philippines ",
      }),
    ).toBe("123 Street, Pasig City, Philippines");
  });

  it("returns empty string when all parts are empty", () => {
    expect(composeAddress(createEmptyAddressParts())).toBe("");
  });
});
