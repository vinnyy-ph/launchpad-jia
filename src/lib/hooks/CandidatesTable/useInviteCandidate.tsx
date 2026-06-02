import React, { useCallback } from "react";
import Swal from "sweetalert2";
import { candidateActionToast, errorToast } from "@/lib/Utils";

interface UseInviteCandidateParams {
    orgID: string | null;
}

/**
 * Custom hook that handles candidate invitation functionality
 * Sends email invites to candidates via API
 */
export function useInviteCandidate({ orgID }: UseInviteCandidateParams) {
    const handleInviteCandidate = useCallback(
        async (candidate: any) => {
            try {
                Swal.showLoading();
                const { api } = await import("@/lib/utils/apiClient");
                const response = await api.post("/api/bulk-invite-applicants", {
                    orgID: orgID,
                    emails: [candidate.email],
                });
                if (response.data.error) {
                    throw new Error(response.data.error);
                }
                candidateActionToast(
                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
                                Email invite sent
                            </span>
                            <span style={{ fontSize: 14, color: "#717680", fontWeight: 500, whiteSpace: "nowrap" }}>
                                You have sent an invite to {candidate.email}.
                            </span>
                        </div>
                    </div>,
                    3000,
                    <i className="la la-user-check" style={{ color: "#039855", fontSize: 32 }}></i>
                );
            } catch (error) {
                console.error(error);
                errorToast("Failed to send email invites", 3000);
            } finally {
                Swal.close();
            }
        },
        [orgID]
    );

    return handleInviteCandidate;
}

