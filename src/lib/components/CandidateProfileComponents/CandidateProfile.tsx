"use client";

import styles from "@/lib/styles/candidate-profile.module.scss";
import ProfileHeader from "./ProfileHeader";
import { useEffect, useMemo, useState } from "react";
import CareerFit from "../CareerComponents/CareerFit";
import SectionCard from "./SectionCard";
import Markdown from "react-markdown";
import { getCVSection, parseSkillsFromMarkdown } from "@/lib/Utils";
import CircularProgress from "../CandidateComponents/CircularProgress";
import LoadingAnimation from "../Loaders/LoadingAnimation";
import { SkillTag } from "@/lib/components/CandidateComponents/SkillTag";
import {
  Message,
  TranscriptMessage,
} from "./AIInterviewSection/TranscriptMessage";
import {
  QualitiesBreakdownItem,
  type QualityBreakdown,
} from "./AIInterviewSection/QualitiesBreakdownItem";
import { useCandidateProfileData } from "@/lib/hooks/useCandidateProfileData";
import {
  breakdownColorScheme,
  breakdownIcon,
  formatDate,
  getInterviewDuration,
  hasBreakdown,
  type StageTab,
  type InterviewData,
} from "@/lib/components/CandidateProfileComponents/candidateProfileUtils";
import StageAttachments from "@/lib/components/CareerComponents/StageAttachments";

function isStageAfterAIInterview(
  pipelineStages: InterviewData["pipelineStages"] | undefined,
  activeStageId: string | undefined
): boolean {
  if (!pipelineStages || !activeStageId) return false;
  const aiIdx = pipelineStages.findIndex((s) => s.id === "2");
  const activeIdx = pipelineStages.findIndex((s) => s.id === activeStageId);
  return aiIdx >= 0 && activeIdx > aiIdx;
}

export default function CandidateProfile({ assessment }) {
  const {
    data,
    isLoading,
    error,
    applicantName,
    fullName,
    nameVisibility,
    stages,
    defaultActiveTab,
  } = useCandidateProfileData(assessment);
  const [activeTab, setActiveTab] = useState<string>("");
  const showContactDetails =
    typeof assessment.showContactDetails === "boolean"
      ? assessment.showContactDetails
      : Boolean(assessment.isContactVisible);
  const showDisplayPhoto =
    typeof assessment.showDisplayPhoto === "boolean"
      ? assessment.showDisplayPhoto
      : true;
  const showJiaAssessments =
    typeof assessment.showJiaAssessments === "boolean"
      ? assessment.showJiaAssessments
      : true;
  const showRecruiterAssessments =
    typeof assessment.showRecruiterAssessments === "boolean"
      ? assessment.showRecruiterAssessments
      : true;
  const candidateProfileImage =
    showDisplayPhoto && data.interviewData?.image
      ? data.interviewData.image
      : "/user-profile.png";
  const isPreviewMode = Boolean(assessment.previewToken);

  const digitalCVSections = Array.isArray(data.cvData?.data?.digitalCV)
    ? data.cvData.data.digitalCV
    : null;
  const safeTranscripts = data.transcripts ?? [];

  const skillsSection = digitalCVSections?.find(
    (section) => section.name.toLowerCase() === "skills"
  );
  const skills = useMemo(
    () => parseSkillsFromMarkdown(skillsSection?.content || ""),
    [skillsSection]
  );
  const visibleCVSections = useMemo(
    () =>
      (digitalCVSections ?? []).filter((section) => {
        if (section.name === "Contact Info" || section.name === "Skills") {
          return false;
        }
        return Boolean(section.content?.trim());
      }),
    [digitalCVSections]
  );
  const contactInfoContent = useMemo(
    () => getCVSection(digitalCVSections, "Contact Info")?.trim() || "",
    [digitalCVSections]
  );

  const jiaIcon = (
    <img src="/jia-dashboard-logo.png" alt="Jia Logo" width={24} height={24} />
  );
  const stageEntries = Object.entries(stages) as Array<[string, StageTab]>;
  const activeStage = activeTab ? stages[activeTab] : null;

  const activeStageAttachments = useMemo(() => {
    if (!activeStage) return [];
    const bucket = data.interviewData?.stageAttachments?.find(
      (b) =>
        b.stageId === activeStage.stageId &&
        b.substageId === activeStage.substageId
    );
    return bucket?.attachments ?? [];
  }, [activeStage, data.interviewData?.stageAttachments]);

  useEffect(() => {
    if (!defaultActiveTab) {
      return;
    }

    setActiveTab((prevTab) =>
      prevTab === defaultActiveTab ? prevTab : defaultActiveTab
    );
  }, [defaultActiveTab]);

  const showContent = data.interviewData && applicantName;

  return (
    <>
      {isPreviewMode && (
        <div className={styles.previewBanner}>
          <i className="la la-eye" aria-hidden="true" />
          <span>This is a temporary preview of the shared profile and will expire in 10 minutes.</span>
        </div>
      )}

     <div className={styles.brand}>
        {data.orgData?.image ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img
              src={data.orgData.image}
              alt="Organization Logo"
              width={64}
              height={64}
              style={{ borderRadius: "4px", objectFit: "contain", backgroundColor: "transparent", mixBlendMode: "multiply" }}
            />
            {data.orgData.name && (
              <span style={{ fontSize: "16px", fontWeight: 500, color: "#181D27" }}>
                {data.orgData.name}
              </span>
            )}
          </div>
        ) : (
          jiaIcon
        )}
      </div>

      <main className={styles.candidateProfile}>
        {error ? (
          <SectionCard title="Unable to load candidate">
            <div className={styles.evalNotes}>
              Something went wrong while fetching the candidate profile.
            </div>
          </SectionCard>
        ) : !showContent || isLoading ? (
          <LoadingAnimation
            text="Loading"
            subtext="Fetching assessment analysis"
          />
        ) : (
          <>
            {data.interviewData && data.orgData && (
              <ProfileHeader
                user={{ name: applicantName, image: candidateProfileImage }}
                jobTitle={data.interviewData.jobTitle}
                company={{ name: data.orgData.name, image: data.orgData.image }}
              />
            )}

            <div className="career-tab-container" style={{ marginTop: "16px" }}>
              <div className={`${styles.tabs}`}>
                {stageEntries.map(([stageKey, stageDetails]) => {
                  const stage = data.interviewData?.pipelineStages?.find((s: any) => s.id === stageDetails.stageId);
                  const displayLabel = stage?.alias || stageDetails.label;
                  const shouldShowStageBadge =
                    stageDetails.stageId === "1" || stageDetails.stageId === "2"
                      ? showJiaAssessments
                      : showRecruiterAssessments;
                  
                  return (
                    <div
                      key={stageKey}
                      className={`${styles.tabItem} ${
                        activeTab === stageDetails.label ? styles.active : ""
                      }`}
                      onClick={() => setActiveTab(stageDetails.label)}
                    >
                      {stageDetails.icon && (
                        <i
                          className={stageDetails.icon}
                          style={{ fontSize: 24 }}
                        />
                      )}
                      {displayLabel}{" "}
                      {shouldShowStageBadge && (
                        <CareerFit fit={stageDetails.fit} assessment={stageDetails.humanEvaluation || stageDetails.aiEvaluation} candidateDetails={data.interviewData} evaluatorName={"Jia"} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                marginTop: 16,
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {activeStage?.stageId === "1" && (
                <>
                  {showJiaAssessments && (
                    <SectionCard
                      title="Evaluation by Jia"
                      icon={jiaIcon}
                      badge={<CareerFit fit={data.interviewData.cvStatus} assessment={data.interviewData.cvScreeningReason} candidateDetails={data.interviewData} evaluatorName={"Jia"} />}
                    >
                      <div className={styles.evalNotes}>
                        <p
                          dangerouslySetInnerHTML={{
                            __html:
                              data.interviewData.cvScreeningReason ||
                              "No evaluation notes",
                          }}
                        />
                      </div>
                    </SectionCard>
                  )}

                  {digitalCVSections ? (
                    <div style={{ display: "flex", gap: "24px" }}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          flex: "2",
                          gap: "24px",
                        }}
                      >
                        {visibleCVSections.map((section) => (
                            <SectionCard
                              title={section.name}
                              key={section.name}
                            >
                              <div className={styles.evalNotes}>
                                  <Markdown>{section.content}</Markdown>
                              </div>
                            </SectionCard>
                          ))}
                      </div>

                      <div style={{ flex: "1", display: "flex", flexDirection: "column", gap: "24px" }}>
                        {showContactDetails && Boolean(contactInfoContent) && (
                          <SectionCard title="Contact Information">
                            <div className={styles.evalNotes}>
                              <Markdown>{contactInfoContent}</Markdown>
                            </div>
                          </SectionCard>
                        )}

                        {skills && skills.length > 0 && (
                          <SectionCard title="Skills">
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                {skills.map((skill: string, idx: number) => (
                                    <SkillTag key={idx} label={skill} size="md" />
                                ))}
                            </div>
                          </SectionCard>
                        )}
                      </div>
                    </div>
                  ) : (
                    <SectionCard title="Candidate CV">
                      <div className={styles.evalNotes}>
                        CV data unavailable
                      </div>
                    </SectionCard>
                  )}
                </>
              )}

              {activeStage?.stageId === "2" && (
                <>
                  <div style={{ display: "flex", gap: "24px" }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        flex: "2",
                        gap: "24px",
                      }}
                    >
                      {showJiaAssessments && (
                        <>
                          <SectionCard title="Evaluation by Jia" icon={jiaIcon}>
                            <div style={{ display: "flex", gap: "32px" }}>
                              {data.interviewData.analysis && (
                                <>
                                  <CircularProgress
                                    percentage={
                                      data.interviewData.analysis.overall_score
                                    }
                                    size={160}
                                    strokeWidth={15}
                                    showLabel={true}
                                    label="Overall Score"
                                    fontSize={20}
                                    labelFontSize={10}
                                  />
                                  <div className={styles.evalNotes}>
                                    <CareerFit
                                      fit={
                                        data.interviewData.jobFit
                                      }
                                      assessment={data.interviewData.analysis.final_assessment}
                                      candidateDetails={data.interviewData}
                                      evaluatorName={"Jia"}
                                    />
                                    <p style={{ paddingTop: "8px" }}>
                                      {data.interviewData.analysis
                                        .assessment_reason || "No evaluation notes"}
                                    </p>
                                  </div>
                                </>
                              )}
                            </div>

                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "16px",
                                marginTop: "32px",
                              }}
                            >
                              <h3>Applicant Qualities Breakdown</h3>

                              {hasBreakdown(data.interviewData.analysis) && (
                                <div>
                                  {data.interviewData.analysis?.breakdown?.map(
                                    (breakdown: QualityBreakdown, idx: number) => (
                                      <QualitiesBreakdownItem
                                        key={breakdown.key}
                                        breakdown={breakdown}
                                        icon={breakdownIcon[idx]}
                                        progressBarColor={breakdownColorScheme[idx]}
                                      />
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          </SectionCard>

                          <SectionCard
                            title="Interview Summary"
                            icon={
                              <div className={styles.blackIconWrapper}>
                                <i className="la la-file-alt" />
                              </div>
                            }
                          >
                            <div className={styles.evalNotes}>
                              <Markdown>{data.interviewData.summary}</Markdown>
                            </div>
                          </SectionCard>
                        </>
                      )}

                      <SectionCard
                        title="Interview Transcript"
                        icon={
                          <div className={styles.blackIconWrapper}>
                            <i className="la la-microphone" />
                          </div>
                        }
                        badge={
                          safeTranscripts.length > 0 && (
                            <div className={styles.durationBadge}>
                              Duration:{" "}
                              {getInterviewDuration(
                                safeTranscripts[0].time,
                                safeTranscripts[safeTranscripts.length - 1].time
                              )}
                            </div>
                          )
                        }
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "16px",
                          }}
                        >
                          {safeTranscripts.length > 0 ? (
                            safeTranscripts.map((msg: Message, idx: number) => (
                              <TranscriptMessage
                                key={msg.time}
                                applicantName={applicantName}
                                message={{ idx, ...msg }}
                                prevMsg={safeTranscripts[idx - 1]}
                                fullName={fullName}
                                nameVisibility={nameVisibility}
                              />
                            ))
                          ) : (
                            <div className={styles.evalNotes}>
                              No transcript available
                            </div>
                          )}
                        </div>
                      </SectionCard>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        flex: "1",
                        gap: "24px",
                      }}
                    >
                      <SectionCard
                        title={
                          data.interviewRecording &&
                          data.interviewRecording?.filetype.includes("audio")
                            ? "Audio Recording"
                            : "Video Recording"
                        }
                        icon={
                          <div className={styles.blackIconWrapper}>
                            <i
                              className={`la la-${
                                data.interviewRecording &&
                                data.interviewRecording?.filetype.includes(
                                  "audio"
                                )
                                  ? "microphone"
                                  : "video"
                              }`}
                            />
                          </div>
                        }
                      >
                        {!data.interviewRecording ? (
                          <div className={styles.evalNotes}>
                            No recording available
                          </div>
                        ) : data.interviewRecording.filetype.includes(
                            "audio"
                          ) ? (
                          <audio
                            style={{ width: "100%" }}
                            className="shadow-sm"
                            preload="auto"
                            controls
                            onError={(e) => {
                              console.error("Audio playback error:", e);
                            }}
                          >
                            <source
                              src={`https://cdn.hellojia.ai/${data.interviewRecording?.filename}`}
                              type={data.interviewRecording.filetype}
                            />
                            Your browser does not support the audio element.
                          </audio>
                        ) : (
                          <video
                            style={{
                              width: "70%",
                              margin: "0 auto",
                              display: "block",
                            }}
                            preload="metadata"
                            controls
                            src={`https://cdn.hellojia.ai/${data.interviewRecording?.filename}`}
                            onError={(e) => {
                              console.error("Video playback error:", e);
                            }}
                          >
                            Your browser does not support the video element.
                          </video>
                        )}
                      </SectionCard>

                      <SectionCard title="Contact Information">
                        <div
                          className={styles.evalNotes}
                          style={{ fontSize: "14px" }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: "12px",
                              marginBottom: "16px",
                              alignItems: "center",
                            }}
                          >
                            <img
                              style={{
                                width: "40px",
                                height: "40px",
                                borderRadius: "100%",
                              }}
                              src={data.interviewData.image}
                              alt="Candidate profile photo"
                            />

                            <div>
                              <div
                                style={{ fontWeight: "bold", color: "#414651" }}
                              >
                                {applicantName}
                              </div>
                              {showContactDetails && (
                                <div style={{ color: "#414651" }}>
                                  {data.interviewData.email}
                                </div>
                              )}
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: "16px" }}>
                            <div style={{ flex: "1" }}>
                              <div
                                style={{ color: "#717680", fontWeight: "500" }}
                              >
                                Interview taken on
                              </div>

                              <p style={{ margin: "0", color: "#414651" }}>
                                {formatDate(data.interviewData.createdAt)}
                              </p>
                            </div>

                            <div style={{ flex: "1" }}>
                              <div
                                style={{ color: "#717680", fontWeight: "500" }}
                              >
                                Joined on
                              </div>
                              <p style={{ margin: "0", color: "#414651" }}>
                                {formatDate(data.interviewData.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </SectionCard>

                      {showRecruiterAssessments && data.feedback && (
                        <SectionCard title="Feedback">
                          <div className={styles.feedbackRatingContainer}>
                            {[1, 2, 3, 4, 5].map((i) => (
                              <span
                                key={i}
                                style={{
                                  color:
                                    i <= data.feedback.rating
                                      ? "#FDB022"
                                      : "#ddd",
                                  fontSize: "30px",
                                  transition: "color 0.2s",
                                }}
                              >
                                ★
                              </span>
                            ))}
                          </div>

                          <div className={styles.evalNotes}>
                            <p style={{ margin: "0" }}>
                              {data.feedback.feedback}
                            </p>
                          </div>
                        </SectionCard>
                      )}
                    </div>
                  </div>
                </>
              )}

              {activeStage?.stageId !== "1" &&
                activeStage?.stageId !== "2" &&
                activeStage && (
                  <>
                    {showRecruiterAssessments && activeStage.humanEvaluation && (
                      <SectionCard
                        title={`Evaluation by ${
                          activeStage?.evaluator?.name ?? "Recruiter"
                        }`}
                        outerStyle={{
                          backgroundColor: "#FFFCF5",
                          boxShadow: "0 0 0 1px #FEEFC7 inset",
                        }}
                        icon={
                          <img
                            src={
                              activeStage?.evaluator?.image ||
                              "https://placehold.co/32x32"
                            }
                            alt="Evaluator profile picture"
                          />
                        }
                        badge={<CareerFit fit={activeStage?.fit} assessment={activeStage?.humanEvaluation} candidateDetails={data.interviewData} evaluatorName={activeStage?.evaluator?.name ? activeStage?.evaluator?.name?.split(" ")[0] : "Jia"} />}
                      >
                        <div className={styles.evalNotes}>
                          <p
                            dangerouslySetInnerHTML={{
                              __html: activeStage.humanEvaluation,
                            }}
                          />
                        </div>
                      </SectionCard>
                    )}

                    {activeStageAttachments.length > 0 &&
                      isStageAfterAIInterview(
                        data.interviewData?.pipelineStages,
                        activeStage.stageId
                      ) && (
                        <StageAttachments
                          attachments={activeStageAttachments}
                          readOnly
                          stageId={activeStage.stageId}
                          substageId={activeStage.substageId}
                          profileId={assessment.profileId}
                          passcode={assessment.passcode}
                        />
                      )}
                  </>
                )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
