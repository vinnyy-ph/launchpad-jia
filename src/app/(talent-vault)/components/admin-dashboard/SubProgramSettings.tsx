"use client";

import React from "react";
import ReviewProgram from "@/app/(talent-vault)/components/admin-dashboard/ReviewProgram";

type SubProgramSettingsProps = {
  subprogram: {
    _id: string;
    title?: string;
    roleType?: string;
    secretPrompt?: string;
    preScreeningQuestions?: any[];
    interview?: {
      requireVideo?: boolean;
      aiInterviewLanguage?: string;
      voice?: string;
      walkthroughLanguage?: string;
      interviewSecretPrompt?: string;
      questions?: any[];
    };
    [key: string]: any;
  };
  onEditStep: (stepIndex: number) => void;
};

export default function SubProgramSettings({
  subprogram,
  onEditStep,
}: SubProgramSettingsProps) {
  const normalizedPreScreeningQuestions = Array.isArray(subprogram.preScreeningQuestions)
    ? subprogram.preScreeningQuestions.map((question: any) => ({
        ...question,
        answers: Array.isArray(question?.answers) ? question.answers : [],
      }))
    : [];

  const normalizedInterviewQuestions = Array.isArray(subprogram.interview?.questions)
    ? subprogram.interview.questions.map((group: any) => ({
        ...group,
        category: typeof group?.category === "string" ? group.category : "",
        questions: Array.isArray(group?.questions) ? group.questions : [],
      }))
    : [];

  const interviewForm = {
    requireVideo: Boolean(subprogram.interview?.requireVideo),
    aiInterviewLanguage:
      typeof subprogram.interview?.aiInterviewLanguage === "string" &&
      subprogram.interview.aiInterviewLanguage.trim()
        ? subprogram.interview.aiInterviewLanguage
        : "English",
    voice:
      typeof subprogram.interview?.voice === "string" &&
      subprogram.interview.voice.trim()
        ? subprogram.interview.voice
        : "alloy",
    walkthroughLanguage:
      subprogram.interview?.walkthroughLanguage === "tagalog" ? "tagalog" : "english",
    interviewSecretPrompt:
      typeof subprogram.interview?.interviewSecretPrompt === "string"
        ? subprogram.interview.interviewSecretPrompt
        : "",
    questions: normalizedInterviewQuestions,
  };

  const resolvedWalkthroughLanguage: "english" | "tagalog" =
    interviewForm.walkthroughLanguage === "tagalog" ? "tagalog" : "english";

  const programTitle = typeof subprogram.title === "string" ? subprogram.title : "";
  const roleType = typeof subprogram.roleType === "string" ? subprogram.roleType : "";
  const secretPrompt = typeof subprogram.secretPrompt === "string" ? subprogram.secretPrompt : "";

  return (
    <div style={{ marginTop: "32px" }}>
      <div>
        <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#181D27", margin: 0 }}>
          Program Settings
        </h1>
      </div>

      <div style={{ display: "flex", flexDirection: "row", gap: 16, width: "100%" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <ReviewProgram
            fullWidth={true}
            programTitle={programTitle}
            roleType={roleType}
            secretPrompt={secretPrompt}
            preScreeningQuestions={normalizedPreScreeningQuestions}
            interviewForm={interviewForm}
            resolvedWalkthroughLanguage={resolvedWalkthroughLanguage}
            setCurrentStep={onEditStep}
          />
        </div>

        <div
          className="layered-card-outer"
          style={{
            width: "30%",
            position: "sticky",
            top: "16px",
            alignSelf: "flex-start",
          }}
        >
          <div className="layered-card-middle">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <i
                className="la la-lightbulb-o"
                style={{
                  fontSize: 28,
                  background:
                    "linear-gradient(135deg, #E9A5C9 0%, #C8B5DA 50%, #9FCAED 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              ></i>
              <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>
                Tips
              </span>
            </div>
            <div className="layered-card-content">
              <p
                style={{
                  fontSize: 14,
                  lineHeight: "1.6",
                  margin: 0,
                }}
              >
                <span style={{ fontWeight: 700, color: "#181D27" }}>
                  Add pre-screening questions
                </span>
                <span style={{ color: "#717680" }}>
                  {" "}
                  to collect key details such as notice period, work setup, or salary
                  expectations to guide your review and candidate discussions.
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
