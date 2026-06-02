"use client";
// import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import { decodeHtmlEntities } from "@/lib/utils/sanitizeInput";
import { useEffect, useState } from "react";
import Swal from "sweetalert2";

export default function CandidateHistory({ candidate, setShowCandidateHistory }: any) {
    const [isLoading, setIsLoading] = useState(false);
    const [interviewLogs, setInterviewLogs] = useState([]);

    useEffect(() => {
        const fetchInterviewLogs = async () => {
            try {
                setIsLoading(true);
                const response = await api.get(`/api/get-interview-history?interviewUID=${candidate._id}`);
                setInterviewLogs(response.data);
            } catch (error) {
                console.log(error);
                Swal.fire({
                    title: "Error",
                    text: "Failed to fetch interview history",
                    icon: "error",
                });
            } finally {
                setIsLoading(false);
            }
        }
        fetchInterviewLogs();
    }, [candidate._id])

    const toPlainText = (value: any) => {
        if (!value || typeof value !== "string") return "";
        return decodeHtmlEntities(value)
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim();
    };

    const getDroppedReason = (log: any) => {
        const fromStage = `${log?.fromStage || ""}`.toLowerCase();
        const isCVScreeningDrop = fromStage.includes("cv screening");
        if (!isCVScreeningDrop) return "";

        const reasonCandidates = [
            log?.dropReason,
            log?.reason,
            log?.cvScreeningReason,
            log?.applicationMetadata?.reason,
            candidate?.cvScreeningReason,
            candidate?.applicationMetadata?.reason,
        ];

        const reason = reasonCandidates
            .map(toPlainText)
            .find((text) => text.length > 0);

        return reason || "";
    };

    const getLogDescription = (log: any) => {
        if (log.action === "Direct Link Promotion") {
            return `This candidate entered the ${log.toStage} stage from direct interview link.`;
        }

        if (log.action === "Applied") {
            return `${log.action} to this job posting.`;
        }

        if (log.action === "Cancelled") {
            const reason = candidate.selectedReason === "Others" ? candidate.cancelReason : candidate.selectedReason;
            return `${log.action} the application at ${log.fromStage} stage for this following reason: ${reason || "No reason provided"}`
        }

        if (log.action === "Invited") {
            return `${log.action} ${candidate.name} from ${log.invitedFrom?.careerTitle || "Unknown"}` + (log.toStage ? ` to ${log.toStage}` : "");
        }

        if (log.action === "Queued for Auto-Drop") {
            const reason = toPlainText(log.reason || candidate?.preScreeningAutoDrop?.reason);
            const scheduledAt = log?.scheduledAt
                ? new Date(log.scheduledAt).toLocaleString()
                : candidate?.preScreeningAutoDrop?.scheduledAt
                    ? new Date(candidate.preScreeningAutoDrop.scheduledAt).toLocaleString()
                    : "";

            let description = `Queued ${candidate.name} for automatic disqualification from ${log.fromStage || "CV Screening"}`;
            if (scheduledAt) {
                description += `.\nScheduled For: ${scheduledAt}`;
            }
            if (reason) {
                description += `\nReason: ${reason}`;
            }
            return description;
        }

        if (log.action === "Dropped") {
            const baseDescription = `${log.action} ${candidate.name} from ${log.fromStage}` + (log.toStage ? ` to ${log.toStage}` : "");
            const droppedReason = getDroppedReason(log);

            if (!droppedReason) {
                return baseDescription;
            }

            if (
                droppedReason.includes("auto-disqualify candidate in pre-screening") ||
                droppedReason.includes("auto-disqualification rule")
            ) {
                return `${baseDescription}. The candidate is auto-filtered during pre-screening.`;
            }

            return `${baseDescription}. ${droppedReason}`;
        }

        return `${log.action} ${candidate.name} from ${log.fromStage}` + (log.toStage ? ` to ${log.toStage}` : "");
    }
    return (
        <div className="modal-background fade-in-bottom">
            <div className="modal-container">
                <div className="modal-content" style={{ overflowY: "auto", maxHeight: "80vh", maxWidth: "80vw", background: "#fff", border: `1.5px solid #E9EAEB`, borderRadius: 14, boxShadow: "0 8px 32px rgba(30,32,60,0.18)" }}>
                    <div className="modal-header">
                        <h3 className="modal-title">Candidate History</h3>
                        <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setShowCandidateHistory(false)}>
                            <i className="la la-times"></i>
                        </button>
                    </div>
                    <div className="modal-body">
                        {isLoading ?
                            Array.from({ length: 3 }).map((_, index) => (
                                <div key={index} className="mb-3" style={{ marginTop: 16 }}>
                                    <div className="skeleton-bar" style={{ width: "100%", height: "20px" }}></div>
                                </div>
                            )) : interviewLogs.length > 0 ?
                                <div className="table-responsive" style={{ height: "100%" }}>
                                    <table className="table align-items-center table-flush" style={{ border: "1px solid #E9EAEB", borderRadius: 8 }}>
                                        <thead className="thead-light">
                                            <tr>
                                                <th scope="col" className="sort" data-sort="name" style={{ textTransform: "none", fontWeight: 550 }}>
                                                    Admin/Candidate
                                                </th>
                                                <th scope="col" className="sort" data-sort="description" style={{ textTransform: "none", fontWeight: 550 }}>
                                                    Description
                                                </th>
                                                <th scope="col" className="sort" data-sort="date-of-action" style={{ textTransform: "none", fontWeight: 550 }}>
                                                    Date of Action
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {interviewLogs.map((log: any) => (
                                                <tr key={log._id}>
                                                    <td>{log.updatedBy?.name || "N/A"}</td>
                                                    <td style={{ whiteSpace: "pre-wrap" }}>{getLogDescription(log)}</td>
                                                    <td>{log.createdAt ? new Date(log.createdAt).toLocaleString() : "N/A"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                : <div style={{ display: "flex", justifyContent: "center" }}>
                                    <h3 style={{ color: "#787486" }}>No Candidate History Found</h3>
                                </div>}
                    </div>
                </div>
            </div>
        </div>
    )
}
