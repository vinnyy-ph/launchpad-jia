import { useState, useEffect } from "react";
import { api } from "@/lib/utils/apiClient";

export function useApplicantAvatar(email: string | undefined, orgId: string | undefined) {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!email || !orgId) {
      setAvatar(null);
      return;
    }

    let mounted = true;

    async function fetchAvatar() {
      try {
        setLoading(true);
        const response = await api.get("/api/applicant/avatar", {
          params: {
            email: email,
            orgId: orgId,
          },
        });

        if (mounted && response.data?.avatar) {
          setAvatar(response.data.avatar);
        }
      } catch (err) {
        console.warn("[useApplicantAvatar] Failed to fetch avatar for email:", email, err);
        setAvatar(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchAvatar();

    return () => {
      mounted = false;
    };
  }, [email, orgId]);

  return { avatar, loading };
}
