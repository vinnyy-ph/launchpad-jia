import { useState, useEffect } from "react";
import { api } from "@/lib/utils/apiClient";
import type { CareerDescriptionData } from "./CareerDescriptionDisplay";

interface UseCareerDescriptionResult {
  data: CareerDescriptionData | null;
  isLoading: boolean;
  error: Error | null;
}

export function useCareerDescription(
  careerId: string,
  orgId?: string | null
): UseCareerDescriptionResult {
  const [data, setData] = useState<CareerDescriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCareerDescription = async () => {
      if (!careerId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Try to get orgID from localStorage if not provided
        let organizationId = orgId;
        if (!organizationId) {
          const guestOrg = localStorage.getItem("guestOrg");
          organizationId = guestOrg ? JSON.parse(guestOrg)._id : null;
        }

        const response = await api.post("/api/career-data", {
          id: careerId,
          orgID: organizationId,
        });

        const careerData = response.data;

        // Map the response to CareerDescriptionData
        const mappedData: CareerDescriptionData = {
          _id: careerData._id,
          jobTitle: careerData.jobTitle,
          description: careerData.description,
          employmentType: careerData.employmentType,
          workSetup: careerData.workSetup,
          country: careerData.country,
          province: careerData.province,
          location: careerData.location,
          minimumSalary: careerData.minimumSalary,
          maximumSalary: careerData.maximumSalary,
          salaryNegotiable: careerData.salaryNegotiable,
          screeningSetting: careerData.screeningSetting,
          cvSecretPrompt: careerData.cvSecretPrompt,
          interviewSecretPrompt: careerData.interviewSecretPrompt,
          requireVideo: careerData.requireVideo,
          walkthroughLanguage: careerData.walkthroughLanguage,
          preScreeningQuestions: careerData.preScreeningQuestions,
          questions: careerData.questions,
          pipelineStages: careerData.pipelineStages,
          teamMembers: careerData.teamMembers,
          createdBy: careerData.createdBy,
        };

        setData(mappedData);
      } catch (err) {
        console.error("Error fetching career description:", err);
        setError(
          err instanceof Error
            ? err
            : new Error("Failed to fetch career description")
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchCareerDescription();
  }, [careerId, orgId]);

  return { data, isLoading, error };
}
