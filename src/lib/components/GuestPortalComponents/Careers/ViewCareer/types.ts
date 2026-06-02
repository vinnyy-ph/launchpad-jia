export type BaseFitStatusKey = "Good fit" | "Maybe fit" | "Bad fit" | "Retake" | "Strong fit";

export interface FitStatusStyle {
  bgColor: string;
  borderColor: string;
  textColor: string;
}

export interface FitStatusConfig extends FitStatusStyle {
  /**
   * Stable value key that can be used in APIs / filters
   */
  value: string;
  /**
   * Human readable label
   */
  text: string;
}

export const FIT_STATUS_MAP: Record<BaseFitStatusKey, FitStatusConfig> = {
  "Good fit": {
    value: "good-fit",
    text: "Good fit",
    bgColor: "rgba(239, 248, 255, 1)",
    borderColor: "rgba(178, 221, 255, 1)",
    textColor: "rgba(23, 92, 211, 1)",
  },
  "Maybe fit": {
    value: "maybe-fit",
    text: "Maybe fit",
    bgColor: "rgba(248, 249, 252, 1)",
    borderColor: "rgba(213, 217, 235, 1)",
    textColor: "rgba(54, 63, 114, 1)",
  },
  "Bad fit": {
    value: "bad-fit",
    text: "Bad fit",
    bgColor: "rgba(254, 243, 242, 1)",
    borderColor: "rgba(254, 205, 202, 1)",
    textColor: "rgba(179, 35, 24, 1)",
  },
  Retake: {
    value: "retake",
    text: "Retake",
    bgColor: "rgba(255, 250, 235, 1)",
    borderColor: "rgba(254, 223, 137, 1)",
    textColor: "rgba(181, 71, 8, 1)",
  },
  "Strong fit": {
    value: "strong-fit",
    text: "Strong fit",
    bgColor: "rgba(236, 253, 243, 1)",
    borderColor: "rgba(166, 244, 197, 1)",
    textColor: "rgba(2, 121, 72, 1)",
  },
};

export function getBaseFitStatus(fitTag?: string | null): BaseFitStatusKey | null {
  if (!fitTag) return null;

  const lower = fitTag.toLowerCase();

  if (lower.includes("strong fit")) return "Strong fit";
  if (lower.includes("good fit")) return "Good fit";
  if (lower.includes("maybe fit")) return "Maybe fit";
  if (lower.includes("bad fit")) return "Bad fit";
  if (lower.includes("retake")) return "Retake";

  return null;
}

