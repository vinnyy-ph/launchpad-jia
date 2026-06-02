"use client";

import React from "react";
import { OrgFormStep } from "@/lib/types/orgForm";

interface OrgFormStepsProps {
  steps: OrgFormStep[];
  currentStep: number;
  accomplishedStep: number;
  hasProgress: boolean;
  validationErrors: Record<string, boolean>;
  onStepClick: (stepIndex: number) => void;
}

export default function OrgFormSteps({
  steps,
  currentStep,
  accomplishedStep,
  hasProgress,
  validationErrors,
  onStepClick,
}: OrgFormStepsProps) {
  const hasErrors = Object.keys(validationErrors).length > 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
      }}
    >
      {steps.map((step, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 8,
            position: "relative",
            flex: index === steps.length - 1 ? "0 0 auto" : "1 1 0",
            maxWidth: index === steps.length - 1 ? "150px" : "none",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            {/* Step Indicator */}
            {hasErrors && currentStep === index ? (
              <i
                className="la la-exclamation-triangle"
                style={{ color: "#EF4444", fontSize: 24 }}
              />
            ) : step.completed ? (
              <div
                style={{
                  border: "1px solid #000000",
                  backgroundColor: "#000000",
                  borderRadius: "50%",
                  padding: "4px",
                  height: "24px",
                  width: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <i className="la la-check" style={{ color: "#FFFFFF", fontSize: 20 }} />
              </div>
            ) : (
              <div
                style={{
                  border: `1px solid ${accomplishedStep === index ? "#000000" : "#D5D7DA"}`,
                  borderRadius: "50%",
                  padding: "4px",
                  height: "24px",
                  width: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    backgroundColor: accomplishedStep === index ? "#000000" : "#D5D7DA",
                    borderRadius: "50%",
                  }}
                />
              </div>
            )}

            {/* Progress Bar Between Steps */}
            {index !== steps.length - 1 && (
              <div
                style={{
                  width: "calc(100% - 48px)",
                  height: "5px",
                  background: "#E9EAEB",
                  backgroundColor: "#E9EAEB",
                  position: "absolute",
                  top: "12px",
                  left: "36px",
                  right: "12px",
                  transform: "translateY(-50%)",
                }}
              >
                {currentStep >= index && (
                  <div
                    style={{
                      width:
                        currentStep > index ? "100%" : hasProgress ? "50%" : "0%",
                      height: "5px",
                      background:
                        currentStep > index || hasProgress
                          ? "linear-gradient(90deg, #9fcaed 0%, #ceb6da 33%, #ebacc9 66%, #fccec0 100%)"
                          : "#E9EAEB",
                      backgroundColor:
                        currentStep > index || hasProgress ? "transparent" : "#E9EAEB",
                      position: "absolute",
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                  />
                )}
              </div>
            )}
          </div>

          {/* Step Name */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              cursor:
                step.completed || index === accomplishedStep ? "pointer" : "not-allowed",
            }}
            onClick={() => onStepClick(index)}
          >
            <span
              style={{
                fontSize: 16,
                color:
                  step.completed || index === accomplishedStep ? "#181D27" : "#717680",
                fontWeight: 700,
              }}
            >
              {step.name}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

