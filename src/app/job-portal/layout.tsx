import "@/lib/styles/commonV2/globals.scss";
import ContextV2 from "@/lib/context/ContextV2";
import { headers } from "next/headers";
import type { Metadata } from "next";

const DOMAIN_META: Record<
  string,
  { title: string; description: string; canonical: string; googleSiteVerification: string | null }
> = {
  "hirejia.ai": {
    title: "JIA | AI-Powered End-to-End Hiring Tool",
    description:
      "Modernize your hiring process with cutting-edge AI. Automate pre-screening and candidate communication in real-time. Eliminate manual tracking and generate real-time insights for faster and better hiring.",
    canonical: "https://www.hirejia.ai",
    googleSiteVerification: "R4CIt6mG4Ofcnj8TWv-euGJlmJvn5HvBWh2xhjycsag",
  },
  "hellojia.ai": {
    title: "Jia | A Smarter Job Portal for New Opportunities",
    description:
      "Discover job openings, urgent hiring roles, and apply online easily. Jia is a premier job portal that connects you with top-tier roles while ensuring the entire application process is faster, more transparent, and simply better.",
    canonical: "https://www.hellojia.ai",
    googleSiteVerification: "2TCCazSZp1om__8ccPbJvMuE-E8upD0rrIQnxw29_u0",
  },
};

const DEFAULT_META = DOMAIN_META["hellojia.ai"];

function resolveDomainMeta(host: string) {
  for (const domain of Object.keys(DOMAIN_META)) {
    if (host === domain || host.endsWith(`.${domain}`)) {
      return DOMAIN_META[domain];
    }
  }
  return DEFAULT_META;
}

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const host = (headersList.get("host") || "").replace(/:\d+$/, "");
  const meta = resolveDomainMeta(host);

  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: meta.canonical },
    ...(meta.googleSiteVerification
      ? { verification: { google: meta.googleSiteVerification } }
      : {}),
  };
}

export default function ({ children }) {
  return <ContextV2>{children}</ContextV2>;
}
