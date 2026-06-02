"use client";

/**
 * /auth/handoff — Cross-domain authentication handoff page
 *
 * The user lands here after logging in on talentvault.{domain}.
 * A one-time handoff cookie (auth_handoff) was set on the parent domain
 * during the handoff/create step.  This page:
 *
 *  1. POSTs to /api/auth/handoff/consume (cookie sent automatically).
 *  2. Receives a Firebase custom token.
 *  3. Calls signInWithCustomToken() to establish a local Firebase session.
 *  4. Bootstraps localStorage (authToken, user, role, org data) via /api/auth.
 *  5. Redirects to the intended destination (e.g. /recruiter-dashboard).
 *
 * No auth guard runs on this page.
 */

import { useEffect, useRef, useState } from "react";
import firebase from "@/lib/firebase/firebaseClient";
import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import { clearUserSession } from "@/lib/Utils";

type HandoffState = "loading" | "error";

export default function AuthHandoffPage() {
  const [state, setState] = useState<HandoffState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const hasRun = useRef(false);

  useEffect(() => {
    // Prevent double-execution in React strict mode
    if (hasRun.current) return;
    hasRun.current = true;

    performHandoff();
  }, []);

  async function performHandoff() {
    try {
      // Step 1: Consume the handoff code (cookie is sent automatically)
      const consumeRes = await axios.post("/api/auth/handoff/consume");

      if (!consumeRes.data?.customToken) {
        throw new Error(consumeRes.data?.error || "No custom token received");
      }

      const { customToken, redirectPath } = consumeRes.data;

      // Step 2: Clear any stale session state now that we have a valid handoff.
      // Done AFTER consume so that direct visits to /auth/handoff (no cookie)
      // fail without nuking an existing session.
      clearUserSession();

      // Step 3: Sign in with the custom token to establish Firebase auth
      const userCredential = await firebase
        .auth()
        .signInWithCustomToken(customToken);

      if (!userCredential.user) {
        throw new Error("Firebase signInWithCustomToken failed");
      }

      // Step 4: Get a fresh ID token from the newly authenticated session
      const idToken = await userCredential.user.getIdToken();
      localStorage.authToken = idToken;

      // Step 5: Call /api/auth to get user data (same as normal login flow)
      const authRes = await axios.post(
        "/api/auth",
        {},
        { headers: { Authorization: idToken } }
      );

      const userData = authRes.data;

      // Step 6: Bootstrap localStorage (mirrors firebaseClient.js logic)
      localStorage.user = JSON.stringify({
        email: userData.email || userCredential.user.email,
        image: userData.image || userCredential.user.photoURL,
        name: userData.name || userCredential.user.displayName,
        role: userData.role,
      });

      // Step 7: Resolve role + org data and redirect
      if (userData.role === "applicant") {
        localStorage.role = "applicant";
        window.location.href = redirectPath || "/dashboard";
        return;
      }

      // Employer / admin flow — need org data
      const profile = {
        email: userData.email || userCredential.user.email,
        name: userData.name || userCredential.user.displayName,
      };

      const orgData = await api.post("/api/get-org", { user: profile });

      if (!orgData?.data || orgData.data.length === 0) {
        // No org membership — treat as applicant
        localStorage.role = "applicant";
        window.location.href = redirectPath || "/dashboard";
        return;
      }

      localStorage.role = "admin";
      const existingActiveOrg = localStorage.activeOrg;
      localStorage.activeOrg = existingActiveOrg
        ? existingActiveOrg
        : JSON.stringify(orgData.data[0]);
      localStorage.orgList = JSON.stringify(orgData.data);

      const parsedActiveOrg = JSON.parse(localStorage.activeOrg);

      // Route by role with intentional orgID/orgId convention:
      // - Hiring managers & admins use ?orgID= (uppercase ID) - see firebaseClient.js:283 (Google) & :485 (Microsoft)
      // - Guests use ?orgId= (camelCase) - see firebaseClient.js:285 (Google) & similar pattern in Microsoft flow
      // This split matches recruiter/guest flow distinction in firebaseClient.js OAuth handlers.
      if (redirectPath && redirectPath !== "/recruiter-dashboard") {
        window.location.href = redirectPath;
      } else if (parsedActiveOrg.role === "hiring_manager") {
        window.location.href = `/recruiter-dashboard/careers?orgID=${parsedActiveOrg._id}`;
      } else if (parsedActiveOrg.role === "guest") {
        window.location.href = `/guest-portal/careers?orgId=${parsedActiveOrg._id}`;
      } else {
        window.location.href = `/recruiter-dashboard?orgID=${parsedActiveOrg._id}`;
      }
    } catch (err: any) {
      console.error("[Auth Handoff] Error:", err);

      // Clear any partial auth state so the next visit starts clean
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      localStorage.removeItem("role");
      localStorage.removeItem("activeOrg");
      localStorage.removeItem("orgList");

      const message = "Something went wrong. Redirecting you to sign in...";

      setErrorMsg(message);
      setState("error");

      // After a brief delay, redirect to homepage so the user can log in normally
      setTimeout(() => {
        window.location.href = "/?authError=handoff_failed";
      }, 3000);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "system-ui, -apple-system, sans-serif",
        backgroundColor: "#f9fafb",
        color: "#374151",
      }}
    >
      {state === "loading" && (
        <>
          <div
            style={{
              width: 40,
              height: 40,
              border: "3px solid #e5e7eb",
              borderTopColor: "#6366f1",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <p style={{ marginTop: 16, fontSize: 16, color: "#6b7280" }}>
            Signing you in...
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
      )}

      {state === "error" && (
        <>
          <p style={{ fontSize: 16, color: "#6b7280" }}>
            {errorMsg}
          </p>
        </>
      )}
    </div>
  );
}
