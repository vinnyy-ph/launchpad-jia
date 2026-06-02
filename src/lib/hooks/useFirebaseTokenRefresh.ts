import { useEffect } from "react";
import { firebaseAuth } from "@/lib/firebase/firebaseClient";

export const useFirebaseTokenRefresh = (enabled: boolean = true) => {
  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = firebaseAuth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          localStorage.authToken = idToken;
        } catch (error) {
          console.error("Error refreshing token:", error);
        }
      }
    });

    const handleFocusOrVisibility = async () => {
      const firebaseUser = firebaseAuth.currentUser;
      if (firebaseUser) {
        try {
          const tokenResult = await firebaseUser.getIdTokenResult(false);
          const expirationTime = new Date(tokenResult.expirationTime).getTime();
          const now = Date.now();
          const timeUntilExpiry = expirationTime - now;
          
          const shouldRefresh = timeUntilExpiry < 5 * 60 * 1000;
          const idToken = await firebaseUser.getIdToken(shouldRefresh);
          
          localStorage.authToken = idToken;
        } catch (error) {
          console.error("Error refreshing token on focus:", error);
        }
      }
    };

    window.addEventListener("focus", handleFocusOrVisibility);
    window.addEventListener("pageshow", handleFocusOrVisibility);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        handleFocusOrVisibility();
      }
    });

    return () => {
      unsubscribe();
      window.removeEventListener("focus", handleFocusOrVisibility);
      window.removeEventListener("pageshow", handleFocusOrVisibility);
      document.removeEventListener("visibilitychange", handleFocusOrVisibility);
    };
  }, [enabled]);
};
