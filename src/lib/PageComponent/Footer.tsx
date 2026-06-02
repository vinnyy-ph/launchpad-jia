"use client"
import Image from "next/image";
import { useState } from "react";
import { validateEmail } from "../Utils";
import axios from "axios";
import Swal from "sweetalert2";

export default function Footer() {

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const handleSubscribeNewsletter = async () => {
    if (!validateEmail(email) || !email?.trim()) {
      setEmailError("Please enter a valid email address");
      return;
    } else {
      setEmailError("");
    }

    try {
      Swal.showLoading();
      await axios.post("/api/add-inquiry", { email, reasonForInquiry: "Subscribe to newsletter" });
      Swal.close();
      Swal.fire({
        title: "Success",
        text: "You have been subscribed to our newsletter. Thank you for subscribing!",
        icon: "success",
        confirmButtonText: "OK",
      });
      setEmail("");
      setEmailError("");
    } catch (error) {
      console.error(error);
      Swal.close();
      Swal.fire({
        title: "Error",
        text: "Something went wrong. Please try again.",
        icon: "error",
        confirmButtonText: "OK",
      });
    }
  }

    return (
        <footer
        className="home-footer"
        // style={{ zIndex: isVisible ? 1 : 3 }}
      >
        <div className="footer-container">
          {/* Column 1 */}
          <div
          className="footer-column-left"
          >
            <div
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "flex-start" }}>
              <Image src="/jia-dashboard-logo.png" alt="Footer Logo" width={32} height={32} className="footer-logo"/>
              <span style={{ fontSize: "16px", color: "#181D27", fontWeight: 500 }}>
              Jia is powered by White Cloak Technologies, Inc.
              </span>
              </div>
              <span style={{ fontSize: "16px", color: "#717680", fontWeight: 500 }}>
              © Copyright 2025. All rights reserved.
              </span>
              <span
                className="footer-section-header"
                style={{
                  fontWeight: 500,
                  fontSize: "clamp(20px, 4vw, 24px)",
                }}
              >
                Contact
              </span>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 6 }}
              >
                {/* Sales Team Email */}
                <div
                  style={{
                    fontWeight: 500,
                    fontSize: "clamp(16px, 3vw, 18px)",
                    color: "#717680",
                  }}
                >
                  Sales Team: <a href="mailto:inquire@hellojia.ai" target="_blank" rel="noopener noreferrer">inquire@hellojia.ai</a>
                </div>
                
                <div
                  style={{
                    fontWeight: 500,
                    fontSize: "clamp(16px, 3vw, 18px)",
                    color: "#717680",
                  }}
                >
                  Development Team: <a href="mailto:hello@whitecloak.com" target="_blank" rel="noopener noreferrer">hello@whitecloak.com</a>
                </div>

                <span
                  style={{
                    fontWeight: 500,
                    fontSize: "clamp(16px, 3vw, 18px)",
                    color: "#717680",
                    lineHeight: 1.5,
                  }}
                >
                  20th Floor, F. Ortigas Jr Strata 2000 Building
                  <br />
                  San Antonio, Ortigas Center, Pasig, 1605 Metro Manila
                </span>
              </div>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <span
                className="footer-section-header"
                style={{
                  fontWeight: 500,
                  fontSize: "clamp(20px, 4vw, 24px)",
                }}
              >
                Careers at White Cloak
              </span>
              <span
                style={{
                  fontWeight: 500,
                  fontSize: "clamp(16px, 3vw, 18px)",
                  color: "#717680",
                  lineHeight: 1.5,
                }}
              >
                Join the most talented software development company <br/>
                in the country today.
              </span>

              <div 
                className="request-demo-btn" 
                style={{ marginTop: 24 }}
                onClick={() => {
                  window.open("https://whitecloak.com", "_blank");
                }}
              >
                White Cloak Careers
                <i className="la la-arrow-right" style={{ fontSize: 16, marginLeft: 8 }}></i>
              </div>
            </div>
          </div>
          {/* Column 2 */}
          <div className="footer-column-row">
            <div className="nav-links">
            <div
            className="footer-column"
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: 4 }}
              >
                <span
                  className="header"
                >
                  Jia
                </span>
                <span
                  className="link"
                  onClick={() => {
                    window.location.href = "/#about";
                  }}
                >
                  About Us
                </span>
                <span
                className="link"
                  onClick={() => {
                    window.location.href = "/#features";
                  }}
                >
                  Features
                </span>
                <span
                className="link"
                  onClick={() => {
                    window.location.href = "/developer";
                  }}
                >
                  Developer
                </span>
                <span
                className="link"
                  onClick={() => {
                    window.open("https://whitecloak.com", "_blank");
                  }}
                >
                  Work with us
                </span>
                <span
                className="link"
                  onClick={() => {
                    window.open(`https://${process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN}/job-openings`, "_blank");
                  }}
                >
                  Search for jobs
                </span>
              </div>
            </div>

            <div
            className="footer-column"
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: 4 }}
              >
                <span className="header">
                  Support
                </span>
                <span className="link"
                  onClick={() => {
                    window.location.href = "/#faqs";
                  }}
                >
                  FAQ
                </span>
                <span
                className="link"
                  onClick={() => {
                    window.location.href = "/#contact-us";
                  }}
                >
                  Contact Us
                </span>
                <span
                className="link"
                  onClick={() => {
                    window.location.href = "/terms-of-service";
                  }}
                >
                  Terms of Service
                </span>
                <span
                className="link"
                  onClick={() => {
                    window.location.href = "/privacy-policy";
                  }}
                >
                  Privacy Policy
                </span>
                <span
                className="link"
                  onClick={() => {
                    window.location.href = "/security-disclosure-policy";
                  }}
                >
                  Security Disclosure
                </span>
              </div>
            </div>
            </div>

          <div
          className="footer-column"
          >
            <span
                className="header"
              >
            Stay up to date
            </span>

            <div style={{ display: "flex", flexDirection: "row", gap: 10, width: "100%", maxWidth: "365px" }}>
            <div className="table-search-bar" style={{ width: "100%" }}>
              <div className="icon mr-2">
                  <i className="la la-envelope" style={{ fontSize: 16, color: "#717680" }}></i>
              </div>
              <input
                type="text"
                className="form-control search-input"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
              <div className="request-demo-btn" onClick={() => handleSubscribeNewsletter()}>
                Subcribe
              </div>
            </div>
            {emailError && <span style={{ color: "red", fontSize: 12 }}>{emailError}</span>}

            <span
            style={{
              width: "fit-content",
              fontWeight: 500,
              fontSize: "clamp(16px, 3vw, 18px)",
              color: "#717680",
            }}
            >
            Get the latest updates on Jia and more exclusive behind-the-scenes look on our production.
            </span>
          </div>

          </div>
        </div>
      </footer>
    )
}