"use client";

import { useState } from "react";
import { api } from "@/lib/utils/apiClient";
import type { StructuredCV } from "@/lib/utils/structuredCV";

const GENERIC_ERROR = "We couldn't generate an introduction. Please try again.";

// Owns the network call + transient state for "Generate Introduction".
// Returns the generated HTML on success, or null (with `error` set) on failure.
export function useGenerateIntroduction() {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(profile: StructuredCV): Promise<string | null> {
    setGenerating(true);
    setError(null);
    try {
      const res = await api.post("/api/whitecloak/generate-introduction", { profile });
      const introduction = res?.data?.introduction;
      if (typeof introduction !== "string" || !introduction.trim()) {
        setError(GENERIC_ERROR);
        return null;
      }
      return introduction;
    } catch {
      setError(GENERIC_ERROR);
      return null;
    } finally {
      setGenerating(false);
    }
  }

  function reset() {
    setError(null);
  }

  return { generating, error, generate, reset };
}
