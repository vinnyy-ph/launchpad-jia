"use client"
import Footer from "@/lib/PageComponent/Footer";
import HomeNavBar from "@/lib/PageComponent/HomeNavBar";
import { useMobileMenu } from "@/lib/hooks/useMobileMenu";

export default function DeveloperPage() {
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
                <h1 style={{ fontSize: "36px", fontWeight: 700, color: "#111111" }}>Terms of Service</h1>

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
                <div style={{ 
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
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Introduction</h2>
            <p>Jia provides the Customer with access to Jia's Software as a Service ("SaaS") platform for recruitment and human resources management. The SaaS platform includes tools to manage the Customer's hiring process, employee onboarding and management, and storage of the Customer's recruitment and employment data ("Services").</p>
            
            <p>Jia provides the Services on a subscription basis, as specified in the applicable Order Form or on the Website and subject to the terms and conditions of this Agreement. The start of the Customer's Subscription Term is the date the Customer registers online to use the Services and accepts this Agreement, or the date of execution of an Order Form ("Effective Date"). The Customer may purchase additional Services during its Subscription Term by executing a new Order Form or purchasing them through the Website.</p>
            
            <p>The Company may update or modify this Agreement at any time without prior notice. Your continued use of the Website or Services after such changes constitutes acceptance of the revised Agreement. We encourage you to review this Agreement regularly.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Use of Website and Services</h2>
            <p>You acknowledge and agree that by signing up online to use the Services, on behalf of a nominated company or organization ("Customer"), you agree that the company or organization will be bound by these terms. You represent and warrant that you have full capacity and authority to enter into this Agreement on behalf of the Customer.</p>
            
            <p>You agree to comply with this Agreement and any policies the Company may provide in connection with your use of the Website and Services.</p>
            
            <p>You may only use the Website and Services as permitted by law and Company policies. The Company may suspend or terminate your access if you violate this Agreement, its policies, or if misuse is suspected.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Cookies</h2>
            <p>The Website and Services use cookies to improve functionality and provide a tailored experience. Cookies are small data files that track, save, and store information when you use the Website or Services.</p>
            
            <ul>
                <li style="font-size: 16px; font-weight: 400; color: #181D27;">Session cookies may be used to enable certain features, monitor usage, and understand how you interact with the Website.</li>
                <li style="font-size: 16px; font-weight: 400; color: #181D27;">Persistent cookies may save your login details to make future access easier.</li>
            </ul>
            
            <p>You may block cookies in your browser settings, but doing so may limit functionality of the Website and Services.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Intellectual Property</h2>
            <p>All content, trademarks, and logos within the Website and Services are owned by the Company or its licensors. No rights are granted to you except as expressly permitted by the Company or applicable law.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Privacy and Data Protection</h2>
            <p>The Company takes reasonable measures to protect your privacy when you use the Website and Services. Our Privacy Policy explains how we collect, use, and safeguard information. By using the Website and Services, you agree to the Privacy Policy.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Consent to Process Personal Information</h2>
            <p>By using our Website, Products, and Services, you consent to the collection, use, retention, disclosure, and processing of your personal information for purposes including, but not limited to:</p>
            
            <ul>
                <li style="font-size: 16px; font-weight: 400; color: #181D27;">Providing and improving the Company's products and services</li>
                <li style="font-size: 16px; font-weight: 400; color: #181D27;">Facilitating transactions</li>
                <li style="font-size: 16px; font-weight: 400; color: #181D27;">Availing of third-party products and services</li>
                <li style="font-size: 16px; font-weight: 400; color: #181D27;">Communicating relevant product updates, advisories, and promotions</li>
                <li style="font-size: 16px; font-weight: 400; color: #181D27;">Enhancing customer experience and developing new services</li>
                <li style="font-size: 16px; font-weight: 400; color: #181D27;">Meeting safety, security, and legal requirements</li>
                <li style="font-size: 16px; font-weight: 400; color: #181D27;">Statistical, analytical, and research purposes</li>
                <li style="font-size: 16px; font-weight: 400; color: #181D27;">Identifying and preventing misuse of the platform</li>
            </ul>
            
            <p>You are responsible for obtaining necessary consent from your employees, referrals, or other individuals whose personal data you share with the Company.</p>
            
            <p>Your personal information may also be disclosed to third-party service providers engaged by the Company for the purposes above.</p>
            
            <p>You have the right to request correction or removal of inaccurate or irrelevant personal information.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Opt-Out or Correction</h2>
            <p>You may opt out of marketing messages at any time by clicking "unsubscribe" in emails, notifying the Company via SMS, or emailing us directly. Unless you opt out, we will continue sending product updates and announcements.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Your Jia Account</h2>
            <p>Some features may require creating an account. You must provide accurate, updated information and keep your login credentials secure. You are responsible for all activities under your account, even if unauthorized. Notify the Company immediately of any suspected unauthorized use or security breach.</p>
            
            <p>Failure to comply may result in suspension or termination of your account.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Content You Provide</h2>
            <p>The Services may allow you to upload, store, and share files. You are responsible for maintaining and protecting this content. The Company will not be liable for data loss, corruption, or incorrect information provided by you.</p>
            
            <p>You are advised to use secure, encrypted connections when transmitting files to the Company.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Modifications to the Website and Services</h2>
            <p>The Company may add, remove, or change features of the Website and Services at any time. If a service is discontinued, we will, where reasonably possible, notify you in advance and give you an opportunity to retrieve your data.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Links to Other Sites</h2>
            <p>This Agreement applies only to this Website and Services. External links are provided for convenience only, and the Company does not guarantee, endorse, or assume responsibility for third-party content. Access to such sites is at your own risk.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Social Media Features</h2>
            <p>The Website and Services may include social media features (e.g., "Like" buttons) and widgets that may collect data such as your IP address and browsing activity. Your use of these features is governed by the policies of the third-party providers.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Public Information</h2>
            <p>The Website may allow you to post comments, feedback, or other information. You are prohibited from posting unlawful, defamatory, obscene, or otherwise inappropriate content. The Company reserves the right to cooperate with authorities and disclose identities of users who post prohibited material.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Warranties</h2>
            <p>The Company makes no warranties of any kind regarding the Website, Services, or their content. They are provided "as is" without guarantees of accuracy, completeness, timeliness, or freedom from viruses or harmful code.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">Limitation of Liability</h2>
            <p>Use of the Website and Services is at your own risk. The Company, its officers, and employees shall not be liable for any direct, indirect, incidental, or consequential damages arising from your use of or inability to use the Website or Services.</p>
            
            <p>The Company is not responsible for your compliance with labor laws, employment regulations, or other applicable legal requirements.</p>
            
            <p>If liability is found despite this limitation, it shall not exceed the amount you paid to the Company for use of the Services.</p>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #181D27;">About this Agreement</h2>
            <p>This Agreement constitutes the entire understanding between you and the Company regarding use of the Website and Services, unless a separate written agreement exists. In case of conflict, the written agreement prevails.</p>
            
            <p>If any provision is found invalid or unenforceable, the remaining terms will remain in effect. Failure of the Company to enforce any provision does not waive its rights.</p>
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