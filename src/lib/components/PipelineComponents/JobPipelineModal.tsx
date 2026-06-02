"use client";
import { useEffect, useState } from "react";
import CustomDropdown from "@/lib/components/CareerComponents/CustomDropdown";
import {
  modalTypeMap,
  matchFitCriteriaList,
  autoDropCriteriaList,
} from "./JobPipelineConstants";
import { Button } from "../ui";
import GradientCheckbox from "@/lib/components/GradientCheckbox/GradientCheckbox";



export default function JobPipelineModal({
  onClose,
  onContinue,
  modalType,
  pipelineStages,
  selectedPipeline,
  selectedStage,
  selectedSubstage,
}: {
  onClose: () => void;
  onContinue: (data: any) => void;
  modalType: string;
  pipelineStages: any[];
  selectedPipeline?: any;
  selectedStage?: any;
  selectedSubstage?: any;
}) {
  const [pipelineName, setPipelineName] = useState("");
  const [substageName, setSubstageName] = useState("");
  const [matchFitCriteria, setMatchFitCriteria] = useState("");
  const [autoDropCriteria, setAutoDropCriteria] = useState("");
  const [error, setError] = useState("");
  const [includeAutomations, setIncludeAutomations] = useState(true);

  useEffect(() => {
    if (selectedStage && ["rename-stage"].includes(modalType)) {
      setPipelineName(selectedStage?.alias || selectedStage?.name || "");
    }

    if (selectedSubstage && ["rename-substage"].includes(modalType)) {
      setSubstageName(selectedSubstage?.name || "");
    }
    if (modalType === "auto-endorse") {
      setMatchFitCriteria(selectedStage?.autoEndorse || "");
    }

    if (modalType === "auto-drop") {
      setAutoDropCriteria(selectedStage?.autoDrop || "");
    }
  }, [selectedStage, selectedSubstage, modalType]);


  const validateAutomationSettings = () => {
    if (modalType === "auto-endorse") {
      if (selectedStage?.autoDrop === "Maybe Fit and below") {
        if (matchFitCriteria === "Maybe Fit and above") {
          setError(
            "Auto endorse setting is in conflict with auto drop setting"
          );
          return false;
        }
      }
    }

    if (modalType === "auto-drop") {
      if (selectedStage?.autoEndorse === "Maybe Fit and above") {
        if (autoDropCriteria === "Maybe Fit and below") {
          setError(
            "Auto drop setting is in conflict with auto endorse setting"
          );
          return false;
        }
      }
    }
    setError("");
    return true;
  };

  const getSelectedData = () => {
    // Validate unique name
    if (modalType === "new") {
      const isNameUnique = pipelineStages.every(
        (stage) => stage.name.toLowerCase() !== pipelineName.toLowerCase()
      );
      if (!isNameUnique) {
        setError("Pipeline name already exists");
        return;
      }
      return pipelineName;
    }

    if (modalType === "rename-stage") {
      const isNameUnique = pipelineStages
        .filter((stage) => stage.id !== selectedStage.id)
        .every(
          (stage) => stage.name.toLowerCase() !== pipelineName.toLowerCase()
        );
      if (!isNameUnique) {
        setError("Pipeline name already exists");
        return;
      }
      return pipelineName;
    }
    if (modalType === "new-substage") {
      const isNameUnique = pipelineStages
        .find((stage) => stage.id === selectedStage.id)
        ?.substages.every(
          (substage) =>
            substage.name.toLowerCase() !== substageName.toLowerCase()
        );
      if (!isNameUnique) {
        setError("Substage name already exists");
        return;
      }
      return substageName;
    }

    if (modalType === "rename-substage") {
      const isNameUnique = pipelineStages
        .find((stage) => stage.id === selectedStage.id)
        ?.substages.filter((substage) => substage.id !== selectedSubstage.id)
        .every(
          (substage) =>
            substage.name.toLowerCase() !== substageName.toLowerCase()
        );
      if (!isNameUnique) {
        setError("Substage name already exists");
        return;
      }
      return substageName;
    }

    if (modalType === "copy") {
      return { pipeline: selectedPipeline, includeAutomations };
    }

    if (modalType === "auto-endorse") {
      return matchFitCriteria;
    }

    if (modalType === "auto-drop") {
      return autoDropCriteria;
    }

    if (
      modalType === "delete-stage" ||
      modalType === "delete-substage" ||
      modalType === "restore-default" ||
      modalType === "disable-cv-screening"
    ) {
      return true;
    }
  };

  return (
    <div className="modal-background fade-in-bottom">
      <div className="modal-container">
        <div
          className="modal-content"
          style={{
            overflowY: "auto",
            height: "fit-content",
            width: modalType === "copy" ? "600px" : "400px",
            background: "#fff",
            border: `1.5px solid #E9EAEB`,
            borderRadius: 14,
            boxShadow: "0 8px 32px rgba(30,32,60,0.18)",
            padding: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              textAlign: "center",
            }}
          >
            {modalType === "copy" ? <div style={{ textAlign: "left", alignItems: "flex-start", width: "100%" }}>
              <div
                style={{
                  border: "1.5px solid #E9EAEB",
                  borderRadius: "12px",
                  width: "48px",
                  height: "48px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: modalTypeMap[modalType].iconBgColor,
                }}
              >
                <i
                  className={modalTypeMap[modalType].icon}
                  style={{ fontSize: 24, color: modalTypeMap[modalType].color }}
                ></i>
              </div>
            </div> : <div
              style={{
                border: "1px solid #E9EAEB",
                borderRadius: "50%",
                width: "48px",
                height: "48px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: modalTypeMap[modalType].iconBgColor,
              }}
            >
              <i
                className={modalTypeMap[modalType].icon}
                style={{ fontSize: 24, color: modalTypeMap[modalType].color }}
              ></i>
            </div>}
            {modalType === "copy" ? <div style={{ textAlign: "left", alignItems: "flex-start", width: "100%" }}>
              <h3 className="modal-title">{modalTypeMap[modalType].title}</h3>
            </div> : <h3 className="modal-title">{modalTypeMap[modalType].title}</h3>}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 8,
                width: "100%",
                textAlign: "left"
              }}
            >
              {(modalType === "new" || modalType === "rename-stage") && (
                <>
                  <span
                    style={{ color: "#414651", fontSize: 14, fontWeight: 500 }}
                  >
                    Job pipeline name
                  </span>
                  <input
                    value={pipelineName}
                    className="form-control"
                    placeholder="Enter job pipeline name"
                    onChange={(e) => {
                      setPipelineName(e.target.value || "");
                    }}
                  ></input>
                </>
              )}
              {modalType === "copy" && (
                <>
                  <span
                    style={{ color: "#414651", fontSize: 14, fontWeight: 500 }}
                  >
                    Are you sure you want to copy the{" "}
                    <span style={{ color: "#6172F3", fontWeight: 700 }}>
                      {selectedPipeline.name}
                    </span>{" "}
                    pipeline? The stages and substages from the selected job
                    will be duplicated into your current job.
                  </span>
                  <div
                    style={{
                      width: "100%",
                      height: 1,
                      backgroundColor: "#E9EAEB",
                      margin: "16px 0px",
                    }}
                  />
                  {selectedPipeline.stages.map((stage: any, index: number) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        textAlign: "left",
                        gap: 8,
                        width: "100%",
                      }}
                    >
                      <span style={{ fontSize: 14 }}>
                        {" "}
                        <span style={{ color: "#414651", fontWeight: 700 }}>
                          {stage.name}:
                        </span>{" "}
                        <span style={{ color: "#717680", fontWeight: 500 }}>
                          {stage.substages
                            .map((substage: any) => substage.name)
                            .join(", ")}
                        </span>
                      </span>
                    </div>
                  ))}
                </>
              )}
              {["auto-endorse"].includes(modalType) && (
                <>
                  <span>
                    {
                      "Candidates who meet the selected match fit criteria will be automatically moved to the next stage."
                    }
                  </span>
                  <span
                    style={{ color: "#414651", fontSize: 14, fontWeight: 500 }}
                  >
                    Match fit criteria
                  </span>
                  <CustomDropdown
                    onSelectSetting={(setting) => {
                      setMatchFitCriteria(setting);
                    }}
                    screeningSetting={matchFitCriteria}
                    settingList={matchFitCriteriaList}
                  />
                </>
              )}
              {["auto-drop"].includes(modalType) && (
                <>
                  <span>
                    {
                      "Candidates who failed to meet the selected match fit criteria will be automatically dropped from the current stage."
                    }
                  </span>
                  <span
                    style={{ color: "#414651", fontSize: 14, fontWeight: 500 }}
                  >
                    Match fit criteria
                  </span>
                  <CustomDropdown
                    onSelectSetting={(setting) => {
                      setAutoDropCriteria(setting);
                    }}
                    screeningSetting={autoDropCriteria}
                    settingList={autoDropCriteriaList}
                  />
                </>
              )}
              {(modalType === "new-substage" ||
                modalType === "rename-substage") && (
                <>
                  <span
                    style={{ color: "#414651", fontSize: 14, fontWeight: 500 }}
                  >
                    Substage name
                  </span>
                  <input
                    value={substageName}
                    className="form-control"
                    placeholder="Enter job pipeline name"
                    onChange={(e) => {
                      setSubstageName(e.target.value || "");
                    }}
                  ></input>
                </>
              )}
              {(modalType === "delete-stage" ||
                modalType === "delete-substage" ||
                modalType === "restore-default" ||
                modalType === "disable-cv-screening") && (
                <span
                  style={{ color: "#717680", fontSize: 14, fontWeight: 500 }}
                >
                  {modalTypeMap[modalType].description}
                </span>
              )}
              {error && (
                <span
                  style={{ color: "#D92D20", fontSize: 14, fontWeight: 500 }}
                >
                  {error}
                </span>
              )}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: modalType === "copy" ? "space-between" : "flex-end", // Adjust alignment
                alignItems: "center",
                gap: 16,
                width: "100%",
                marginTop: 8,
              }}
            >
              {modalType === "copy" && (
                <div style={{ flex: 1, display: "flex", justifyContent: "flex-start" }}>
                  <GradientCheckbox
                    checked={includeAutomations}
                    onChange={setIncludeAutomations}
                    label="Include automations"
                  />
                </div>
              )}
              <div style={{ display: "flex", gap: 16, width: modalType === "copy" ? "auto" : "100%", flex: modalType === "copy" ? 0 : 1 }}>
                <Button
                  onClick={() => {
                    // e.preventDefault();
                    onClose();
                  }}
                  variant="secondary"
                  style={{
                    width: modalType === "copy" ? "auto" : "50%",
                    minWidth: "120px",
                  }}
                  label="Cancel"
                >
                </Button>
                <Button
                  onClick={() => {
                    const selectedData = getSelectedData();
                    if (!selectedData) return;
                    if (!validateAutomationSettings()) return;
                    onContinue(selectedData);
                  }}
                  disabled={
                    modalType === "new" ? pipelineName.length === 0 : false
                  }
                  variant={modalTypeMap[modalType].buttonVariant}
                  style={{ 
                    width: modalType === "copy" ? "auto" : "50%",
                    minWidth: "140px",
                  }}
                  label={modalTypeMap[modalType].confirmButtonText}
                  >
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
