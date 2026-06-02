"use client";

import { usePathname } from 'next/navigation';
import { tvAssets } from "@/lib/utils/constantsV2";
import { Navbar } from './Navbar';
import Button from "./base/Button";
import { useTalentVaultAuth } from '../context/TalentVaultAuthContext';

export function MarketingNavbar() {
  const pathname = usePathname();
  const { setModalType, user } = useTalentVaultAuth();
  const employerAppDomain = process.env.NEXT_PUBLIC_EMPLOYER_APP_DOMAIN || "";
  const applicantAppDomain = process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN || "";

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

  const currentHost = typeof window !== "undefined" ? window.location.host : "";
  const employerTalentVaultHost = getTalentVaultHost(employerAppDomain);
  const applicantTalentVaultHost = getTalentVaultHost(applicantAppDomain);
  const isTalentVaultEmployerRoot = pathname === "/" && isHostMatch(currentHost, employerTalentVaultHost);
  const isTalentVaultApplicantRoot = pathname === "/" && isHostMatch(currentHost, applicantTalentVaultHost);

  const isStudentsPortal = pathname.startsWith('/talent-vault/students') || isTalentVaultApplicantRoot;
  const isEmployerPortal = pathname === '/talent-vault' || isTalentVaultEmployerRoot;

  const navItems = isStudentsPortal ? [
    { label: "How it works", href: "#how-it-works" },
    { label: "Why it works", href: "#why-it-works" },
    { label: "Why join", href: "#why-join" },
  ] : [
    { label: "How it works", href: "#how-it-works" },
    { label: "Results", href: "#results" },
    { label: "Why it works", href: "#why-it-works" },
  ];

  const getTalentVaultRootUrl = (domain: string, localPath: string) => {
    const normalizedDomain = normalizeDomain(domain);

    const isLocalDomain =
      normalizedDomain.includes("localhost") ||
      normalizedDomain.includes("127.0.0.1");

    if (!normalizedDomain || isLocalDomain) {
      return localPath;
    }

    const host = normalizedDomain.startsWith("talentvault.")
      ? normalizedDomain
      : `talentvault.${normalizedDomain}`;

    return `https://${host}`;
  };

  const employerRootURL = getTalentVaultRootUrl(employerAppDomain, "/talent-vault");
  const studentsRootURL = getTalentVaultRootUrl(applicantAppDomain, "/talent-vault/students");
  const rootURL = isStudentsPortal ? studentsRootURL : employerRootURL;

  return (
    <Navbar>
      <Navbar.Menu>
        <Navbar.Brand link={rootURL} src={tvAssets.tvLogo} alt="Jia Talent Vault logo" />
        <Navbar.Items>
          {navItems.map((item) => (
            <Navbar.Item key={item.href} href={item.href} label={item.label} />
          ))}
          <Navbar.Item href="#contact" label="Contact" />
        </Navbar.Items>
      </Navbar.Menu>
      <Navbar.Actions>
        <Button
          variant="secondary"
          size="large"
          onClick={() => {
            if (isStudentsPortal || isEmployerPortal) {
              setModalType("signIn");
            }
          }}
        >
          Login | Join Talent Vault
        </Button>
        {isStudentsPortal ?
          <a href={employerRootURL}>For Employers</a>
          : <a href={studentsRootURL}>For Students</a>}
      </Navbar.Actions>
    </Navbar>
  )
}
