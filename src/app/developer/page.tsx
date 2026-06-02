"use client"
import Image from "next/image";
import Footer from "@/lib/PageComponent/Footer";
import HomeNavBar from "@/lib/PageComponent/HomeNavBar";
import { useMobileMenu } from "@/lib/hooks/useMobileMenu";

export default function DeveloperPage() {
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
            minHeight: "calc(100dvh + 80px)",
            backgroundImage: "url('/section-1-background.svg')",
            backgroundSize: "cover",
            backgroundColor: "#FFFFFF",
            boxSizing: "border-box",
          }}
        >
        <HomeNavBar isStickyMobileMenu={isStickyMobileMenu} />

        {/* Developer Section */}
        <div className="developer-section">
            <div className="developer-section-left">
              <h1 className="header">Developer</h1>
              <Image className="white-cloak-logo" src="https://www.whitecloak.com/wp-content/uploads/2024/02/logo.svg" alt="White Cloak Logo" width={162} height={50} />
              <p>
              Established in 2014, White Cloak Technologies Inc. has grown to be a trusted pillar in software development from the heart of the Philippines. As a preferred innovation partner, we've collaborated with prominent corporations, converting challenges into success stories through adept technology applications.
              <br/>
              <br/>
              Beyond Jia, White Cloak has also developed other AI-powered applications, including <a href="https://splurge.art" target="_blank" rel="noopener noreferrer">Splurge Art</a>, an AI art generator, and <a href="https://www.hellopixie.ai/" target="_blank" rel="noopener noreferrer">Pixie</a>, an AI chatbot builder for SMEs and enterprises.
              </p>
              <div style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 16,
                justifyContent: "flex-start",
                width: "100%",
                height: "100%",
              }}>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  textAlign: "left",
                }}>
                  <h1>200+</h1>
                  <p>Engineers</p>
                </div>

                {/* White line */}
                <div style={{
                  width: "1px",
                  height: "100%",
                  minHeight: "100px",
                  backgroundColor: "white",
                  margin: "0 24px",
                }}></div>

                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  textAlign: "left",
                }}>
                  <h1>100+</h1>
                  <p>Projects Delivered</p>
                </div>
              </div>
            </div>

            <div className="developer-section-right">
            <Image src="/wc-logo-black.png" alt="White Cloak Logo" width={300} height={300} style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }} />
          </div>
          </div>
        </div>
      </main>
      {/* Footer */}
      <Footer />
      </>
    )
}