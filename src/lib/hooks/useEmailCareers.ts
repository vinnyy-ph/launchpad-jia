import { useEffect, useState } from "react";
import { api } from "@/lib/utils/apiClient";

export function useEmailCareers(orgID?: string) {
  const [careers, setCareers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let resolvedOrgID = orgID;
    if (!resolvedOrgID && typeof window !== "undefined") {
      const activeOrgRaw = localStorage.getItem("activeOrg");
      if (activeOrgRaw) {
        try {
          const activeOrg = JSON.parse(activeOrgRaw);
          resolvedOrgID = activeOrg?._id || activeOrg?.id || undefined;
        } catch (e) {}
      }
    }
    if (!resolvedOrgID) {
      setCareers([]);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .post("/api/fetch-careers", { orgID: resolvedOrgID })
      .then((res) => {
        const data = res.data;
        if (Array.isArray(data)) {
          setCareers(data.filter((c) => c && c.id && c.jobTitle));
        } else {
          setCareers([]);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to fetch careers");
        setCareers([]);
        setLoading(false);
      });
  }, [orgID]);

  return { careers, loading, error };
}
