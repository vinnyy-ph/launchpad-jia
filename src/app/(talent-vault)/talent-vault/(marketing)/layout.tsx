"use client";

import "../../styles/tv.marketing.scss";
import { MarketingNavbar } from "../../components/MarketingNavbar";
import { MarketingFooter } from "../../components/MarketingFooter";
import TalentVaultAuthProvider, { useTalentVaultAuth } from "../../context/TalentVaultAuthContext";
import SignInModal from "../../components/SignInModal";
import { usePathname } from "next/navigation";

const normalizeDomain = (domain: string) => {
  let normalizedDomain = domain.trim();

  if (normalizedDomain.startsWith("https://")) {
    normalizedDomain = normalizedDomain.slice("https://".length);
  } else if (normalizedDomain.startsWith("http://")) {
    normalizedDomain = normalizedDomain.slice("http://".length);
  }

  const firstSlashIndex = normalizedDomain.indexOf("/");
  if (firstSlashIndex >= 0) {
    normalizedDomain = normalizedDomain.slice(0, firstSlashIndex);
  }

  while (normalizedDomain.endsWith("/")) {
    normalizedDomain = normalizedDomain.slice(0, -1);
  }

  return normalizedDomain;
};

const getTalentVaultHost = (domain: string) => {
  const normalizedDomain = normalizeDomain(domain);

  if (!normalizedDomain) {
    return "";
  }

  return normalizedDomain.startsWith("talentvault.")
    ? normalizedDomain
    : `talentvault.${normalizedDomain}`;
};

const isHostMatch = (host: string, expectedHost: string) => {
  if (!host || !expectedHost) {
    return false;
  }

  return host === expectedHost || host.startsWith(`${expectedHost}:`);
};

export default function LandingPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <TalentVaultAuthProvider>
      <SignInModalWrapper />
      <div style={{ position: 'relative', isolation: 'isolate' }}>
        <MarketingNavbar />

        <div>{children}</div>

        <MarketingFooter />
      </div>
    </TalentVaultAuthProvider>
  );
}

function SignInModalWrapper() {
  const { modalType, setModalType } = useTalentVaultAuth();
  const pathname = usePathname();
  const applicantAppDomain = process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN || "";
  const currentHost = typeof window !== "undefined" ? window.location.host : "";
  const applicantTalentVaultHost = getTalentVaultHost(applicantAppDomain);
  const isTalentVaultApplicantRoot = pathname === "/" && isHostMatch(currentHost, applicantTalentVaultHost);
  const isStudentsPortal = pathname.startsWith("/talent-vault/students") || isTalentVaultApplicantRoot;
  const variant = isStudentsPortal ? "student" : "employer";

  return (
    <SignInModal
      isOpen={modalType === "signIn"}
      onClose={() => setModalType(null)}
      variant={variant}
    />
  );
}
