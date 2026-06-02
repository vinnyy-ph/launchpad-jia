"use client"
import Footer from "@/lib/PageComponent/Footer";
import HomeNavBar from "@/lib/PageComponent/HomeNavBar";
import React from "react";
import { useMobileMenu } from "@/lib/hooks/useMobileMenu";

export default function SecurityDisclosurePolicy() {
  const { isStickyMobileMenu } = useMobileMenu();

  return (
    <>
      <main className="landing-page-container">
        <div 
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            backgroundImage: "url('/section-1-background.svg')",
            backgroundSize: "cover",
            backgroundColor: "#FFFFFF",
          }}
        >
          <HomeNavBar isStickyMobileMenu={isStickyMobileMenu} />
          
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: "1200px", width: "100%", padding: "0 20px", margin: "0 auto", marginTop: "100px", marginBottom: "100px" }}>
            <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: "100%", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
              <h1 style={{ fontSize: "clamp(28px, 4vw, 36px)", fontWeight: 700, color: "#111111" }}>Security Disclosure Guidelines</h1>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: "row", height: "44px", maxWidth: "450px", width: "100%", backgroundColor: "#EAECF5", borderRadius: "60px", padding: "5px"}}>
                <div
                  style={{ 
                    display:"flex",
                    flexDirection: "row", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    gap: 8, 
                    flex: 1,
                    height: "100%", 
                    backgroundColor: "#EAECF5", 
                    color: "#717680",
                    borderRadius: "60px",
                    cursor: "pointer",
                    transition: "all 0.3s ease"
                  }}
                  onClick={() => {
                    window.location.href = "/privacy-policy";
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 500 }}>Privacy Policy</span>
                </div>
                <div 
                  style={{ 
                    display:"flex",
                    flexDirection: "row", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    gap: 8, 
                    flex: 1,
                    height: "100%", 
                    backgroundColor: "#EAECF5", 
                    color: "#717680",
                    borderRadius: "60px",
                    cursor: "pointer",
                    transition: "all 0.3s ease"
                  }}
                  onClick={() => {
                    window.location.href = "/terms-of-service";
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 500 }}>Terms of Service</span>
                </div>
                <div 
                  style={{ 
                    display:"flex",
                    flexDirection: "row", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    gap: 8, 
                    flex: 1,
                    height: "100%", 
                    backgroundColor: "#FFFFFF", 
                    color: "#414651",
                    borderRadius: "60px",
                    cursor: "pointer",
                    transition: "all 0.3s ease"
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 500 }}>Security Disclosure</span>
                </div>
              </div>
            </div>

            <div className="policy-content" style={{ color: "#475467", fontSize: "16px", lineHeight: 1.6, marginTop: "40px" }}>
              <p style={{ marginBottom: "24px" }}>
                <strong style={{ color: "#181D27" }}>Jia</strong> (the “Platform”), a job‑seeking platform developed and operated by White Cloak Technologies, Inc. (“White Cloak”, “WC”, “we”), is committed to maintaining the security, confidentiality, and integrity of its products, services, and data. We recognize and appreciate the efforts of security researchers, ethical hackers, and members of the public who help identify potential security vulnerabilities.
              </p>
              <p style={{ marginBottom: "40px" }}>
                These Security Disclosure Guidelines describe how vulnerabilities related to Jia should be reported and how such reports are handled under our Vulnerability Disclosure Program (VDP).
              </p>

              <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#181D27", marginBottom: "16px", marginTop: "40px" }}>Scope</h2>
              <p style={{ marginBottom: "16px" }}>
                These guidelines apply exclusively to Jia and cover all digital assets directly owned or managed by White Cloak in support of the Platform, including but not limited to:
              </p>
              <ul style={{ marginBottom: "24px", paddingLeft: "24px" }}>
                <li>Jia web applications</li>
                <li>Jia APIs and backend services</li>
                <li>Supporting infrastructure directly related to Jia</li>
              </ul>
              <p style={{ marginBottom: "40px" }}>
                Assets or systems not associated with Jia, as well as third‑party services integrated with the Platform, are outside the scope of these guidelines.
              </p>

              <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#181D27", marginBottom: "16px", marginTop: "40px" }}>Reporting Process</h2>
              <p style={{ marginBottom: "16px" }}>
                White Cloak manages the Jia Vulnerability Disclosure Program internally through its Information Security (InfoSec) team.
              </p>
              <p style={{ marginBottom: "16px" }}>
                If you believe you have discovered a security vulnerability affecting Jia, please report it by emailing:
              </p>
              <p style={{ marginBottom: "24px", fontWeight: 700, color: "#9525C9" }}>
                <a href="mailto:security@whitecloak.com" style={{ color: "inherit", textDecoration: "underline" }}>security@whitecloak.com</a>
              </p>
              <p style={{ marginBottom: "16px" }}>
                To help us assess and respond efficiently, please include the following information in your report:
              </p>
              <ul style={{ marginBottom: "24px", paddingLeft: "24px" }}>
                <li>A clear description of the vulnerability</li>
                <li>Affected asset(s) or component(s)</li>
                <li>Steps to reproduce the issue</li>
                <li>Proof‑of‑concept (if available and safe to provide)</li>
                <li>Potential impact or risk assessment</li>
                <li>Your contact information (optional but recommended)</li>
              </ul>
              <p style={{ marginBottom: "40px" }}>
                By submitting a vulnerability report, you agree to comply with these Security Disclosure Guidelines and to follow responsible disclosure practices.
              </p>

              <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#181D27", marginBottom: "16px", marginTop: "40px" }}>Expectations from Researchers</h2>
              <p style={{ marginBottom: "16px" }}>
                We ask security researchers and ethical hackers to conduct their activities responsibly and ethically. Specifically, we expect that you will:
              </p>
              <ul style={{ marginBottom: "24px", paddingLeft: "24px" }}>
                <li>Respect the privacy of Jia users and refrain from accessing, modifying, or exfiltrating personal or confidential data</li>
                <li>Avoid actions that may degrade system performance, disrupt services, or affect platform availability</li>
                <li>Use only accounts, systems, and data that you own or have explicit permission to use</li>
                <li>Comply with all applicable local and international laws and regulations</li>
                <li>Refrain from publicly disclosing vulnerability details until White Cloak has confirmed that the issue has been resolved or disclosure has been approved</li>
              </ul>

              <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#181D27", marginBottom: "16px", marginTop: "40px" }}>What Researchers Can Expect from Us</h2>
              <p style={{ marginBottom: "16px" }}>
                When a valid vulnerability report is submitted in accordance with these guidelines, White Cloak will:
              </p>
              <ul style={{ marginBottom: "24px", paddingLeft: "24px" }}>
                <li>Acknowledge receipt of the report in a timely manner</li>
                <li>Assess, validate, and prioritize the reported issue based on risk and potential impact</li>
                <li>Communicate updates on the status of the vulnerability as appropriate</li>
                <li>Coordinate with the reporter if additional information or clarification is required</li>
                <li>Provide recognition for the contribution, where applicable, after the vulnerability has been remediated</li>
              </ul>

              <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#181D27", marginBottom: "16px", marginTop: "40px" }}>Safe Harbor</h2>
              <p style={{ marginBottom: "40px" }}>
                White Cloak considers activities conducted in good faith and in accordance with these guidelines to be authorized. We will not pursue legal action against researchers for compliant vulnerability research, provided that no harm is caused to users, data, or services.
              </p>

              <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#181D27", marginBottom: "16px", marginTop: "40px" }}>Changes to These Guidelines</h2>
              <p style={{ marginBottom: "40px" }}>
                White Cloak may update these Security Disclosure Guidelines from time to time. The most current version will always apply at the time a vulnerability is reported.
              </p>

              <p style={{ fontWeight: 600, color: "#181D27" }}>
                We appreciate your efforts in helping keep Jia secure.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
