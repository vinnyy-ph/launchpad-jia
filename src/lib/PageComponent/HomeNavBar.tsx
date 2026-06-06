"use client";
import Image from "next/image";
import { useState } from "react";
import {
  signInWithGoogle,
  signInWithMicrosoft,
} from "../firebase/firebaseClient";
import { assetConstants, pathConstants } from "@/lib/utils/constantsV2";
import styles from "@/lib/styles/commonV2/modal.module.scss";
import { TroubleshootingGuideModal } from "@/lib/components/commonV2/Modal";
import Button from "@/lib/components/ui/button/Button";

export default function HomeNavBar({
  isStickyMobileMenu,
}: {
  isStickyMobileMenu: boolean;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showTroubleshootingModal, setShowTroubleshootingModal] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
    const body = document.body;
    if (body) {
      body.style.overflow = isMobileMenuOpen ? "auto" : "hidden";
    }
  };

  const handleLoginClick = () => {
    const host = window.location.host;
    if (host.includes(process.env.NEXT_PUBLIC_EMPLOYER_APP_DOMAIN)) {
      if (localStorage.user) {
        if (localStorage.role === "admin") {
          window.location.href = "/recruiter-dashboard";
          return;
        }
      }
    }
    setShowLoginModal(true);
  };

  const handleSignInWithGoogle = () => {
    signInWithGoogle(undefined, {
      onPopupBlocked: () => setPopupBlocked(true),
    });
  };

  const handleSignInWithMicrosoft = () => {
    signInWithMicrosoft(undefined, {
      onPopupBlocked: () => setPopupBlocked(true),
    });
  };

  const handleCloseLoginModal = () => {
    setShowLoginModal(false);
    setPopupBlocked(false);
  };
  return (
    <>
      <nav className={`home-navbar ${isStickyMobileMenu ? "sticky" : ""}`}>
        <div className="navbar-container">
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <div className="hamburger-menu" onClick={toggleMobileMenu}>
              <i
                className="la la-bars"
                style={{ fontSize: 42, color: "black" }}
              ></i>
            </div>
            {isMobileMenuOpen && (
              <div className="mobile-menu">
                <div className="mobile-menu-container">
                  <div className="close-button" onClick={toggleMobileMenu}>
                    <i
                      className="la la-times"
                      style={{
                        fontSize: 20,
                        color: "black",
                        position: "absolute",
                        top: 30,
                        right: 30,
                      }}
                    ></i>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      padding: "0px 24px",
                      marginTop: 40,
                    }}
                    onClick={toggleMobileMenu}
                  >
                    <a href="/#features" className="mobile-nav-link">
                      About
                    </a>
                    <a href="/#strengths" className="mobile-nav-link">
                      Features
                    </a>
                    <a href="/#testimonials" className="mobile-nav-link">
                      Testimonials
                    </a>
                    <a href="/#faqs" className="mobile-nav-link">
                      FAQs
                    </a>
                    <a href="/#contact-us" className="mobile-nav-link">
                      Talk to Us
                    </a>
                    <a href="/developer" className="mobile-nav-link">
                      Developer
                    </a>
                    <a href="/blog" className="mobile-nav-link">
                      Blog
                    </a>
                    <div
                      style={{
                        height: 1,
                        width: "100%",
                        backgroundColor: "#E9EAEB",
                        margin: "24px 0",
                      }}
                    ></div>
                    <a onClick={handleLoginClick} className="mobile-nav-link">
                      Login
                    </a>
                    <a
                      href="/?reasonForInquiry=Book_a_Demo#contact-us"
                      className="mobile-nav-link"
                      style={{
                        background:
                          "linear-gradient(90deg, #FCCEC0 0%, #EBACC9 33%, #CEB6DA 66%, #9FCAED 100%)",
                        backgroundClip: "text",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      Book a Demo
                      <i
                        className="la la-arrow-right"
                        style={{ fontSize: 36, marginLeft: 8 }}
                      ></i>
                    </a>
                  </div>
                </div>
              </div>
            )}
            <Image
              className="jia-logo"
              src="/jia-new-logo.png"
              alt="Jia Logo"
              width={48}
              height={48}
              onClick={() => {
                window.location.href = "/";
              }}
            />
            <a href="/#features" className="navbar-links">
              About
            </a>
            <a href="/#strengths" className="navbar-links">
              Features
            </a>
            <a href="/#testimonials" className="navbar-links">
              Testimonials
            </a>
            <a href="/developer" className="navbar-links">
              Developer
            </a>
            <a href="/blog" className="navbar-links">
              Blog
            </a>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              justifyContent: "center",
            }}
          >
            <a
              href={`${process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN?.includes("localhost") ? "http" : "https"}://${process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN}`}
              target="_blank"
              className="navbar-links"
            >
              For Job Hunters
            </a>
            <a onClick={handleLoginClick} className="navbar-login-btn">
              Login
            </a>
            <a
              href="/?reasonForInquiry=Book_a_Demo#contact-us"
              className="navbar-request-demo-btn"
            >
              Book a Demo
              <i
                className="la la-arrow-right"
                style={{ fontSize: 16, marginLeft: 8 }}
              ></i>
            </a>
          </div>
        </div>
      </nav>

      {showLoginModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#00000080",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={handleCloseLoginModal}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              background: "#ffffff",
              borderRadius: 24,
              boxShadow:
                "0px 8px 8px -4px #0a0d1208, 0px 20px 24px -4px #0a0d1214",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: 24,
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              alt="Close"
              src={assetConstants.x}
              onClick={handleCloseLoginModal}
              style={{
                cursor: "pointer",
                position: "absolute",
                right: 24,
                top: 24,
              }}
            />
            <img
              alt="Jia logo"
              src={assetConstants.jiaLogo}
              style={{ height: 48, width: 48 }}
            />
            <span
              style={{
                margin: "20px 0 8px 0",
                fontWeight: 700,
                fontSize: 20,
                lineHeight: "30px",
                textAlign: "center",
                color: "#181d27",
              }}
            >
              Let&apos;s get you set up!
            </span>
            <span
              style={{
                fontWeight: 500,
                fontSize: 16,
                lineHeight: "24px",
                textAlign: "center",
                color: "#717680",
              }}
            >
              Sign in to access your recruiter dashboard and manage candidates
            </span>
            <button
              type="button"
              onClick={handleSignInWithGoogle}
              style={{
                width: "100%",
                marginTop: 20,
                padding: "10px 0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                background: "#ffffff",
                border: "1px solid #d5d7da",
                borderRadius: 24,
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 16,
                lineHeight: "24px",
                color: "#181d27",
              }}
            >
              <img
                alt="Google"
                src={assetConstants.google}
                style={{ height: 20, width: 20, objectFit: "contain" }}
              />
              Continue with Google
            </button>
            <button
              type="button"
              onClick={handleSignInWithMicrosoft}
              style={{
                width: "100%",
                marginTop: 12,
                padding: "10px 0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                background: "#ffffff",
                border: "1px solid #d5d7da",
                borderRadius: 24,
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 16,
                lineHeight: "24px",
                color: "#181d27",
              }}
            >
              <img
                alt="Microsoft"
                src="/icons/microsoft.svg"
                style={{ height: 20, width: 20, objectFit: "contain" }}
              />
              Continue with Microsoft
            </button>
            <span
              style={{
                marginTop: 20,
                fontWeight: 400,
                fontSize: 12,
                lineHeight: "18px",
                textAlign: "center",
                color: "#717680",
              }}
            >
              By continuing, you agree to our
              <br />
              <span style={{ fontWeight: 700 }}>Terms of Service</span> and{" "}
              <span style={{ fontWeight: 700 }}>Privacy Policy</span>
            </span>

            <div
              className={styles.loginGuide}
              onClick={() => setShowTroubleshootingModal(true)}
              onKeyDown={(e) =>
                e.key === "Enter" && setShowTroubleshootingModal(true)
              }
              role="button"
              tabIndex={0}
            >
              <img src="/icons/info.svg" alt="info" />
              <span>Have trouble signing in?</span>
            </div>
          </div>

          {popupBlocked && (
            <div
              className={styles.popupBlockedBanner}
              role="alert"
              style={{ zIndex: 10001 }}
            >
              <div className={styles.popupBlockedBannerIcon}>
                <img src="/icons/alert-triangle.svg" alt="alert" />
              </div>
              <span className={styles.popupBlockedBannerText}>
                <b>Pop-ups blocked:</b> Your browser blocked the sign-in
                window. Allow pop-ups for this site to continue signing in.
              </span>
              <div className={styles.popupBlockedBannerButton}>
                <Button
                  variant="secondary"
                  label="Learn more"
                  onClick={() => setShowTroubleshootingModal(true)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {showTroubleshootingModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#00000080",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          onClick={() => setShowTroubleshootingModal(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <TroubleshootingGuideModal
              onClose={() => setShowTroubleshootingModal(false)}
              setModalType={() => {}}
              assetConstants={assetConstants}
              pathConstants={pathConstants}
            />
          </div>
        </div>
      )}
    </>
  );
}
