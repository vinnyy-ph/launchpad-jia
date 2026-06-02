"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { successToast } from "../Utils";

export default function GoogleChromeToolbar() {
  const [isChrome, setIsChrome] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Check if browser is Chrome
    // Chrome detection: must have Chrome in user agent and not be Edge, Opera, or other Chromium-based browsers
    const userAgent = navigator.userAgent;
    const isChromeBrowser =
      /Chrome/.test(userAgent) &&
      /Google Inc/.test(navigator.vendor) &&
      !/Edg/.test(userAgent) && // Not Edge
      !/OPR/.test(userAgent) && // Not Opera
      !/Opera/.test(userAgent); // Not Opera (older versions)

    setIsChrome(isChromeBrowser);
    setIsVisible(!isChromeBrowser);

    // Ensure Line Awesome CSS is loaded
    const ensureLineAwesomeLoaded = () => {
      const existingLink = document.getElementById("line-awesome");
      if (!existingLink) {
        const link = document.createElement("link");
        link.id = "line-awesome";
        link.rel = "stylesheet";
        link.href =
          "https://maxst.icons8.com/vue-static/landings/line-awesome/line-awesome/1.3.0/css/line-awesome.min.css";
        document.head.appendChild(link);
      }
    };

    // Check if Line Awesome is loaded, if not, add it
    if (typeof window !== "undefined") {
      ensureLineAwesomeLoaded();
    }
  }, []);

  useEffect(() => {
    // Add padding to body when toolbar is visible (at bottom)
    if (isVisible) {
      document.body.style.paddingBottom = "70px";
    } else {
      document.body.style.paddingBottom = "0";
    }

    // Cleanup
    return () => {
      document.body.style.paddingBottom = "0";
    };
  }, [isVisible]);

  const copyCurrentLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      successToast("Link copied to clipboard! Open it in Google Chrome.", 3000);
    } catch (error) {
      console.error("Failed to copy link:", error);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = window.location.href;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        successToast(
          "Link copied to clipboard! Open it in Google Chrome.",
          3000
        );
      } catch (err) {
        console.error("Fallback copy failed:", err);
      }
      document.body.removeChild(textArea);
    }
  };

  if (!isVisible) {
    return null;
  }

  // Check if pathname includes /job-portal
  const isJobPortal = pathname?.includes("/job-portal");

  return (
    <div
      style={{
        position: isJobPortal ? "fixed" : "static",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        background: "linear-gradient(to right, #ddd, #e7d7fa)",
        color: "#000",
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        flexWrap: "wrap",
        gap: "15px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Google_Chrome_icon_%28February_2022%29.svg/1024px-Google_Chrome_icon_%28February_2022%29.svg.png"
          alt="Google Chrome"
          style={{
            width: "24px",
            height: "24px",
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: "14px", fontWeight: 500 }}>
          JIA works best with Google Chrome browser for the best experience.
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={copyCurrentLink}
          style={{
            color: "#333",
            border: "none",
            cursor: "pointer",
            backgroundColor: "transparent",
            fontSize: "14px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "0",
          }}
        >
          <i
            className="la la-copy"
            style={{
              fontFamily: "Line Awesome Free",
              fontWeight: 900,
              fontSize: "14px",
              color: "#333",
              display: "inline-block",
            }}
          ></i>
          Copy Link
        </button>
        and reopen or
        <a
          href="https://www.google.com/chrome/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#000",
            textDecoration: "underline",
            fontSize: "14px",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <i
            className="la la-download"
            style={{
              fontFamily: "Line Awesome Free",
              fontWeight: 900,
              fontSize: "14px",
              color: "#000",
              display: "inline-block",
            }}
          ></i>
          Install Google Chrome
        </a>
        <button
          onClick={() => setIsVisible(false)}
          style={{
            backgroundColor: "transparent",
            border: "none",
            color: "#000",
            cursor: "pointer",
            fontSize: "18px",
            padding: "4px 8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "4px",
            transition: "background-color 0.2s",
            minWidth: "32px",
            minHeight: "32px",
            position: "relative",
            zIndex: 10001,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
          aria-label="Close"
        >
          <i
            className="la la-times"
            style={{
              fontFamily: "Line Awesome Free",
              fontWeight: 900,
              fontSize: "18px",
              color: "#000",
              display: "block",
              lineHeight: "1",
              width: "18px",
              height: "18px",
            }}
          ></i>
        </button>
      </div>
    </div>
  );
}
