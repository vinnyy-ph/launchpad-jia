"use client";

import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import { AppContextProvider } from "../lib/context/AppContext";
import { Suspense, useEffect, useState } from "react";
import FullPageLoader from "@/lib/components/Loaders/FullPageLoader";
import ErrorBoundary from "@/lib/components/ErrorBoundary";
import { ParallaxProvider } from "react-scroll-parallax";
import GoogleChromeToolbar from "@/lib/components/GoogleChromeToolbar";
import { usePathname } from "next/navigation";
import TalentVaultLayout from "./(talent-vault)/layout";

const CHAT_WIDGET_ID = "691a8d60fe7ae475de0c991a";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isLandingPage] = useState(() => {
    const employerAppDomain = process.env.NEXT_PUBLIC_EMPLOYER_APP_DOMAIN || "";
    const landingPages = ["/blog", "/developer", "/terms-of-service", "/privacy-policy", "/security-disclosure-policy"];
    const isLP = landingPages.some((page) => pathname?.startsWith(page)) || pathname === "/";
    if (typeof window !== "undefined") {
      return (window?.location?.hostname?.startsWith(employerAppDomain) && isLP) || false;
    }
    return isLP;
  });
  const isTalentVault = pathname?.startsWith("/talent-vault");

  useEffect(() => {
    window.onfocus = () => {
      const delta = document.querySelectorAll(".datafetch-btn");
      delta.forEach((x: any) => {
        x.click();
      });
    };
  }, []);

  useEffect(() => {
    if (!isLandingPage) return;

    const existing = document.querySelector(`[data-widget-id="${CHAT_WIDGET_ID}"]`);
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://widgets.leadconnectorhq.com/loader.js";
      script.setAttribute("data-resources-url", "https://widgets.leadconnectorhq.com/chat-widget/loader.js");
      script.setAttribute("data-widget-id", CHAT_WIDGET_ID);
      document.head.appendChild(script);
    }
  }, [isLandingPage]);

  useEffect(() => {
    if (isLandingPage) {
      const hideWidget = () => {
        const widget = document.querySelector(`[data-widget-id="${CHAT_WIDGET_ID}"]`);
        if (widget && (widget as HTMLElement)?.style?.display !== "none") {
          (widget as HTMLElement).style.display = "none";
        }
      };

      hideWidget();
      const interval = setInterval(hideWidget, 100);
      return () => clearInterval(interval);
    }
  }, [isLandingPage]);

  if (isTalentVault) {
    return <TalentVaultLayout>{children}</TalentVaultLayout>;
  }

  return (
    <>
      <GoogleChromeToolbar />
      <ErrorBoundary>
        <Suspense fallback={<FullPageLoader />}>
          <ParallaxProvider>
            <AppContextProvider>
              {children}
            </AppContextProvider>
          </ParallaxProvider>
        </Suspense>
      </ErrorBoundary>
      <div id="global-recaptcha-container" className="recaptcha-container" />
      <ToastContainer />
    </>
  );
}
