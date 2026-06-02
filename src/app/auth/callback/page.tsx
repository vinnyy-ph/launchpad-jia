"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { firebaseAuth } from "@/lib/firebase/firebaseClient";
import axios from "axios";
import { Suspense } from "react";
import firebase from "@/lib/firebase/firebaseClient";

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const normalizeRedirect = (rawRedirect: string | null): string => {
    const fallback = "/guest-portal/careers";
    if (!rawRedirect) return fallback;

    let redirectValue = rawRedirect;

    // Step 1: Decode URL (up to 2 times for double-encoding)
    for (let i = 0; i < 2; i++) {
      if (!redirectValue.includes("%")) break;
      try {
        const decoded = decodeURIComponent(redirectValue);
        if (decoded === redirectValue) break;
        redirectValue = decoded;
      } catch {
        break;
      }
    }

    // Step 2: Security checks
    if (!redirectValue.startsWith("/")) return fallback;
    if (redirectValue.startsWith("//")) return fallback;

    // Step 3: Fix malformed orgId patterns
    // Pattern 1: orgId followed directly by 24 hex chars (missing =) - case insensitive
    redirectValue = redirectValue.replace(
      /([?&])orgId([0-9a-fA-F]{24})(?=(&|$))/gi,
      "$1orgId=$2"
    );

    // Pattern 2: orgIdi followed by 23 hex chars (= became 'i' via %3D -> %69 corruption)
    // The '6' from the orgId value got consumed as part of %69 which decoded to 'i'
    // e.g., orgIdi93f4e8656509e5b5a53e01f -> orgId=693f4e8656509e5b5a53e01f
    redirectValue = redirectValue.replace(
      /([?&])orgId[iI]([0-9a-fA-F]{23})(?=(&|$))/g,
      "$1orgId=6$2"
    );

    // Pattern 3: Handle case where = is present but orgId casing is wrong
    redirectValue = redirectValue.replace(
      /([?&])(?:orgID|ORGID|OrgId)=/gi,
      "$1orgId="
    );

    // Pattern 4: Handle orgId with extra hex chars (take first 24)
    const orgIdMatch = redirectValue.match(/[?&]orgId=([0-9a-fA-F]{25,})/i);
    if (orgIdMatch) {
      const fullHex = orgIdMatch[1];
      const validHex = fullHex.slice(0, 24);
      redirectValue = redirectValue.replace(
        /([?&])orgId=[0-9a-fA-F]{25,}/i,
        `$1orgId=${validHex}`
      );
    }

    return redirectValue;
  };

  const rawRedirect = searchParams.get("redirect");
  const redirect = normalizeRedirect(rawRedirect);

  if (rawRedirect && redirect !== rawRedirect) {
    console.warn("[Auth Callback] Redirect URL was normalized:", {
      original: rawRedirect,
      normalized: redirect,
    });
  }

  async function handleGoogleLogin() {
    setStatus("loading");

    try {
      // Step 1: Trigger Google SSO popup (same as /login)
      const googleProvider = new firebase.auth.GoogleAuthProvider();
      googleProvider.setCustomParameters({ prompt: "select_account" });

      const res = await firebaseAuth.signInWithPopup(googleProvider);

      if (!res) {
        throw new Error("Login cancelled by user");
      }

      const profile = (res as any).additionalUserInfo?.profile;
      const user = res.user;

      if (!profile || !user) {
        throw new Error("Failed to get user profile");
      }

      // Step 2: Set localStorage (EXACT same pattern as signInWithGoogle in firebaseClient.js)
      localStorage.authToken = await user.getIdToken();
      localStorage.user = JSON.stringify({
        email: profile.email,
        image: profile.picture,
        name: profile.name,
        role: "guest",
      });

      // Step 3: Call /api/auth to validate/update user in DB (same as login)
      // This will update status to "joined" and set Google profile data
      const authToken = localStorage.authToken;
      await axios.post(
        "/api/auth",
        {},
        {
          headers: {
            Authorization: authToken,
          },
        }
      );

      // Step 4: Redirect to destination
      setStatus("success");
      window.location.href = redirect;

    } catch (error: any) {
      console.error("Auth callback error:", error);
      setStatus("error");
      setErrorMessage(error.message || "Authentication failed");
    }
  }

  const steps = [
    {
      number: 1,
      text: "Sign in with your Google account",
      className: "text-white",
    },
    {
      number: 2,
      text: "Access guest portal features",
    },
    {
      number: 3,
      text: "View job opportunities and candidate information",
    },
    {
      number: 4,
      text: "Collaborate with the hiring team",
    },
  ];

  return (
    <div className="auth-panel">
      <div className="panel left">
        <div className="form-section fade-in-bottom">
          <div className="auth-form">
            <img alt="jia logo" id="zyp-logo" src="/jia-new-logo.png" />
            <br />
            <span className="text-grey">Guest Portal Access</span>
            <br />

            {status === "idle" && (
              <button
                className="btn btn-default btn-auth"
                onClick={handleGoogleLogin}
              >
                <img
                  alt="google logo"
                  src="https://companieslogo.com/img/orig/GOOG-0ed88f7c.png?t=1633218227"
                  className="mr-2"
                />
                <span>Continue with Google</span>
              </button>
            )}

            {status === "loading" && (
              <button className="btn btn-default btn-auth" disabled>
                <i className="la la-circle-notch spin mr-2"></i>
                <span>Signing you in...</span>
              </button>
            )}

            {status === "error" && (
              <>
                <div style={{ color: "#EF4444", marginBottom: "16px", textAlign: "center" }}>
                  <i className="la la-exclamation-circle"></i> {errorMessage}
                </div>
                <button
                  className="btn btn-default btn-auth"
                  onClick={handleGoogleLogin}
                >
                  <img
                    alt="google logo"
                    src="https://companieslogo.com/img/orig/GOOG-0ed88f7c.png?t=1633218227"
                    className="mr-2"
                  />
                  <span>Try Again</span>
                </button>
              </>
            )}

            {status === "success" && (
              <button className="btn btn-default btn-auth" disabled>
                <i className="la la-check-circle mr-2" style={{ color: "#10B981" }}></i>
                <span>Redirecting...</span>
              </button>
            )}

            <br />
            <br />
            <a target="_blank" href="https://www.whitecloak.com/">
              <div className="cite-set">
                <img
                  src="https://www.whitecloak.com/wp-content/uploads/2024/02/wc-favicon.png"
                  className="fade-in dl-3"
                />
                <span className="text-grey fade-in dl-4">
                  Powered by White Cloak Technologies
                </span>
              </div>
            </a>
          </div>
        </div>
      </div>
      <div className="panel right fade-in dl-2">
        <div className="banner-text">
          <br />
          <br />
          <h1 className="fade-in dl-2 text-white display-2 b-text">
            Welcome to the <br />
            Guest Portal
          </h1>
          <br />
          <div className="step-set">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className={`step fade-in-bottom dl-${(index + 1) * 2}`}
              >
                <div className="number">
                  <span>{step.number}</span>
                </div>
                <span className={step.className}>{step.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="auth-panel">
        <div className="panel left">
          <div className="form-section">
            <div className="auth-form">
              <img alt="jia logo" id="zyp-logo" src="/jia-new-logo.png" />
              <br />
              <span className="text-grey">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
