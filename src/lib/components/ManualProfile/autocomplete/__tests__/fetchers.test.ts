import { searchAddresses, searchBrands, searchSchools } from "../fetchers";
import { api } from "@/lib/utils/apiClient";

jest.mock("@/lib/utils/apiClient", () => ({
  api: { get: jest.fn() },
}));

const mockGet = api.get as jest.Mock;

function signal() {
  return new AbortController().signal;
}

beforeEach(() => {
  mockGet.mockReset();
});

describe("searchBrands", () => {
  it("maps results and drops entries missing a name or domain", async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        results: [
          { name: "Google", domain: "google.com", logoUrl: "https://l/g" },
          { name: "", domain: "x.com" },
          { name: "NoDomain" },
        ],
      },
    });

    const out = await searchBrands("go", signal());
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      name: "Google",
      domain: "google.com",
      logoUrl: "https://l/g",
    });
    expect(out[0].key).toContain("google.com");
  });

  it("normalizes domains returned by the API", async () => {
    mockGet.mockResolvedValueOnce({
      data: { results: [{ name: "X", domain: "https://www.X.com/path" }] },
    });
    const out = await searchBrands("x", signal());
    expect(out[0].domain).toBe("x.com");
  });

  it("returns an empty list when results are missing", async () => {
    mockGet.mockResolvedValueOnce({ data: {} });
    expect(await searchBrands("go", signal())).toEqual([]);
  });
});

describe("searchSchools", () => {
  it("maps name/country/domain, builds a logo for entries with a domain", async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        results: [
          { name: "Ateneo", country: "Philippines", domain: "ateneo.edu" },
          { name: "No Domain School", country: "Philippines", domain: "" },
        ],
      },
    });

    const out = await searchSchools("at", signal());
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      name: "Ateneo",
      meta: "Philippines",
      domain: "ateneo.edu",
    });
    expect(out[0].logoUrl).toBeTruthy();
    expect(out[1].domain).toBe("");
    expect(out[1].logoUrl).toBe("");
  });

  it("calls the university-search endpoint with the query and abort signal", async () => {
    mockGet.mockResolvedValueOnce({ data: { results: [] } });
    await searchSchools("ate", signal());
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining("/api/talent-vault/university-search?q=ate"),
      expect.objectContaining({ signal: expect.anything() }),
    );
  });
});

describe("searchAddresses", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("maps Photon features to a joined displayName and drops empties", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        features: [
          {
            properties: { name: "Rizal Park", city: "Manila", country: "Philippines" },
            geometry: { coordinates: [121, 14] },
          },
          { properties: {} },
        ],
      }),
    }) as unknown as typeof fetch;

    const out = await searchAddresses("rizal", signal());
    expect(out).toHaveLength(1);
    expect(out[0].displayName).toBe("Rizal Park, Manila, Philippines");
    expect(out[0].id).toContain("0-");
  });

  it("returns an empty list when features are missing", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ json: async () => ({}) }) as unknown as typeof fetch;
    expect(await searchAddresses("x", signal())).toEqual([]);
  });

  it("hits the Photon endpoint with the query and abort signal", async () => {
    const mock = jest.fn().mockResolvedValue({ json: async () => ({ features: [] }) });
    global.fetch = mock as unknown as typeof fetch;
    await searchAddresses("manila", signal());
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining("photon.komoot.io/api/?q=manila"),
      expect.objectContaining({ signal: expect.anything() }),
    );
  });
});
