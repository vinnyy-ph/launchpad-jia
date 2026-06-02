"use client";

import styles from "@/lib/styles/candidate-profile.module.scss";
import ProfileHeader from "./ProfileHeader";
import { useEffect, useMemo, useState } from "react";
import CareerFit from "../CareerComponents/CareerFit";
import SectionCard from "./SectionCard";
import Markdown from "react-markdown";
import { parseSkillsFromMarkdown } from "@/lib/Utils";
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
import IntroductionSectionContent from "@/lib/components/screens/IntroductionSectionContent";
import ContactInfoSectionContent from "@/lib/components/screens/ContactInfoSectionContent";
import ExperienceSectionContent from "@/lib/components/screens/ExperienceSectionContent";
import EducationSectionContent from "@/lib/components/screens/EducationSectionContent";
import ProjectsSectionContent from "@/lib/components/screens/ProjectsSectionContent";
import CertificationsSectionContent from "@/lib/components/screens/CertificationsSectionContent";
import AwardsSectionContent from "@/lib/components/screens/AwardsSectionContent";
import {
  buildStructuredCVFromDigitalCV,
  normalizeStructuredCVInput,
} from "@/lib/utils/structuredCV";

const DISPLAY_SECTIONS = [
  "Introduction",
  "Contact Info",
  "Experience",
  "Skills",
  "Education",
  "Projects",
  "Certifications",
  "Awards",
] as const;
const ORIGINAL_CV_LABEL = "Original CV";

type SectionName = (typeof DISPLAY_SECTIONS)[number];
type SectionMap = Record<SectionName, string>;

const EMPTY_SECTION_MAP: SectionMap = {
  "Introduction": "",
  "Contact Info": "",
  "Experience": "",
  "Skills": "",
  "Education": "",
  "Projects": "",
  "Certifications": "",
  "Awards": "",
};

function formatStructuredCVBySections(structuredCV: any): SectionMap {
  const formattedCV: SectionMap = { ...EMPTY_SECTION_MAP };
  if (!structuredCV || typeof structuredCV !== "object") return formattedCV;

  const intro =
    typeof structuredCV.introduction === "string"
      ? structuredCV.introduction.trim()
      : "";
  if (intro) formattedCV["Introduction"] = intro;

  if (structuredCV.contactInfo && typeof structuredCV.contactInfo === "object") {
    const contact = structuredCV.contactInfo as any;
    const hasContactData =
      (typeof contact.email === "string" && contact.email.trim() !== "") ||
      (typeof contact.phone === "string" && contact.phone.trim() !== "") ||
      (typeof contact.countryCode === "string" && contact.countryCode.trim() !== "") ||
      (typeof contact.address === "string" && contact.address.trim() !== "") ||
      (typeof contact.linkedin === "string" && contact.linkedin.trim() !== "") ||
      (Array.isArray(contact.websites) &&
        contact.websites.some((website: any) => website?.url && String(website.url).trim() !== ""));

    if (hasContactData) {
      formattedCV["Contact Info"] = JSON.stringify(contact);
    }
  }

  const setArraySection = (sectionName: SectionName, value: unknown) => {
    if (!Array.isArray(value) || value.length === 0) return;
    formattedCV[sectionName] = JSON.stringify(value);
  };

  setArraySection("Experience", structuredCV.experience);
  setArraySection("Education", structuredCV.education);
  setArraySection("Projects", structuredCV.projects);
  setArraySection("Certifications", structuredCV.certifications);
  setArraySection("Awards", structuredCV.awards);

  if (Array.isArray(structuredCV.skills) && structuredCV.skills.length > 0) {
    formattedCV["Skills"] = JSON.stringify(structuredCV.skills);
  }

  return formattedCV;
}

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

  const structuredCVData = data.cvData?.data?.structuredCV;
  const digitalCVSections = Array.isArray(data.cvData?.data?.digitalCV)
    ? data.cvData.data.digitalCV
    : [];
  const orgCandidateSkillsFromData = Array.isArray(data.cvData?.data?.orgCandidateSkills)
    ? data.cvData.data.orgCandidateSkills
    : [];
  const safeTranscripts = data.transcripts ?? [];
  const selectedCvVersionLabel =
    typeof assessment.cvVersionLabel === "string" && assessment.cvVersionLabel.trim().length > 0
      ? assessment.cvVersionLabel.trim()
      : ORIGINAL_CV_LABEL;
  const isOriginalCVSelected =
    selectedCvVersionLabel.toLowerCase() === ORIGINAL_CV_LABEL.toLowerCase();

  const normalizedStructuredCV = useMemo(
    () =>
      structuredCVData
        ? normalizeStructuredCVInput(structuredCVData)
        : digitalCVSections.length > 0
          ? buildStructuredCVFromDigitalCV(digitalCVSections)
          : null,
    [digitalCVSections, structuredCVData]
  );

  const sectionValues = useMemo(
    () =>
      normalizedStructuredCV
        ? formatStructuredCVBySections(normalizedStructuredCV)
        : { ...EMPTY_SECTION_MAP },
    [normalizedStructuredCV]
  );

  const skills = useMemo(() => {
    const normalizedOrgSkills = isOriginalCVSelected
      ? orgCandidateSkillsFromData
          .filter((skill: any): skill is string => typeof skill === "string")
          .map((skill: string) => skill.trim())
          .filter((skill: string) => skill.length > 0)
      : [];
    if (normalizedOrgSkills.length > 0) return normalizedOrgSkills;

    const structuredSkills = Array.isArray(normalizedStructuredCV?.skills)
      ? normalizedStructuredCV.skills
          .filter((skill: any): skill is string => typeof skill === "string")
          .map((skill: string) => skill.trim())
          .filter((skill: string) => skill.length > 0)
      : [];

    if (structuredSkills.length > 0) return structuredSkills;
    return parseSkillsFromMarkdown(sectionValues["Skills"]);
  }, [isOriginalCVSelected, normalizedStructuredCV?.skills, orgCandidateSkillsFromData, sectionValues]);

  const hasSectionContent = useMemo(
    () => ({
      introduction: sectionValues["Introduction"].trim().length > 0,
      contactInfo: sectionValues["Contact Info"].trim().length > 0,
      experience: sectionValues["Experience"].trim().length > 0,
      skills: skills.length > 0,
      education: sectionValues["Education"].trim().length > 0,
      projects: sectionValues["Projects"].trim().length > 0,
      certifications: sectionValues["Certifications"].trim().length > 0,
      awards: sectionValues["Awards"].trim().length > 0,
    }),
    [sectionValues, skills.length]
  );
  const contactInfoIsPhoneVerified = useMemo(() => {
    const rawContactInfo = sectionValues["Contact Info"];
    if (typeof rawContactInfo !== "string" || rawContactInfo.trim().length === 0) {
      return false;
    }

    try {
      const parsedContactInfo = JSON.parse(rawContactInfo);
      return parsedContactInfo?.isPhoneVerified === true;
    } catch {
      return false;
    }
  }, [sectionValues]);

  const hasCVContent = useMemo(
    () =>
      Object.values(hasSectionContent).some((hasContent) => hasContent),
    [hasSectionContent]
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

                  {hasCVContent ? (
                    <div style={{ display: "flex", gap: "24px" }}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          flex: "2",
                          gap: "24px",
                        }}
                      >
                        {hasSectionContent.introduction && (
                          <SectionCard title="Introduction">
                            <IntroductionSectionContent
                              buildingCV={false}
                              loading={false}
                              value={sectionValues["Introduction"]}
                            />
                          </SectionCard>
                        )}

                        {hasSectionContent.experience && (
                          <SectionCard title="Experience">
                            <ExperienceSectionContent
                              buildingCV={false}
                              loading={false}
                              value={sectionValues["Experience"]}
                              defaultExperienceData={[]}
                              onEditExperienceItem={() => {}}
                              showEditIcon={false}
                            />
                          </SectionCard>
                        )}

                        {hasSectionContent.education && (
                          <SectionCard title="Education">
                            <EducationSectionContent
                              buildingCV={false}
                              loading={false}
                              value={sectionValues["Education"]}
                              defaultEducationData={[]}
                              onEditEducationItem={() => {}}
                              showEditIcon={false}
                            />
                          </SectionCard>
                        )}

                        {hasSectionContent.certifications && (
                          <SectionCard title="Certifications">
                            <CertificationsSectionContent
                              value={sectionValues["Certifications"]}
                              defaultCertificationsData={[]}
                              onEditCertificationItem={() => {}}
                              showEditIcon={false}
                            />
                          </SectionCard>
                        )}

                        {hasSectionContent.projects && (
                          <SectionCard title="Projects">
                            <ProjectsSectionContent
                              value={sectionValues["Projects"]}
                              defaultProjectsData={[]}
                              onEditProjectItem={() => {}}
                              showEditIcon={false}
                            />
                          </SectionCard>
                        )}

                        {hasSectionContent.awards && (
                          <SectionCard title="Awards">
                            <AwardsSectionContent
                              value={sectionValues["Awards"]}
                              defaultAwardsData={[]}
                              onEditAwardItem={() => {}}
                              showEditIcon={false}
                            />
                          </SectionCard>
                        )}
                      </div>

                      <div style={{ flex: "1", display: "flex", flexDirection: "column", gap: "24px" }}>
                        {showContactDetails && hasSectionContent.contactInfo && (
                          <SectionCard title="Contact Information">
                            <ContactInfoSectionContent
                              buildingCV={false}
                              loading={false}
                              value={sectionValues["Contact Info"]}
                              defaultContactInfo={{
                                email: "",
                                phone: "",
                                countryCode: "",
                                address: "",
                                linkedin: "",
                                websites: [],
                              }}
                              isInterviewAnalysis={true}
                              showPhoneVerifiedBadge={contactInfoIsPhoneVerified}
                            />
                          </SectionCard>
                        )}

                        {hasSectionContent.skills && skills.length > 0 && (
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
                                ...(data.interviewData.image?.includes('user-profile') || data.interviewData.image?.includes('placeholder')
                                  ? {
                                      backgroundColor: '#F8F9FC',
                                      border: '1px solid #E9EAEB',
                                      padding: '8px',
                                      objectFit: 'contain'
                                    }
                                  : { objectFit: 'cover' }
                                )
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
