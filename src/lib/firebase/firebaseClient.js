import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { toast } from "react-toastify";
import { errorToast, loadingToast, successToast } from "../Utils";
import Swal from "sweetalert2";
import styles from "@/lib/styles/commonV2/modal.module.scss";
import { isOnEmployerTalentVaultDomain, isOnApplicantTalentVaultDomain, initiateHandoff } from "./authHandoff";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: "select_account" });

const ACCOUNT_EXISTS_DIFFERENT_CREDENTIAL = "auth/account-exists-with-different-credential";

function handleSignInError(err, attemptedProvider) {
  if (err?.code === ACCOUNT_EXISTS_DIFFERENT_CREDENTIAL) {
    const other = attemptedProvider === "Google" ? "Microsoft" : "Google";
    Swal.fire({
      title: "Use your original sign-in method",
      text: `This email is already registered with ${other}. Please sign in with ${other} instead.`,
      icon: "warning",
      confirmButtonText: "OK",
      customClass: {
        title: styles.swalTitle,
        icon: styles.swalIcon,
        confirmButton: styles.swalConfirmButton,
        htmlContainer: styles.swalDescription,
        popup: styles.swalContainer,
        actions: styles.swalAction,
      },
    });
    return;
  }
  errorToast("Login cancelled or failed. Please try again.");
}

export async function signInWithGoogle(type, options = {}) {
  const { rememberMe = true } = options;

  // For job-portal, set Firebase persistence based on rememberMe
  if (type === "job-portal") {
    const persistence = rememberMe
      ? firebase.auth.Auth.Persistence.LOCAL
      : firebase.auth.Auth.Persistence.SESSION;

    await auth.setPersistence(persistence).catch((err) => {
      console.error("Error setting persistence:", err);
    });
  }

  const res = await auth.signInWithPopup(googleProvider).catch((err) => {
    if (err?.code === "auth/popup-blocked") {
      options.onPopupBlocked?.();
      return null;
    }
    handleSignInError(err, "Google");
  });

  if (!res) {
    return false;
  }

  const profile = res.additionalUserInfo.profile;

  loadingToast("Logging in...");

  // Use Firebase ID token (backend validates with verifyIdToken)
  const token = await res.user.getIdToken();

  localStorage.authToken = token;

  localStorage.user = JSON.stringify({
    email: profile.email,
    image: profile.picture,
    name: profile.name,
    role: type,
  });

  axios
    .post(
      "/api/auth",
      {},
      {
        headers: {
          Authorization: token,
        },
      },
    )
    .then(async (res) => {
      if (
        res.data.error &&
        profile.email.split("@")[1] !== "whitecloak.com" &&
        !profile.email.split("@")[1].includes("shae")
      ) {
        errorToast(res.data.error);
        console.log(res.data);
      }

      toast.dismiss("loading-toast");

      successToast("Login successful");

      const host = window.location.host;

      if (res.data.role === "applicant" && res.data.isNew) {
        // New applicant sign up, trigger google conversion event
        try {
          if (
            typeof window !== "undefined" &&
            typeof window.gtag === "function"
          ) {
            window?.gtag?.("event", "applicant_sign_up", {
              method: "google",
              email: res.data.email,
            });
          }
        } catch (error) {
          console.error("Error triggering google event", error);
        }
      }

      // Check if applicant is trying to access employer portal (but not if they're explicitly on job-portal)
      if (
        type !== "job-portal" &&
        type !== "whitecloak-careers" &&
        (host.includes("localhost") ||
          host.includes(process.env.NEXT_PUBLIC_EMPLOYER_APP_DOMAIN)) &&
        res.data.role == "applicant"
      ) {
        Swal.fire({
          title: "No Account Found",
          text: `There's no employer account associated with your login ${res.data.email}.`,
          icon: "warning",
          showCancelButton: true, // second button
          confirmButtonText: "OK",
          cancelButtonText: "I'm a job seeker",
          customClass: {
            title: styles.swalTitle,
            icon: styles.swalIcon,
            confirmButton: styles.swalConfirmButton,
            cancelButton: styles.swalCancelButton,
            htmlContainer: styles.swalDescription,
            popup: styles.swalContainer,
            actions: styles.swalAction,
          },
        }).then((result) => {
          if (result.isConfirmed) {
            Swal.close();
          } else if (result.dismiss === Swal.DismissReason.cancel) {
            window.location.href = host.includes("localhost")
              ? "/job-portal"
              : `https://${process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN}`;
          }
        });

        localStorage.removeItem("user");
        return false;
      }

      // handle direct interview link redirects
      if (window.location.search.includes("?directInterviewID")) {
        let directInterviewID = window.location.search.split(
          "?directInterviewID=",
        )[1];

        if (directInterviewID) {
          window.location.href = `/direct-interview/${directInterviewID}`;
        }

        return false;
      }

      if (type === "whitecloak-careers") {
        if (sessionStorage.redirectionPath) {
          const redirectionPath = sessionStorage.getItem("redirectionPath");
          sessionStorage.removeItem("redirectionPath");
          window.location.href = redirectionPath;
        } else {
          window.location.href = "/whitecloak/applicant";
        }
        return false;
      }

      if (type === "job-portal") {
        // Set role in localStorage
        localStorage.role = "applicant";

        // --- Applicant Talent Vault handoff ---
        if (isOnApplicantTalentVaultDomain()) {
          try {
            const redirectDest = sessionStorage.redirectionPath
              ? sessionStorage.getItem("redirectionPath")
              : "/dashboard";
            sessionStorage.removeItem("redirectionPath");
            const initiated = await initiateHandoff(
              localStorage.authToken,
              redirectDest,
              "applicant"
            );
            if (initiated) return false;
          } catch (err) {
            console.error("[Handoff] Failed, showing error to user:", err);
            errorToast(
              "Could not complete sign-in redirect. Please try logging in directly."
            );
            setTimeout(() => {
              window.location.href = `https://${process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN}`;
            }, 2000);
            return false;
          }
        }
        // --- End applicant handoff ---

        if (sessionStorage.redirectionPath) {
          const redirectionPath = sessionStorage.getItem("redirectionPath");
          sessionStorage.removeItem("redirectionPath");
          window.location.href = redirectionPath;
        } else {
          window.location.href = "/dashboard";
        }
        return false;
      }

      // maintain flow
      if (window.location.search.includes("?redirect=")) {
        let redirect = window.location.search.split("?redirect=")[1];

        if (redirect) {
          window.location.href = redirect;
        }

        return false;
      }

      if (host.startsWith(process.env.NEXT_PUBLIC_ADMIN_APP_DOMAIN)) {
        localStorage.role = "admin";
        window.location.href = "/admin-portal";
        return;
      }

      // --- Employer Talent Vault handoff ---
      // Placed after all safety guards so those still run first.
      if (isOnEmployerTalentVaultDomain()) {
        try {
          const initiated = await initiateHandoff(
            localStorage.authToken,
            "/recruiter-dashboard"
          );
          if (initiated) return false;
        } catch (err) {
          console.error("[Handoff] Failed, showing error to user:", err);
          errorToast(
            "Could not complete sign-in redirect. Please try logging in directly."
          );
          // Fallback: redirect to canonical employer login so user can retry
          setTimeout(() => {
            window.location.href = `https://${process.env.NEXT_PUBLIC_EMPLOYER_APP_DOMAIN}`;
          }, 2000);
          return false;
        }
      }
      // --- End handoff ---

      let orgData = await api.post("/api/get-org", {
        user: profile,
      });

      if (orgData.data.length == 0) {
        localStorage.role = "applicant";
        window.location.href = window.location.origin.includes("localhost")
          ? "/job-portal"
          : `https://${process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN}`;
        return;
      }

      if (orgData.data.length > 0) {
        localStorage.role = "admin";
        const activeOrg = localStorage.activeOrg;

        localStorage.activeOrg = activeOrg
          ? activeOrg
          : JSON.stringify(orgData.data[0]);
        localStorage.orgList = JSON.stringify(orgData.data);

        const parsedActiveOrg = JSON.parse(localStorage.activeOrg);

        if (parsedActiveOrg.role == "hiring_manager") {
          window.location.href = `/recruiter-dashboard/careers?orgID=${parsedActiveOrg._id}`;
        } else if (parsedActiveOrg.role == "guest") {
          window.location.href = `/guest-portal/careers?orgId=${parsedActiveOrg._id}`;
        } else {
          window.location.href = `/recruiter-dashboard?orgID=${parsedActiveOrg._id}`;
        }
      }
    })
    .catch((error) => {
      console.error("Google login error", error);
      toast.dismiss("loading-toast");
      if (error.response?.status === 429) {
        errorToast(
          "Too many login attempts. Please try again in 1-2 minutes.",
        );
      } else {
        errorToast("Google login failed");
      }
    });
}

export async function signInWithMicrosoft(type, options = {}) {
  const { rememberMe = true } = options;

  if (type === "job-portal") {
    const persistence = rememberMe
      ? firebase.auth.Auth.Persistence.LOCAL
      : firebase.auth.Auth.Persistence.SESSION;
    await auth.setPersistence(persistence).catch((err) => {
      console.error("Error setting persistence:", err);
    });
  }

  const provider = new firebase.auth.OAuthProvider("microsoft.com");
  provider.setCustomParameters({ prompt: "select_account" });

  const res = await auth.signInWithPopup(provider).catch((err) => {
    if (err?.code === "auth/popup-blocked") {
      options.onPopupBlocked?.();
      return null;
    }
    handleSignInError(err, "Microsoft");
  });

  if (!res) {
    return false;
  }

  const user = res.user;
  const profile = {
    email: user.email,
    name: user.displayName || user.email?.split("@")[0] || "User",
    picture: user.photoURL || null,
  };

  loadingToast("Logging in...");

  const token = await user.getIdToken();

  localStorage.authToken = token;
  localStorage.user = JSON.stringify({
    email: profile.email,
    image: profile.picture,
    name: profile.name,
    role: type,
  });

  axios
    .post(
      "/api/auth",
      {},
      {
        headers: {
          Authorization: token,
        },
      },
    )
    .then(async (res) => {
      const emailDomain = profile.email?.split("@")?.[1];
      toast.dismiss("loading-toast");

      if (res.status === 429) {
        errorToast("Too many login attempts. Please try again in 1-2 minutes.");
        return;
      }

      if (res.status >= 400 || res.data?.error) {
        if (
          res.data?.error &&
          emailDomain !== "whitecloak.com" &&
          !emailDomain?.includes("shae")
        ) {
          errorToast(res.data.error);
        } else if (res.status >= 400) {
          errorToast(res.data?.error || "Authentication failed");
        }
        return;
      }

      successToast("Login successful");
      const host = window.location.host;

      if (res.data.role === "applicant" && res.data.isNew) {
        try {
          if (
            typeof window !== "undefined" &&
            typeof window.gtag === "function"
          ) {
            window?.gtag?.("event", "applicant_sign_up", {
              method: "microsoft",
              email: res.data.email,
            });
          }
        } catch (error) {
          console.error("Error triggering conversion event", error);
        }
      }

      if (
        type !== "job-portal" &&
        type !== "whitecloak-careers" &&
        (host.includes("localhost") ||
          host.includes(process.env.NEXT_PUBLIC_EMPLOYER_APP_DOMAIN)) &&
        res.data.role == "applicant"
      ) {
        Swal.fire({
          title: "No Account Found",
          text: `There's no employer account associated with your login ${res.data.email}.`,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "OK",
          cancelButtonText: "I'm a job seeker",
          customClass: {
            title: styles.swalTitle,
            icon: styles.swalIcon,
            confirmButton: styles.swalConfirmButton,
            cancelButton: styles.swalCancelButton,
            htmlContainer: styles.swalDescription,
            popup: styles.swalContainer,
            actions: styles.swalAction,
          },
        }).then((result) => {
          if (result.isConfirmed) {
            Swal.close();
          } else if (result.dismiss === Swal.DismissReason.cancel) {
            window.location.href = host.includes("localhost")
              ? "/job-portal"
              : `https://${process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN}`;
          }
        });
        localStorage.removeItem("user");
        return;
      }

      if (window.location.search.includes("?directInterviewID")) {
        const directInterviewID = window.location.search.split(
          "?directInterviewID=",
        )[1];
        if (directInterviewID) {
          window.location.href = `/direct-interview/${directInterviewID}`;
        }
        return;
      }

      if (type === "whitecloak-careers") {
        if (sessionStorage.redirectionPath) {
          const redirectionPath = sessionStorage.getItem("redirectionPath");
          sessionStorage.removeItem("redirectionPath");
          window.location.href = redirectionPath;
        } else {
          window.location.href = "/whitecloak/applicant";
        }
        return;
      }

      if (type === "job-portal") {
        localStorage.role = "applicant";

        // --- Applicant Talent Vault handoff ---
        if (isOnApplicantTalentVaultDomain()) {
          try {
            const redirectDest = sessionStorage.redirectionPath
              ? sessionStorage.getItem("redirectionPath")
              : "/dashboard";
            sessionStorage.removeItem("redirectionPath");
            const initiated = await initiateHandoff(
              localStorage.authToken,
              redirectDest,
              "applicant"
            );
            if (initiated) return false;
          } catch (err) {
            console.error("[Handoff] Failed, showing error to user:", err);
            errorToast(
              "Could not complete sign-in redirect. Please try logging in directly."
            );
            setTimeout(() => {
              window.location.href = `https://${process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN}`;
            }, 2000);
            return false;
          }
        }
        // --- End applicant handoff ---

        if (sessionStorage.redirectionPath) {
          const redirectionPath = sessionStorage.getItem("redirectionPath");
          sessionStorage.removeItem("redirectionPath");
          window.location.href = redirectionPath;
        } else {
          window.location.href = "/dashboard";
        }
        return;
      }

      if (window.location.search.includes("?redirect=")) {
        const redirect = window.location.search.split("?redirect=")[1];
        if (redirect) {
          window.location.href = redirect;
        }
        return;
      }

      if (host.startsWith(process.env.NEXT_PUBLIC_ADMIN_APP_DOMAIN)) {
        localStorage.role = "admin";
        window.location.href = "/admin-portal";
        return;
      }

      // --- Employer Talent Vault handoff ---
      // Placed after all safety guards so those still run first.
      if (isOnEmployerTalentVaultDomain()) {
        try {
          const initiated = await initiateHandoff(
            localStorage.authToken,
            "/recruiter-dashboard"
          );
          if (initiated) return;
        } catch (err) {
          console.error("[Handoff] Failed, showing error to user:", err);
          errorToast(
            "Could not complete sign-in redirect. Please try logging in directly."
          );
          // Fallback: redirect to canonical employer login so user can retry
          setTimeout(() => {
            window.location.href = `https://${process.env.NEXT_PUBLIC_EMPLOYER_APP_DOMAIN}`;
          }, 2000);
          return;
        }
      }
      // --- End handoff ---

      try {
        const orgData = await api.post("/api/get-org", {
          user: profile,
        });

        if (!orgData?.data || orgData.data.length === 0) {
          localStorage.role = "applicant";
          window.location.href = window.location.origin.includes("localhost")
            ? "/job-portal"
            : `https://${process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN}`;
          return;
        }

        localStorage.role = "admin";
        const activeOrg = localStorage.activeOrg;
        localStorage.activeOrg = activeOrg
          ? activeOrg
          : JSON.stringify(orgData.data[0]);
        localStorage.orgList = JSON.stringify(orgData.data);
        const parsedActiveOrg = JSON.parse(localStorage.activeOrg);
        if (parsedActiveOrg.role == "hiring_manager") {
          window.location.href = `/recruiter-dashboard/careers?orgID=${parsedActiveOrg._id}`;
        } else if (parsedActiveOrg.role == "guest") {
          window.location.href = `/guest-portal/careers?orgId=${parsedActiveOrg._id}`;
        } else {
          window.location.href = `/recruiter-dashboard?orgID=${parsedActiveOrg._id}`;
        }
      } catch (err) {
        console.error("Microsoft login get-org error", err);
        errorToast("Failed to load your organizations");
      }
    })
    .catch((error) => {
      console.error("Microsoft login error", error);
      toast.dismiss("loading-toast");

      if (error.response?.status === 429) {
        errorToast(
          "Too many login attempts. Please try again in 1-2 minutes.",
        );
      } else {
        errorToast(error?.response?.data?.error || "Microsoft login failed");
      }
    });
}

export const firebaseAuth = firebase.auth();

export default firebase;
