"use client";

import FloatingActionButton from "@/lib/components/commonV2/FloatingActionButton";
import Modal from "@/lib/components/commonV2/Modal";
import Navbar from "@/lib/components/commonV2/Navbar";
import Toaster from "@/lib/components/commonV2/Toaster";
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { useFirebaseTokenRefresh } from "@/lib/hooks/useFirebaseTokenRefresh";
import { api } from "@/lib/utils/apiClient";

export type ToasterPayload = { title?: string; description?: string } | null;

const Context = createContext({
  modalType: null,
  toasterType: null,
  user: null,
  isUserRevalidating: false,
  organizationBranding: null,
  hideNavbar: false,
  setModalType: (_modalType: string | null) => {},
  setToasterType: (_toasterType: string | null | { type: string; title?: string; description?: string }) => {},
  toasterPayload: null as ToasterPayload,
  setOrganizationBranding: (_branding: { enabled: boolean; logo: string; name: string } | null) => {},
  setHideNavbar: (_hideNavbar: boolean) => {},
});

export function useAppContext() {
  return useContext(Context);
}

export default function ({ children }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isHydrated, setIsHydrated] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [toasterState, setToasterState] = useState<{ type: string | null; payload: ToasterPayload }>({ type: null, payload: null });
  const [user, setUser] = useState(null);
  const [isUserRevalidating, setIsUserRevalidating] = useState(false);
  const [organizationBranding, setOrganizationBranding] = useState(null);
  const [hideNavbar, setHideNavbar] = useState(false);

  const setToasterType = (value: string | null | { type: string; title?: string; description?: string }) => {
    if (value === null) {
      setToasterState({ type: null, payload: null });
    } else if (typeof value === "string") {
      setToasterState({ type: value, payload: null });
    } else {
      setToasterState({
        type: value.type,
        payload: { title: value.title, description: value.description },
      });
    }
  };

  const contextValue = {
    modalType,
    toasterType: toasterState.type,
    user,
    isUserRevalidating,
    organizationBranding,
    hideNavbar,
    setModalType,
    setToasterType,
    toasterPayload: toasterState.payload,
    setOrganizationBranding,
    setHideNavbar,
  };

  useFirebaseTokenRefresh();

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        setModalType(null);
      }
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  useEffect(() => {
    const argonLink = document.getElementById("argon-css");
    const lineAwesomeLink = document.getElementById("line-awesome");
    const storedUser = localStorage.getItem("user");

    if (argonLink) {
      argonLink.remove();
    }

    if (lineAwesomeLink) {
      lineAwesomeLink.remove();
    }

    if (storedUser) {
      const parseStoredUser = JSON.parse(storedUser);
      setUser(parseStoredUser);

      // Revalidate user data (get fresh talentVaultStatus)
      setIsUserRevalidating(true);
      api.post("/api/auth").then((res) => {
        const freshUser = res.data;
        setUser(freshUser);
        localStorage.setItem("user", JSON.stringify(freshUser));
      }).catch(err => console.error("Revalidation failed", err))
        .finally(() => setIsUserRevalidating(false));
    } else {
      setUser(null);
    }

    setIsHydrated(true);
    sessionStorage.removeItem("hasChanges");
  }, [pathname, searchParams]);

  if (!isHydrated) return null;

  return (
    <Context.Provider value={contextValue}>
      <main>
        {modalType && (
          <Modal modalType={modalType} setModalType={setModalType} />
        )}
        {toasterState.type && (
          <Toaster
            toasterType={toasterState.type}
            toasterPayload={toasterState.payload}
            setToasterType={setToasterType}
          />
        )}
        {!hideNavbar && <Navbar />}
        <FloatingActionButton />
        {children}
      </main>
    </Context.Provider>
  );
}
