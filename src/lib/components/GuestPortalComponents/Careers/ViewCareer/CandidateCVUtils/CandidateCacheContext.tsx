"use client";

import React, { createContext, useContext, useRef, useCallback, useMemo } from "react";

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

export type CandidateCache = {
  cvData: any | null;
  interviewData: Map<string, any>; // keyed by interviewId
  orgSkills: string[] | null;
  fetchedAt: number;
};

type CacheContextValue = {
  // CV Data cache (keyed by email)
  getCVCache: (email: string) => { cvData: any | null; fetchedAt: number } | null;
  setCVCache: (email: string, cvData: any) => void;
  
  // Interview Data cache (keyed by interviewId)
  getInterviewCache: (interviewId: string) => any | null;
  setInterviewCache: (interviewId: string, data: any) => void;
  
  // Org Skills cache (keyed by email + orgId)
  getOrgSkillsCache: (email: string, orgId: string | null) => string[] | null;
  setOrgSkillsCache: (email: string, orgId: string | null, skills: string[]) => void;
  
  // Invalidation
  invalidateCVCache: (email: string) => void;
  invalidateInterviewCache: (interviewId: string) => void;
  invalidateAllForEmail: (email: string) => void;
  
  // Check if cache is stale
  isCacheStale: (fetchedAt: number) => boolean;
};

const CandidateCacheContext = createContext<CacheContextValue | null>(null);

// Stable no-op fallback for standalone usage (outside provider)
// This MUST be a module-level constant to prevent infinite loops in useEffect dependencies
const NO_OP_CACHE: CacheContextValue = {
  getCVCache: () => null,
  setCVCache: () => {},
  getInterviewCache: () => null,
  setInterviewCache: () => {},
  getOrgSkillsCache: () => null,
  setOrgSkillsCache: () => {},
  invalidateCVCache: () => {},
  invalidateInterviewCache: () => {},
  invalidateAllForEmail: () => {},
  isCacheStale: () => true,
};

type CVCacheEntry = {
  cvData: any | null;
  fetchedAt: number;
};

type InterviewCacheEntry = {
  data: any;
  fetchedAt: number;
};

type OrgSkillsCacheEntry = {
  skills: string[];
  fetchedAt: number;
};

export function CandidateCacheProvider({ children }: { children: React.ReactNode }) {
  // Using refs to persist cache across re-renders without causing re-renders on updates
  const cvCacheRef = useRef<Map<string, CVCacheEntry>>(new Map());
  const interviewCacheRef = useRef<Map<string, InterviewCacheEntry>>(new Map());
  const orgSkillsCacheRef = useRef<Map<string, OrgSkillsCacheEntry>>(new Map());

  const isCacheStale = useCallback((fetchedAt: number): boolean => {
    return Date.now() - fetchedAt > CACHE_TTL;
  }, []);

  // CV Data cache operations
  const getCVCache = useCallback((email: string) => {
    const entry = cvCacheRef.current.get(email);
    if (!entry) return null;
    if (isCacheStale(entry.fetchedAt)) {
      cvCacheRef.current.delete(email);
      return null;
    }
    return entry;
  }, [isCacheStale]);

  const setCVCache = useCallback((email: string, cvData: any) => {
    cvCacheRef.current.set(email, {
      cvData,
      fetchedAt: Date.now(),
    });
  }, []);

  const invalidateCVCache = useCallback((email: string) => {
    cvCacheRef.current.delete(email);
  }, []);

  // Interview Data cache operations
  const getInterviewCache = useCallback((interviewId: string) => {
    const entry = interviewCacheRef.current.get(interviewId);
    if (!entry) return null;
    if (isCacheStale(entry.fetchedAt)) {
      interviewCacheRef.current.delete(interviewId);
      return null;
    }
    return entry.data;
  }, [isCacheStale]);

  const setInterviewCache = useCallback((interviewId: string, data: any) => {
    interviewCacheRef.current.set(interviewId, {
      data,
      fetchedAt: Date.now(),
    });
  }, []);

  const invalidateInterviewCache = useCallback((interviewId: string) => {
    interviewCacheRef.current.delete(interviewId);
  }, []);

  // Org Skills cache operations
  const getOrgSkillsCacheKey = (email: string, orgId: string | null) => `${email}:${orgId || "null"}`;

  const getOrgSkillsCache = useCallback((email: string, orgId: string | null) => {
    const key = getOrgSkillsCacheKey(email, orgId);
    const entry = orgSkillsCacheRef.current.get(key);
    if (!entry) return null;
    if (isCacheStale(entry.fetchedAt)) {
      orgSkillsCacheRef.current.delete(key);
      return null;
    }
    return entry.skills;
  }, [isCacheStale]);

  const setOrgSkillsCache = useCallback((email: string, orgId: string | null, skills: string[]) => {
    const key = getOrgSkillsCacheKey(email, orgId);
    orgSkillsCacheRef.current.set(key, {
      skills,
      fetchedAt: Date.now(),
    });
  }, []);

  // Invalidate all caches for a specific email (useful after regenerate)
  const invalidateAllForEmail = useCallback((email: string) => {
    cvCacheRef.current.delete(email);
    
    // Remove all org skills entries for this email
    for (const key of orgSkillsCacheRef.current.keys()) {
      if (key.startsWith(`${email}:`)) {
        orgSkillsCacheRef.current.delete(key);
      }
    }
  }, []);

  // IMPORTANT: memoize the context value object.
  // Several consumer hooks include `cache` (this context object) in effect deps.
  // Without this memoization, every provider re-render creates a new reference,
  // causing effects to re-run, abort in-flight requests, and potentially refetch in loops.
  const value: CacheContextValue = useMemo(
    () => ({
      getCVCache,
      setCVCache,
      getInterviewCache,
      setInterviewCache,
      getOrgSkillsCache,
      setOrgSkillsCache,
      invalidateCVCache,
      invalidateInterviewCache,
      invalidateAllForEmail,
      isCacheStale,
    }),
    [
      getCVCache,
      setCVCache,
      getInterviewCache,
      setInterviewCache,
      getOrgSkillsCache,
      setOrgSkillsCache,
      invalidateCVCache,
      invalidateInterviewCache,
      invalidateAllForEmail,
      isCacheStale,
    ]
  );

  return (
    <CandidateCacheContext.Provider value={value}>
      {children}
    </CandidateCacheContext.Provider>
  );
}

export function useCandidateCache(): CacheContextValue {
  const context = useContext(CandidateCacheContext);
  if (!context) {
    // Return stable no-op implementation if used outside provider
    // This allows hooks to work standalone (backwards compatibility)
    return NO_OP_CACHE;
  }
  return context;
}

