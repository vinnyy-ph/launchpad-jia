"use client"
import { useState } from "react";
import AvatarImage from "../AvatarImage/AvatarImage";
import CareerFit from "./CareerFit";
import RecruiterEvaluationModal from "./RecruiterEvaluationModal";
// import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import { errorToast } from "../../Utils";
import { useAppContext } from "@/lib/context/AppContext";
import FullScreenLoadingAnimation from "./FullScreenLoadingAnimation";
import { Tooltip } from "react-tooltip";
import { Button } from "../ui";

export default function RecruiterEvaluation({ evaluation, enableEdit = false, onAction, interview }: { evaluation: any, enableEdit?: boolean, onAction?: (action: string, data?: any) => void, interview: any }) {
    const [showModal, setShowModal] = useState<string>("");
    const { user } = useAppContext();
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const handleModal = (action: string) => {
        setShowModal(action);
    }

    const handleAction = async (action: string, data?: any) => {
        setShowModal("");
        if (!data) return;
        // TODO: Add API call to update evaluation
        if (action === "edit") {
            const updatedEvaluation = {
                matchFit: data?.matchFit,
                evaluationNotes: data?.evaluationNotes,
                updatedBy: {
                    image: user?.image,
                    name: user?.name,
                    email: user?.email,
                },
            };
            try {
                setIsLoading(true);
                const response = await api.post("/api/update-recruiter-evaluation", {
                    evaluationID: evaluation?._id,
                    update: updatedEvaluation,
                });
                if (response.status === 200) {
                    onAction(action, {...evaluation, ...updatedEvaluation});
                }
            } catch (error) {
                console.log(error);
                errorToast("Failed to update evaluation", 1300);
            } finally {
                setIsLoading(false);
            }
        }

        if (action === "add") {
            const newEvaluation = {
                interviewUID: interview?._id,
                matchFit: data?.matchFit,
                evaluationNotes: data?.evaluationNotes,
                updatedBy: {
                    image: user?.image,
                    name: user?.name,
                    email: user?.email,
                },
                createdBy: {
                    image: user?.image,
                    name: user?.name,
                    email: user?.email,
                },
                stageId: interview?.evaluationStageId,
                substageId: interview?.evaluationSubstageId,
                action: "Endorsed",
            }
            try {
                setIsLoading(true);
                const response = await api.post("/api/add-recruiter-evaluation", {
                    recruiterEvaluation: newEvaluation,
                });
                if (response.status === 200) {
                    onAction(action, newEvaluation);
                }
            } catch (error) {
                console.log(error);
                errorToast("Failed to add evaluation", 1300);
            } finally {
                setIsLoading(false);
            }
        }

        if (action === "delete") {
            try {
                setIsLoading(true);
                const response = await api.post("/api/delete-evaluation", {
                    evaluationId: evaluation?._id,
                });
                if (response.status === 200) {
                    onAction(action, null);
                }
            } catch (error) {
                console.log(error);
                errorToast("Failed to delete evaluation", 1300);
            } finally {
                setIsLoading(false);
            }
        }

    }

    const eligibleToAddEvaluation = () => {
        const currentStageIndex = interview?.pipelineStages?.findIndex((stage) => stage.id === interview?.stageId);
        const evaluationStageIndex = interview?.pipelineStages?.findIndex((stage) => stage.id === interview?.evaluationStageId);
        if (currentStageIndex !== -1 && evaluationStageIndex !== -1) {
            return currentStageIndex >= evaluationStageIndex;
        }

        return true;
    }
    
    return (
        <>
        <div 
        style={{ 
            display: "flex", 
            flexDirection: "column", 
            alignItems: "flex-start", 
            gap: 8, 
            background: evaluation ? "#FFFCF5" : "#FFFFFF", 
            borderRadius: evaluation ? "12px" : "32px",
            border: evaluation ? "1px solid #FEEFC7" : "1px solid #E9EAEB", 
            padding: "16px 10px 10px",
            width: "100%",
            marginBottom: 16,
            }}
        >
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
               <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 16 }}>
               {evaluation?.updatedBy?.image ? <AvatarImage src={evaluation?.updatedBy?.image} /> :
               <div style={{ width: 32, height: 32, backgroundColor: "#181D27", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
               <i className="la la-file-alt" style={{ color: "#FFFFFF", fontSize: 20 }}></i>
                </div>}
                <span style={{ fontSize: 18, color: "#181D27", fontWeight: 700 }}>Evaluation by {evaluation?.updatedBy?.name || "Recruiter"}</span>
                {evaluation?.matchFit && <CareerFit fit={evaluation?.matchFit} assessment={evaluation?.evaluationNotes} candidateDetails={interview} evaluatorName={evaluation?.updatedBy?.name ? evaluation?.updatedBy?.name?.split(" ")[0] : "N/A"} />}
               </div>
               {enableEdit && (
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {evaluation ? (<div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <button style={{ color: "#B42318", border: "1px solid #B42318", borderRadius: "50%", background: "#FFFFFF", padding: "5px", cursor: "pointer", width: "fit-content", display: "flex", alignItems: "center", gap: 8 }} onClick={() => handleModal("delete")} >
                            <i className="la la-trash" style={{ fontSize: 20, color: "#B42318" }}></i>
                        </button>
                        <button style={{ color: "#414651", border: "1px solid #D5D7DA", borderRadius: 8, background: "#FFFFFF", padding: "8px 12px", cursor: "pointer", width: "fit-content", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }} onClick={() => handleModal("edit")} >
                            <i className="la la-pencil" style={{ fontSize: 18, color: "#414651" }}></i>
                            Edit Evaluation
                        </button>
                    </div>) : (
                    <a 
                    data-tooltip-id="add-evaluation-tooltip"
                    data-tooltip-html={`You can only add an evaluation once the candidate has reached this stage.`}
                    >
                    <Button
                    variant="primary"
                    // Disable if candidate has not reached the evaluation stage
                    disabled={!eligibleToAddEvaluation()}
                    onClick={() => handleModal("add")}
                    label="Add Evaluation"
                    icon="/icons/plus.svg"
                    >
                    </Button>
                    </a>)}
                </div>
               )}
            </div>
            {evaluation?.evaluationNotes && ( 
                enableEdit ?
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: "12px", background: "#FFFFFF", border: "1px solid #E9EAEB", padding: "16px", width: "100%" }}>
                    <p style={{ fontSize: 16, color: "#414651", fontWeight: 500 }} dangerouslySetInnerHTML={{ __html: evaluation?.evaluationNotes || "No evaluation notes" }}></p>
                </div>
             : <p style={{ fontSize: 16, color: "#414651", fontWeight: 500 }} dangerouslySetInnerHTML={{ __html: evaluation?.evaluationNotes || "No evaluation notes" }}></p>)}
        </div>
        {showModal && <RecruiterEvaluationModal evaluation={evaluation} action={showModal} onAction={handleAction} />}
        {isLoading && <FullScreenLoadingAnimation title={`${!evaluation ? "Adding" : "Updating"} Evaluation`} subtext={`Please wait while we ${!evaluation ? "add" : "update"} the evaluation`} />}
        {!eligibleToAddEvaluation() && <Tooltip className="add-evaluation-tooltip fade-in" id="add-evaluation-tooltip"/>}
        </>
    )
}