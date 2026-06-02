import { superAdminList } from "@/lib/SuperAdminUtils";

export const getTVRootURL = (portal: "employer" | "applicant") => {
  const applicantDomain = process.env.NEXT_PUBLIC_TV_APPLICANT_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_TV_APPLICANT_DOMAIN}`
    : "http://localhost:3000/talent-vault/students";

  const employerDomain = process.env.NEXT_PUBLIC_TV_EMPLOYER_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_TV_EMPLOYER_DOMAIN}`
    : "http://localhost:3000/talent-vault";

  return portal === "employer" ? employerDomain : applicantDomain;
}

export function formatExactDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

export function isTalentVaultEnabled(email: string): boolean {
  return superAdminList.includes(email);
}
