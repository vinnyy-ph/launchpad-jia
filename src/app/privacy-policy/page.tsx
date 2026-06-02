"use client"
import Footer from "@/lib/PageComponent/Footer";
import HomeNavBar from "@/lib/PageComponent/HomeNavBar";
import { useMobileMenu } from "@/lib/hooks/useMobileMenu";

export default function PrivacyPolicyPage() {
  const { isStickyMobileMenu } = useMobileMenu();

    return (
      <>
        <main
        className="landing-page-container"
      >
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
            <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: "100%" }}>
                <h1 style={{ fontSize: "36px", fontWeight: 700, color: "#111111" }}>Privacy Policy</h1>

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
                    backgroundColor: "#FFFFFF", 
                    color: "#414651",
                    borderRadius: "60px",
                    cursor: "pointer",
                    transition: "all 0.3s ease"
                    }}
                    onClick={() => {}}
                >
                    <span style={{ fontSize: 12, color: "#414651", fontWeight: 500 }}>Privacy Policy</span>
                </div>
                <div style={{ 
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
                <div style={{ 
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
                        window.location.href = "/security-disclosure-policy";
                    }}
                >
                    <span style={{ fontSize: 12, fontWeight: 500 }}>Security Disclosure</span>
                </div>
            </div>
            </div>
            <div dangerouslySetInnerHTML={{ __html: `
            <p><strong style="font-size: 16px; font-weight: 700; color: #181D27;">Jia</strong> is committed to protecting your data's privacy and security. We ensure that all personal data is processed in accordance with R.A. 10173, the Data Privacy Act of 2012.</p>
            
            <p>By using our Services, you consent to the collection and processing of your personal data, and you accept the policies and practices set out in this Privacy Policy. You retain the right to object to the processing of your personal data for purposes related to direct marketing.</p>
            
            <p>We use appropriate and reasonable measures to keep your personal data confidential and secure. All collected data shall be retained, with reasonable measures, for up to one (1) year after the termination of your agreement with us, or for as long as necessary to fulfill the purposes for which it was collected, or as required to comply with legal obligations, resolve disputes, and enforce agreements.</p>
            
            <p>We may update or amend this Privacy Policy from time to time to comply with regulatory requirements, align with industry best practices, or for other business-related purposes.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;"><strong>Information Collected</strong></h2>
            <p>The Company may collect, store, and transfer the following information when you attend our events, use the Website, or access the Services:</p>
            
            <ul>
                <li><strong>Attendees, participants, and guests</strong> – When you attend or register for events organized or participated in by the Company, we may request personal information (such as name, phone number, email, employer details, and addresses) to send notifications, updates, and related event or service information.</li>
                <li><strong>Visitor and user-provided information</strong> – Upon registration or use of the Website and Services, we may collect information such as your name, phone number, email, billing details, and addresses.</li>
                <li><strong>Employer-provided information</strong> – Employers may use the Services to store employee information such as status, benefits, and contact details. This information is encrypted and only accessible by designated administrators.</li>
                <li><strong>Employment files and documents</strong> – When engaged by an employer, the Company may process employment-related files such as resumes, government IDs, permits, contracts, diplomas, transcripts, notices, and other employment records. Users and administrators control upload and access.</li>
            </ul>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;"><strong>Use and Purpose of Collected Data</strong></h2>
            <p>You consent that your personal information may be used to:</p>
            
            <ul>
                <li>Provide and improve the Company's products and services</li>
                <li>Facilitate transactions</li>
                <li>Avail of third-party products and services</li>
                <li>Communicate relevant products, advisories, and updates</li>
                <li>Enhance customer experience and develop new services</li>
                <li>Comply with safety, security, public service, or legal requirements</li>
                <li>Conduct statistical, analytical, and research purposes</li>
                <li>Detect and prevent misuse of the platform</li>
            </ul>
            
            <p>As necessary, the Company may share your information internally, with affiliates, partners, or contracted service providers, in accordance with this Privacy Policy.</p>
            
            <p>The Company does not sell, trade, or transfer your information to third parties without your consent. However, trusted third-party providers may be engaged to help operate the Website and Services, and will be required to protect your information. Non-personally identifiable data (such as gender, preferences, and general usage logs) may also be shared for marketing, analytics, or lawful purposes.</p>
            
            <p>The Company may collect and analyze aggregated, anonymized data to improve the Services and may disclose such data in de-identified form for lawful business purposes.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Communication</h2>
            <p>The Company may communicate with you via email, phone, SMS, or other channels you provide. You may unsubscribe at any time by clicking the "unsubscribe" link in emails or notifying us via SMS or email. Note: service-related messages (e.g., subscription or system updates) will still be sent.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Employment Information and Files</h2>
            <p>Employment files are controlled by users and administrators. The Company does not access or use them except:</p>
            
            <ol>
                <li>When instructed by users or administrators</li>
                <li>In encrypted or anonymized form</li>
                <li>As part of aggregated reports without personal identifiers</li>
            </ol>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Analytics</h2>
            <p>The Company and contracted third parties may collect usage data such as IP addresses, access logs, and cookies for monitoring, improving, and securing the Services.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Compliance</h2>
            <p>The Company may disclose your information if required by law, to enforce policies, or to protect its rights, employees, and users.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Accessing Your Information</h2>
            <p>You have the right to access, correct, or request removal of your personal information by contacting us at info@jia.ph. Withdrawal of consent may affect our ability to provide services to you.</p>
            
            <p>We will not entertain repetitive or abusive requests and will respond within a reasonable timeframe.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Data Retention</h2>
            <p>Information may be retained for up to thirty (30) days after termination of your agreement, or longer if required by law. Backups may continue to hold residual data, but reasonable steps will be taken to delete or anonymize data upon request.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Security</h2>
            <p>The Company applies technical and organizational safeguards to protect personal data against loss, misuse, or unauthorized access. However, no system is fully secure, and we encourage you to take care when transmitting sensitive information.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Children's Privacy</h2>
            <p>The Website and Services are not intended for children under thirteen (13). The Company does not knowingly collect personal data from children. If we become aware that a child under 13 has submitted personal information, we will take steps to delete it.</p>
            ` 
            }} />
            </div>
        </div>
      </main>
      {/* Footer */}
      <Footer />
      </>
    )
}