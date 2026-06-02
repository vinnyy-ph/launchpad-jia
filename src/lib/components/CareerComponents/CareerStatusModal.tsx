"use client";
import { useEffect, useState } from "react";
import { Button } from "../ui";
import Swal from "sweetalert2";
import { api } from "@/lib/utils/apiClient";
import { candidateActionToast, errorToast } from "@/lib/Utils";
import { CAREER_STATUS_OPTIONS } from "@/lib/utils/constants";
import CustomToolTip from "./CustomToolTip";

export default function CareerStatusModal({ formData, action, onConfirm, onCancel }: { formData: any, action: string, onConfirm: (formData: any) => void, onCancel: () => void }) {
    const [careerStatus, setCareerStatus] = useState<any | null>(null);
    const [jobPostLimitInfo, setJobPostLimitInfo] = useState<
    | {
      maxActiveJobPosts?: number;
      planName?: string;
      schema?: string;
      schemaLabel?: string;
      jobPostType?: string;
      noPlan?: boolean;
    }
    | null
    >(null);
    const actions = {
        "update-status": {
            icon: "la-check-circle",
            iconColor: "#039855",
            iconBgColor: "#D1FADF",
            title: "Update Status",
            description: "Select the current status for this career",
        },
    }

    useEffect(() => {
        if (formData) {
            setCareerStatus({ "Published Status": formData.status, "Activity Status": formData.activityStatus, "Subscription Plan": formData.jobPostType });
        }
    }, [formData]);
    
    const getStatusChangedFields = (): string[] => {
        if (!careerStatus) return [];
        const fields: string[] = [];
        if (careerStatus["Published Status"] !== formData.status) fields.push("status");
        if (careerStatus["Activity Status"] !== formData.activityStatus) fields.push("activityStatus");
        if (careerStatus["Subscription Plan"] !== formData.jobPostType) fields.push("jobPostType");
        return fields;
    };

    const handleUpdate = async () => {
        try {
            Swal.showLoading();
            const statusChangedFields = getStatusChangedFields();
            await api.post("/api/update-career", {
                _id: formData._id,
                status: careerStatus["Published Status"],
                activityStatus: careerStatus["Activity Status"],
                jobPostType: careerStatus["Subscription Plan"],
                statusChangedFields,
            });
            onConfirm({
                status: careerStatus["Published Status"],
                activityStatus: careerStatus["Activity Status"],
                jobPostType: careerStatus["Subscription Plan"],
            });
            candidateActionToast(
              <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginLeft: 8,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
                  Career Status Updated
                </span>
                <span
                  style={{
                    fontSize: 14,
                    color: "#717680",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  Successfully updated status for {formData.jobTitle}.
                </span>
              </div>
            </div>,
            1300,
            <i
              className="la la-check-circle"
              style={{ color: "#039855", fontSize: 32 }}
            ></i>
            );
        } catch (error) {
          const apiResponseData = (error as any)?.response?.data;
          const apiError = apiResponseData?.error;
          const isJobPostLimitError =
            typeof apiError === "string" &&
            apiError.toLowerCase().includes("maximum number of") &&
            apiError.toLowerCase().includes("job");
          const isNoPlanError =
            typeof apiError === "string" &&
            apiError.toLowerCase().includes("does not have");
          if (isJobPostLimitError || isNoPlanError) {
            let errorDetails = apiResponseData?.jobPostLimitInfo || isNoPlanError || apiResponseData?.noPlan;
            setJobPostLimitInfo(errorDetails);
          } else {
            errorToast("Failed to update career status", 1300);
          }
        } finally {
            Swal.close();
        }
    }
    
    const hasChanges = () => {
        if (!careerStatus) return false;
        return Object.keys(careerStatus).some(key => {
            if (key === "Published Status") {
                return careerStatus[key] !== formData.status;
            }
            if (key === "Activity Status") {
                return careerStatus[key] !== formData.activityStatus;
            }
            if (key === "Subscription Plan") {
                return careerStatus[key] !== formData.jobPostType;
            }
            return false;
        });
    }

    return (
        <div className="modal-background fade-in-bottom">
          <div className="modal-container">
            <div
              className="modal-content"
              style={{
                overflowY: "auto",
                maxHeight: "435px",
                maxWidth: "509px",
                background: "#fff",
                border: `1.5px solid #E9EAEB`,
                borderRadius: 14,
                boxShadow: "0 8px 32px rgba(30,32,60,0.18)",
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                }}
              >
                <div
                  style={{
                    border: "1px solid #E9EAEB",
                    borderRadius: "50%",
                    width: "48px",
                    height: "48px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: actions[action]?.iconBgColor,
                  }}
                >
                  <i
                    className={`la ${actions[action]?.icon}`}
                    style={{ fontSize: 24, color: actions[action]?.iconColor }}
                  ></i>
                </div>
                <h3 style={{ fontSize: 18, color: "#181D27", fontWeight: 700 }}>
                  {actions[action].title}
                </h3>
              </div>
              {actions[action]?.description && (
                <span
                  style={{
                    fontSize: 14,
                    color: "#717680",
                    fontWeight: 500,
                    textAlign: "center",
                  }}
                  dangerouslySetInnerHTML={{ __html: actions[action]?.description }}
                ></span>
              )}

              {careerStatus && CAREER_STATUS_OPTIONS.map((option, index) => (
                <div key={index} style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: "100%" }}>
                <span style={{ fontSize: 14, color: "#414651", fontWeight: 500 }}>{option.label}</span>
                <CareerStatusToggle
                options={option.options}
                status={careerStatus[option.label]} 
                onStatusChange={(status) => {
                    setCareerStatus({ ...careerStatus, [option.label]: status });
                }} />
              </div>
              ))}
    
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 16,
                  width: "100%",
                }}
              >
                <Button
                  onClick={() => {
                    onCancel();
                  }}
                  variant="secondary"
                  style={{ width: "100%" }}
                  label="Cancel"
                />
                <Button
                disabled={!hasChanges()}
                  onClick={() => {
                    handleUpdate();
                  }}
                  variant="primary"
                  style={{ width: "100%" }}
                  label="Confirm"
                />
              </div>
              {jobPostLimitInfo && (
                <JobPostLimitInfoModal jobPostLimitInfo={jobPostLimitInfo} onClose={() => setJobPostLimitInfo(null)} />
              )}
            </div>
          </div>
        </div>
      );
}

const CareerStatusToggle = ({ options, status, onStatusChange }: { options: any[], status: string, onStatusChange: (status: string) => void }) => {
    return (
        <div style={{ display: "flex", flexDirection: "row", justifyContent: "flex-end", alignItems: "center", width: "50%", gap: 8 }}>
        {options.map((option, index) => (
            <CustomToolTip key={index} tooltipText={option.tooltipText} position="top-left">
            <div
            onClick={() => onStatusChange(option.value)}
            style={{ 
                display: "flex", 
                alignItems: "center", 
                padding: "8px 12px", 
                borderRadius: "16px", 
                backgroundColor: status === option.value ? option.backgroundColor : "#FAFAFA", 
                border: status === option.value ? option.border : "1px solid #E9EAEB",
                cursor: "pointer",
                }}
            >
                {status === option.value ? <img src={option.icon} alt={option.value} style={{ width: 20, height: 14, fill: "#414651" }} /> 
                : <span
                role="img"
                aria-label={option.value}
                style={{
                    border: "1px solid #E9EAEB",
                    width: 20,
                    height: 14,
                    backgroundColor: "#A4A7AE",
                    maskImage: `url(${option.icon})`,
                    maskSize: "contain",
                    maskRepeat: "no-repeat",
                    maskPosition: "center",
                    WebkitMaskImage: `url(${option.icon})`,
                    WebkitMaskSize: "contain",
                    WebkitMaskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                }}
              />}
            </div>
            </CustomToolTip>
        ))}
        </div>
    )
}

const JobPostLimitInfoModal = ({ jobPostLimitInfo, onClose }: { jobPostLimitInfo: any, onClose: () => void }) => {
  return (
      <div className="modal-background fade-in-bottom" style={{ zIndex: 9999 }}>
        <div className="modal-container">
          <div
            className="modal-content"
            style={{
              width: "fit-content",
              maxWidth: 460,
              background: "#FFFFFF",
              border: "1.5px solid #E9EAEB",
              borderRadius: 24,
              boxShadow: "0 16px 40px rgba(15, 23, 42, 0.2)",
              padding: "36px 40px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: 20,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  backgroundColor: "#FEF3F2",
                  border: "1px solid #FEE4E2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <i
                  className="la la-exclamation-triangle"
                  style={{ color: "#B42318", fontSize: 28 }}
                />
              </div>
              <div>
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#111827",
                    margin: 0,
                    marginBottom: 8,
                  }}
                >
                  {jobPostLimitInfo?.noPlan
                    ? "No Active Plan"
                    : "Active Job Post Limit Reached"}
                </h2>
                <p
                  style={{
                    fontSize: 15,
                    lineHeight: 1.7,
                    color: "#4B5563",
                    margin: 0,
                    marginBottom: 4,
                  }}
                >
                  {jobPostLimitInfo?.noPlan ? (
                    <>
                      This organization does not have an active{" "}
                      {jobPostLimitInfo.jobPostType === "credit-based"
                        ? "Credit-based"
                        : "Premium"}{" "}
                      plan. Please contact your administrator to assign a plan
                      before publishing job posts.
                    </>
                  ) : jobPostLimitInfo?.maxActiveJobPosts && jobPostLimitInfo?.planName ? (
                    <>
                      You've hit your active job post limit (
                      {jobPostLimitInfo.maxActiveJobPosts}) for this{" "}
                      {jobPostLimitInfo.planName} plan (
                      {jobPostLimitInfo.schemaLabel ||
                        (jobPostLimitInfo.jobPostType === "credit-based"
                          ? "Credit-based"
                          : "Premium")}
                      ).
                    </>
                  ) : (
                    <>You've hit your active job post limit for this plan.</>
                  )}
                </p>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 16,
                  width: "100%",
                }}
              >
                <button
                  type="button"
                  onClick={() => onClose()}
                  style={{
                    flex: 1,
                    padding: "12px 18px",
                    borderRadius: 999,
                    border: "1px solid #D5D7DA",
                    backgroundColor: "#FFFFFF",
                    color: "#111827",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
  )
}