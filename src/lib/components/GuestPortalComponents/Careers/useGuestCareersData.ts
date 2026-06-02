import { useState, useEffect } from "react";
import { type CareerItem, type CareerStatus } from "./types";
import { api } from "@/lib/utils/apiClient";

// Transform database career to CareerItem format
function transformCareerData(dbCareer: any): CareerItem {
  // Get job owner name from team members
  const jobOwner = dbCareer.teamMembers?.find((member: any) => member.role === "Job Owner");
  
  // Calculate metrics from candidates/pipeline
  const metrics = {
    ongoing: 0,
    dropped: 0,
    hired: 0,
  };
  
  // Determine status based on career data.
  // Defensive default: if status is missing/unknown, treat as unpublished (On Hold).
  let status: CareerStatus = "On Hold";
  if (dbCareer.status) {
    const rawStatus = String(dbCareer.status).toLowerCase();
    if (rawStatus.includes("inactive")) status = "On Hold";
    else if (rawStatus.includes("hold")) status = "On Hold";
    else if (rawStatus.includes("unpublish")) status = "On Hold";
    else if (rawStatus.includes("draft")) status = "On Hold";
    else if (rawStatus.includes("cancel")) status = "Cancelled";
    else if (rawStatus.includes("complete")) status = "Completed";
    else if (rawStatus.includes("active") || rawStatus.includes("publish")) status = "Active";
  }

  // If candidates exist, calculate metrics (but keep unpublished/on-hold at 0)
  if (
    (status === "Active" || status === "Completed" || status === "Cancelled") &&
    dbCareer.candidates &&
    Array.isArray(dbCareer.candidates)
  ) {
    dbCareer.candidates.forEach((candidate: any) => {
      if (candidate.status === "hired" || candidate.stage?.toLowerCase().includes("hired")) {
        metrics.hired++;
      } else if (candidate.status === "dropped" || candidate.stage?.toLowerCase().includes("dropped")) {
        metrics.dropped++;
      } else {
        metrics.ongoing++;
      }
    });
  }
  
  // Determine employment type (do not invent defaults)
  const employmentType = dbCareer.employmentType?.name || dbCareer.employmentType || null;
  
  // Determine work setup (do not invent defaults)
  const workSetup = dbCareer.workSetup?.name || dbCareer.workSetup || null;
  
  // Format location (do not invent defaults)
  const location = dbCareer.location || (dbCareer.city && dbCareer.province ? `${dbCareer.city}, ${dbCareer.province}` : dbCareer.city || dbCareer.province || null);
  
  // Format posted date (do not invent defaults)
  const postedOn = dbCareer.createdAt ? new Date(dbCareer.createdAt).toISOString().split("T")[0] : null;
  
  return {
    id: dbCareer._id?.toString() || dbCareer.id,
    title: dbCareer.jobTitle || null,
    postedOn,
    jobOwner: jobOwner?.name || null,
    employmentType,
    workSetup,
    location,
    salaryRange: {
      min: dbCareer.minimumSalary !== undefined && dbCareer.minimumSalary !== null && String(dbCareer.minimumSalary).trim() !== "" ? Number.parseInt(String(dbCareer.minimumSalary), 10) : null,
      max: dbCareer.maximumSalary !== undefined && dbCareer.maximumSalary !== null && String(dbCareer.maximumSalary).trim() !== "" ? Number.parseInt(String(dbCareer.maximumSalary), 10) : null,
      currency: dbCareer.currency || null,
    },
    metrics,
    status,
  };
}

export function useCareers(orgId?: string | null) {
  const [data, setData] = useState<CareerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCareers = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Use orgId from parameter, fallback to localStorage
        let orgID = orgId;
        if (!orgID && typeof window !== 'undefined') {
          const guestOrg = localStorage.getItem("guestOrg");
          orgID = guestOrg ? JSON.parse(guestOrg)._id : null;
        }
        
        if (!orgID) {
          console.warn("[useCareers] No orgID available, skipping fetch");
          setData([]);
          setIsLoading(false);
          return;
        }
        
        // Fetch careers from API
        const response = await api.post("/api/fetch-careers", { orgID });
        const careersData = response.data;
        
        // Transform each career to match CareerItem type
        const transformedCareers = careersData.map(transformCareerData);
        
        setData(transformedCareers);
      } catch (err) {
        console.error("Error fetching careers:", err);
        setError(err instanceof Error ? err : new Error("Failed to fetch careers"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchCareers();
  }, [orgId]);

  return { data, isLoading, error };
}

export function useCareerById(id: string, orgId?: string | null) {
  const [data, setData] = useState<CareerItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCareer = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Use orgId from parameter, fallback to localStorage
        let orgID = orgId;
        if (!orgID && typeof window !== 'undefined') {
          const guestOrg = localStorage.getItem("guestOrg");
          orgID = guestOrg ? JSON.parse(guestOrg)._id : null;
        }
        
        // Fetch career from API
        const response = await api.post("/api/career-data", { id, orgID });
        const careerData = response.data;
        
        if (!careerData) {
          throw new Error("Career not found");
        }
        
        // Transform career data to match CareerItem type
        const transformedCareer = transformCareerData(careerData);
        
        setData(transformedCareer);
      } catch (err) {
        console.error("Error fetching career:", err);
        setError(err instanceof Error ? err : new Error("Failed to fetch career"));
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchCareer();
    }
  }, [id, orgId]);

  return { data, isLoading, error };
}
