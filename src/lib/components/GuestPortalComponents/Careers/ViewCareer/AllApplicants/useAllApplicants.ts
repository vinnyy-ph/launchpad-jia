"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { api } from "@/lib/utils/apiClient";
import useDebounce from "@/lib/hooks/useDebounceHook";
import { errorToast } from "@/lib/Utils";

export function useAllApplicants({ careerId }: { careerId: string }) {
  const [resolvedCareerId, setResolvedCareerId] = useState<string | null>(null);
  const [isCareerConfigLoaded, setIsCareerConfigLoaded] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [sortBy, setSortBy] = useState("Recent Activity");
  const [filterStatus, setFilterStatus] = useState("All Statuses");
  const [filterStage, setFilterStage] = useState<{label: string, stageId: string | null, substageId: string | null}>({ label: "All Stages", stageId: null, substageId: null });
  const [filterStageOptions, setFilterStageOptions] = useState<Array<{label: string, stageId: string | null, substageId: string | null}>>([{ label: "All Stages", stageId: null, substageId: null }]);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalApplicants, setTotalApplicants] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;
  
  // Track previous careerId to detect changes
  const prevCareerIdRef = useRef<string | null>(null);

  const sortByOptions = useMemo(
    () => [
      "Recent Activity",
      "Oldest Activity",
      "Date Applied (Newest First)",
      "Date Applied (Oldest First)",
      "Alphabetical (A-Z)",
      "Alphabetical (Z-A)",
    ],
    []
  );

  const filterStatusOptions = useMemo(
    () => ["All Statuses", "Ongoing", "Dropped", "Cancelled", "Hired"],
    []
  );

  // Reset filters when careerId changes
  useEffect(() => {
    if (prevCareerIdRef.current !== careerId) {
      // Only reset if careerId actually changed (not on initial mount with same value)
      if (prevCareerIdRef.current !== null) {
        setCurrentPage(1);
        setSearch("");
        setSortBy("Recent Activity");
        setFilterStatus("All Statuses");
        setFilterStage({ label: "All Stages", stageId: null, substageId: null });
      }
      prevCareerIdRef.current = careerId;
      setIsCareerConfigLoaded(false);
      setResolvedCareerId(null);
    }
  }, [careerId]);

  // Load career config to get resolved ID and pipeline stages
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const loadCareerConfig = async () => {
      try {
        const guestOrg = localStorage.getItem("guestOrg");
        const orgID = guestOrg ? JSON.parse(guestOrg)._id : null;
        const careerResponse = await api.post("/api/career-data", { id: careerId, orgID }, { signal: controller.signal });
        
        if (!mounted) return;
        
        const careerData = careerResponse.data;
        const resolvedId = (careerData?.id || careerData?._id || careerId) as string;
        setResolvedCareerId(resolvedId);
        
        const pipelineStages = careerData?.pipelineStages || [];
        setPipelineStages(pipelineStages);
        const options = Array.isArray(pipelineStages)
          ? pipelineStages
              .filter((stage: any) => stage.enabled !== false)
              .flatMap((stage: any) => (stage?.substages || []).map((substage: any) => ({
                label: `${stage.alias || stage.name} - ${substage.name}`,
                stageId: stage.id,
                substageId: substage.id,
              })))
          : [];
        setFilterStageOptions([{ label: "All Stages", stageId: null, substageId: null }, ...options]);
        setIsCareerConfigLoaded(true);
      } catch (err: any) {
        if (!mounted) return;
        // If request was cancelled, don't update state
        if (err?.name === "CanceledError" || err?.name === "AbortError") return;
        
        // Fallback to using careerId directly
        setResolvedCareerId(careerId);
        setFilterStageOptions([{ label: "All Stages", stageId: null, substageId: null }]);
        setIsCareerConfigLoaded(true);
      }
    };

    if (careerId) {
      loadCareerConfig();
    }

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [careerId]);

  // Fetch applicants only after career config is loaded
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const fetchApplicants = async () => {
      if (!resolvedCareerId || !isCareerConfigLoaded) return;
      
      try {
        setLoading(true);
        const response = await api.get("/api/get-career-applicants", {
          params: {
            careerID: resolvedCareerId,
            page: currentPage,
            limit,
            search: debouncedSearch,
            filterStatus,
            filterStageId: filterStage.stageId,
            filterSubstageId: filterStage.substageId,
            sortBy,
          },
          signal: controller.signal,
        });
        
        if (!mounted) return;
        
        // Transform stage field to use alias if available
        const transformedApplicants = (response.data.applicants || []).map((applicant: any) => {
          if (!applicant.stage || !pipelineStages.length) return applicant;
          
          let stage = null;
          let substage = null;
          
          if (applicant.stageId) {
            stage = pipelineStages.find((s: any) => s.id === applicant.stageId);
            if (stage && applicant.substageId) {
              substage = stage.substages?.find((s: any) => s.id === applicant.substageId);
            }
          }
          
          // Fallback: parse stage string format: "Stage Name - Substage Name"
          if (!stage) {
            const parts = applicant.stage.split(" - ");
            if (parts.length === 2) {
              const [stageName, substageName] = parts;
              stage = pipelineStages.find((s: any) => 
                s.name === stageName || s.alias === stageName
              );
              if (stage) {
                substage = stage.substages?.find((s: any) => s.name === substageName);
              }
            }
          }
          
          if (stage && substage) {
            const stageDisplayName = stage.alias || stage.name;
            return {
              ...applicant,
              stage: `${stageDisplayName} - ${substage.name}`,
            };
          }
          
          return applicant;
        });
        
        setApplicants(transformedApplicants);
        setTotalPages(response.data.totalPages || 1);
        setTotalApplicants(response.data.totalApplicants || 0);
      } catch (err: any) {
        if (!mounted) return;
        // If request was cancelled, don't update state
        if (err?.name === "CanceledError" || err?.name === "AbortError") return;
        
        console.error("Error fetching applicants:", err);
        errorToast("Error fetching applicants", 1300);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchApplicants();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [resolvedCareerId, isCareerConfigLoaded, currentPage, debouncedSearch, filterStatus, filterStage, sortBy, pipelineStages]);

  return {
    resolvedCareerId,
    loading,
    search,
    setSearch,
    sortBy,
    setSortBy,
    filterStatus,
    setFilterStatus,
    filterStage,
    setFilterStage,
    filterStageOptions,
    sortByOptions,
    filterStatusOptions,
    applicants,
    totalPages,
    totalApplicants,
    currentPage,
    setCurrentPage,
  };
}
