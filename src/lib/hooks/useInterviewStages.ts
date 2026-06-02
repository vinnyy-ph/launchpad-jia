import { useEffect, useState } from "react";
import { apiClient } from "@/lib/utils/apiClient";

export function useInterviewStages(orgID?: string) {
  const [stages, setStages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgID) {
      setStages([]);
      return;
    }
    setLoading(true);
    setError(null);
    apiClient
      .post("/api/job-portal/fetch-interviews", {
        email: "all",
        interviewID: "all",
        orgID,
      })
      .then((res) => {
        const interviews = res.data || [];
        // Collect all unique stages from interviews
        const allStages = Array.from(
          new Set(
            interviews
              .map((i: any) =>
                typeof i.status === "string"
                  ? i.status
                  : typeof i.stage === "string"
                    ? i.stage
                    : null,
              )
              .filter((s): s is string => !!s) as string[],
          ),
        );
        setStages(allStages);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to fetch interview stages");
        setStages([]);
        setLoading(false);
      });
  }, [orgID]);

  return { stages, loading, error };
}
