import axios from "axios";
import { CORE_API_URL } from "@/lib/Utils";
import { api } from "@/lib/utils/apiClient";
import type { StructuredCV } from "./structuredCV";

// Shape returned by /api/whitecloak/autofill-cv (top-level name/email/phone/location
// are siblings of structuredCV; see autofill-cv/route.ts template). structuredCV is
// raw here — cvToWizardData normalizes it via normalizeStructuredCVInput.
export interface ParsedCv {
  structuredCV: StructuredCV;
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  digitalCV?: unknown;
}

// Reuse the exact pipeline UploadCV.handleFileSubmit uses: extract chunks via the
// core service, then structure them via autofill-cv. Throws with the same messages
// so callers can surface a single "couldn't read that CV" error.
export async function parseCvFile(file: File, userEmail: string): Promise<ParsedCv> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("fName", file.name);
  formData.append("userEmail", userEmail);

  const uploadResponse = await axios.post(`${CORE_API_URL}/upload-cv`, formData);
  if (!uploadResponse.data?.cvChunks) {
    throw new Error("Invalid response from upload service");
  }

  const digitalizeResponse = await api.post("/api/whitecloak/autofill-cv", {
    chunks: uploadResponse.data.cvChunks,
  });

  const result = digitalizeResponse.data?.result;
  if (!result) {
    throw new Error("No result from digitalization service");
  }

  let parsed: unknown;
  try {
    parsed = typeof result === "string" ? JSON.parse(result) : result;
  } catch {
    throw new Error("Invalid digitalization result structure");
  }

  if (!parsed || typeof parsed !== "object" || !(parsed as { structuredCV?: unknown }).structuredCV) {
    throw new Error("Invalid digitalization result structure");
  }

  return parsed as ParsedCv;
}
