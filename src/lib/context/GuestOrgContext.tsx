"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useSearchParams } from "next/navigation";

interface GuestOrg {
  _id: string;
  name: string;
  role: string;
  status: string;
  [key: string]: any;
}

interface GuestOrgContextType {
  orgId: string | null;
  guestOrg: GuestOrg | null;
  isLoading: boolean;
  setGuestOrg: (org: GuestOrg | null) => void;
  buildUrl: (path: string) => string;
}

const GuestOrgContext = createContext<GuestOrgContextType | undefined>(undefined);

export function GuestOrgProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const [guestOrg, setGuestOrg] = useState<GuestOrg | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get orgId from URL query params (primary source of truth)
  const orgIdFromUrl = searchParams.get("orgId");

  useEffect(() => {
    // Try to get cached org from localStorage for initial render
    if (typeof window !== "undefined" && localStorage.guestOrg) {
      try {
        const cachedOrg = JSON.parse(localStorage.guestOrg);
        // Only use cached org if it matches the URL orgId
        if (!orgIdFromUrl || cachedOrg._id === orgIdFromUrl) {
          setGuestOrg(cachedOrg);
        }
      } catch (error) {
        console.error("Error parsing cached guestOrg:", error);
      }
    }
    setIsLoading(false);
  }, [orgIdFromUrl]);

  // Helper function to build URLs with orgId query param
  const buildUrl = (path: string): string => {
    const currentOrgId = orgIdFromUrl || guestOrg?._id;
    if (!currentOrgId) return path;
    
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}orgId=${currentOrgId}`;
  };

  return (
    <GuestOrgContext.Provider
      value={{
        orgId: orgIdFromUrl || guestOrg?._id || null,
        guestOrg,
        isLoading,
        setGuestOrg,
        buildUrl,
      }}
    >
      {children}
    </GuestOrgContext.Provider>
  );
}

export function useGuestOrg(): GuestOrgContextType {
  const context = useContext(GuestOrgContext);
  if (context === undefined) {
    throw new Error("useGuestOrg must be used within a GuestOrgProvider");
  }
  return context;
}

export default GuestOrgContext;
