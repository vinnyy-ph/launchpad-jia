jest.mock("axios");
jest.mock("@/lib/Utils", () => ({ CORE_API_URL: "http://core.test" }));
jest.mock("@/lib/utils/apiClient", () => ({ api: { post: jest.fn() } }));

import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import { parseCvFile } from "../parseCvFile";

const mockedAxiosPost = axios.post as jest.Mock;
const mockedApiPost = api.post as jest.Mock;

function makeFile() {
  return new File(["pdf-bytes"], "cv.pdf", { type: "application/pdf" });
}

describe("parseCvFile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls upload-cv then autofill-cv and returns the parsed object", async () => {
    mockedAxiosPost.mockResolvedValue({ data: { cvChunks: ["chunk-a"] } });
    mockedApiPost.mockResolvedValue({
      data: { result: JSON.stringify({ name: "Jane Doe", structuredCV: { skills: ["React"] } }) },
    });

    const result = await parseCvFile(makeFile(), "jane@example.com");

    expect(mockedAxiosPost).toHaveBeenCalledWith(
      "http://core.test/upload-cv",
      expect.any(FormData),
    );
    expect(mockedApiPost).toHaveBeenCalledWith("/api/whitecloak/autofill-cv", {
      chunks: ["chunk-a"],
    });
    expect(result.name).toBe("Jane Doe");
    expect(result.structuredCV.skills).toEqual(["React"]);
  });

  it("throws when the upload service returns no cvChunks", async () => {
    mockedAxiosPost.mockResolvedValue({ data: {} });
    await expect(parseCvFile(makeFile(), "j@x.com")).rejects.toThrow(
      "Invalid response from upload service",
    );
  });

  it("throws when the digitalization result has no structuredCV", async () => {
    mockedAxiosPost.mockResolvedValue({ data: { cvChunks: ["c"] } });
    mockedApiPost.mockResolvedValue({ data: { result: JSON.stringify({ name: "X" }) } });
    await expect(parseCvFile(makeFile(), "j@x.com")).rejects.toThrow(
      "Invalid digitalization result structure",
    );
  });
});
