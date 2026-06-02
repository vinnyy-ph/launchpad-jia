"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { InfoCard } from "./InfoCard";
import styles from "@/app/(talent-vault)/styles/modules/applicant-dashboard.module.scss";
import { api } from "@/lib/utils/apiClient";
import { resolveTalentVaultExpiresAt } from "@/app/(talent-vault)/lib/talentVaultStatus";
import CustomMarkdown from "@/lib/components/ui/markdown/CustomMarkdown";
import { useAppContext } from "@/lib/context/ContextV2";

type TranscriptItem = {
  type?: string;
  content?: string;
  time?: string | number | Date;
};

type InterviewRecording = {
  filename?: string;
  filetype?: string;
};

type InterviewDetailsResponse = {
  _id?: string;
  interviewRecording?: InterviewRecording | null;
  interviewUpload?: {
    uploadId?: string;
    key?: string;
    filetype?: string;
  };
  interviewParts?: Array<{ etag: string; partNumber: number }>;
  analysis?: any;
  summary?: string;
};

type InterviewSectionProps = {
  interviewId?: string | null;
  applicantName?: string | null;
};

type AnalysisItem = {
  title: string;
  description: string;
};

function toMillis(value: unknown) {
  if (value == null) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value as any);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatTranscriptTime(value: unknown) {
  const timestamp = toMillis(value);

  if (timestamp == null) {
    return "--:--";
  }

  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatMessageGap(currentValue: unknown, previousValue: unknown) {
  const current = toMillis(currentValue);
  const previous = toMillis(previousValue);

  if (current == null || previous == null) {
    return "0.0s";
  }

  const seconds = Math.max(0, (current - previous) / 1000);
  const minutes = Math.floor(seconds / 60);

  return seconds >= 60
    ? `${minutes}m ${(seconds - minutes * 60).toFixed(1)}s`
    : `${seconds.toFixed(1)}s`;
}

function formatTranscriptDuration(transcripts: TranscriptItem[]) {
  if (transcripts.length === 0) {
    return null;
  }

  const start = toMillis(transcripts[0]?.time);
  const end = toMillis(transcripts[transcripts.length - 1]?.time);

  if (start == null || end == null) {
    return null;
  }

  const durationMs = Math.max(0, end - start);
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);

  return `${minutes}m ${seconds}s`;
}

function normalizeAnalysisItems(input: unknown, fallbackTitleKey?: string): AnalysisItem[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const rawTitle =
        typeof (item as any).title === "string"
          ? (item as any).title
          : fallbackTitleKey && typeof (item as any)[fallbackTitleKey] === "string"
            ? (item as any)[fallbackTitleKey]
            : "";

      const rawDescription =
        typeof (item as any).description === "string" ? (item as any).description : "";

      const title = rawTitle.trim();
      const description = rawDescription.trim();

      if (!title && !description) {
        return null;
      }

      return {
        title,
        description,
      };
    })
    .filter((item): item is AnalysisItem => Boolean(item));
}

export function InterviewSection({ interviewId, applicantName }: InterviewSectionProps) {
  const { setModalType, user } = useAppContext();
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [isLoadingTranscripts, setIsLoadingTranscripts] = useState(false);
  const [interviewRecording, setInterviewRecording] = useState<InterviewRecording | null>(null);
  const [isLoadingRecording, setIsLoadingRecording] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [summary, setSummary] = useState("");
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [isRetakingInterview, setIsRetakingInterview] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);

  async function finishUpload(interviewData: InterviewDetailsResponse) {
    if (
      !interviewData.interviewUpload?.uploadId ||
      !interviewData.interviewUpload?.key ||
      !interviewData.interviewUpload?.filetype ||
      !interviewData._id ||
      !Array.isArray(interviewData.interviewParts) ||
      interviewData.interviewParts.length === 0
    ) {
      return null;
    }

    try {
      await api.post("/api/finish-upload", {
        uploadId: interviewData.interviewUpload.uploadId,
        parts: interviewData.interviewParts,
        fileName: interviewData.interviewUpload.key,
        filetype: interviewData.interviewUpload.filetype,
        uid: interviewData._id,
      });

      return {
        filename: interviewData.interviewUpload.key,
        filetype: interviewData.interviewUpload.filetype,
      } as InterviewRecording;
    } catch (error) {
      console.error("Error finishing interview upload:", error);
      return null;
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchTranscripts() {
      if (!interviewId) {
        if (!cancelled) {
          setTranscripts([]);
          setIsLoadingTranscripts(false);
        }
        return;
      }

      setIsLoadingTranscripts(true);

      try {
        const response = await api.post("/api/fetch-transcript", { id: interviewId });

        if (!cancelled) {
          setTranscripts(Array.isArray(response?.data) ? response.data : []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error loading interview transcripts:", error);
          setTranscripts([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTranscripts(false);
        }
      }
    }

    void fetchTranscripts();

    return () => {
      cancelled = true;
    };
  }, [interviewId]);

  useEffect(() => {
    let cancelled = false;

    async function fetchInterviewDetails() {
      if (!interviewId) {
        if (!cancelled) {
          setInterviewRecording(null);
          setAnalysis(null);
          setSummary("");
          setIsLoadingRecording(false);
          setIsLoadingInsights(false);
          setPlaybackRate(1);
        }
        return;
      }

      setIsLoadingRecording(true);
      setIsLoadingInsights(true);

      try {
        const response = await api.post("/api/interview-details", { id: interviewId });
        const interviewData = (response?.data || {}) as InterviewDetailsResponse;
        let resolvedRecording = interviewData.interviewRecording || null;

        if (!resolvedRecording && interviewData.interviewUpload && interviewData.interviewParts) {
          resolvedRecording = await finishUpload(interviewData);
        }

        if (!cancelled) {
          setInterviewRecording(resolvedRecording);
          setAnalysis(interviewData.analysis || null);
          setSummary(typeof interviewData.summary === "string" ? interviewData.summary : "");
          setPlaybackRate(1);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error loading interview details:", error);
          setInterviewRecording(null);
          setAnalysis(null);
          setSummary("");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRecording(false);
          setIsLoadingInsights(false);
        }
      }
    }

    void fetchInterviewDetails();

    return () => {
      cancelled = true;
    };
  }, [interviewId]);

  const duration = useMemo(() => formatTranscriptDuration(transcripts), [transcripts]);
  const speakerName = useMemo(() => {
    const trimmedName = typeof applicantName === "string" ? applicantName.trim() : "";
    return trimmedName || "Applicant";
  }, [applicantName]);
  const isAudioRecording = Boolean(interviewRecording?.filetype?.includes("audio"));

  const strengths = useMemo(() => normalizeAnalysisItems(analysis?.strengths), [analysis]);
  const bestJobFit = useMemo(() => normalizeAnalysisItems(analysis?.bestJobFit), [analysis]);
  const workStyle = useMemo(
    () => normalizeAnalysisItems(analysis?.workStyle, "quality"),
    [analysis]
  );
  const values = useMemo(() => normalizeAnalysisItems(analysis?.values), [analysis]);

  const positiveFeedback =
    typeof analysis?.feedback?.positive === "string" ? analysis.feedback.positive.trim() : "";
  const improvementsFeedback =
    typeof analysis?.feedback?.improvements === "string"
      ? analysis.feedback.improvements.trim()
      : "";
  const normalizedStatus = String(user?.talentVault?.status || "").toLowerCase();
  const normalizedState = String(user?.talentVault?.state || "").toLowerCase();
  const effectiveExpiresAt = resolveTalentVaultExpiresAt(
    user?.talentVault?.expiresAt || user?.talentVault?.expirationDate,
    user?.talentVault?.completedAt
  );
  const isExpiredByDate = Boolean(
    effectiveExpiresAt && effectiveExpiresAt.getTime() < Date.now()
  );
  const isProfileExpired = normalizedState === "expired" || isExpiredByDate;
  const isProfileInactiveOrExpired = isProfileExpired || normalizedStatus !== "active";

  function handlePlaybackRateChange(event: ChangeEvent<HTMLSelectElement>) {
    const selectedRate = Number(event.target.value);
    setPlaybackRate(selectedRate);

    if (videoRef.current) {
      videoRef.current.playbackRate = selectedRate;
    }
  }

  async function handleRetakeInterview() {
    if (isRetakingInterview || isProfileInactiveOrExpired) {
      return;
    }

    setIsRetakingInterview(true);

    try {
      const response = await api.patch("/api/talent-vault/profiles", {
        action: "prepare_ai_interview_retake",
        payload: {},
      });

      const ensuredInterviewID =
        typeof response?.data?.meta?.interviewID === "string"
          ? response.data.meta.interviewID.trim()
          : "";
      const fallbackInterviewID = typeof interviewId === "string" ? interviewId.trim() : "";
      const nextInterviewID = ensuredInterviewID || fallbackInterviewID;
      const updatedProfile = response?.data?.data || null;

      if (!nextInterviewID) {
        throw new Error("Interview is not ready yet. Please try again.");
      }

      sessionStorage.setItem(
        "selectedCareer",
        JSON.stringify({
          source: "talent-vault",
          interviewID: nextInterviewID,
          profileId:
            updatedProfile?._id && typeof updatedProfile._id.toString === "function"
              ? updatedProfile._id.toString()
              : null,
          name: applicantName || "",
          email:
            typeof updatedProfile?.userInfo?.email === "string"
              ? updatedProfile.userInfo.email
              : "",
        })
      );
      setModalType("preScreeningGuide");
    } catch (error: any) {
      console.error("Error retaking interview:", error);
      alert(error?.message || "Failed to prepare interview retake. Please try again.");
    } finally {
      setIsRetakingInterview(false);
    }
  }

  function renderAnalysisGroup(
    title: string,
    items: AnalysisItem[],
    icon: string,
    iconAlt: string,
    emptyText: string
  ) {
    return (
      <div className={styles.analysisSection}>
        <div className={styles.analysisSectionTitle}>{title}</div>

        {items.length > 0 ? (
          <div className={styles.analysisSectionItems}>
            {items.map((item, index) => (
              <div key={`${title}-${index}`} className={styles.analysisItemRow}>
                <img src={icon} alt={iconAlt} />
                <div className={styles.analysisItemContent}>
                  <div className={styles.analysisItemTitle}>{item.title || "N/A"}</div>
                  <div className={styles.analysisItemDescription}>{item.description || "N/A"}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.analysisSectionEmpty}>{emptyText}</div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.profileColumns}>
      <div className={styles.profileMainColumn}>
        <div className={isProfileInactiveOrExpired ? styles.disabledSectionCard : undefined}>
          <InfoCard
            title="Interview Analysis"
            icon={<img src="/icons/insights_sparkle.svg" alt="Insights Sparkle Icon" />}
          >
          {isLoadingInsights ? (
            <div className={styles.recordingLoadingState}>
              <img
                src="/gifs/analysis-loading.gif"
                alt="Loading interview analysis"
                className={styles.recordingLoadingGif}
              />
            </div>
          ) : analysis || summary ? (
            <div className={styles.interviewAnalysisContent}>
              {summary ? (
                <CustomMarkdown content={summary} />
              ) : (
                <div className={styles.analysisSectionEmpty}>No interview summary available</div>
              )}

              {renderAnalysisGroup(
                "Strengths",
                strengths,
                "/icons/medal.svg",
                "Medal Icon",
                "No strengths available"
              )}
              {renderAnalysisGroup(
                "Best Job Fit",
                bestJobFit,
                "/icons/case-badge.svg",
                "Briefcase Icon",
                "No job fit roles available"
              )}
              {renderAnalysisGroup(
                "Culture and Work Style",
                workStyle,
                "/icons/medal.svg",
                "Work style icon",
                "No work style insights available"
              )}
              {renderAnalysisGroup(
                "Value and Growth",
                values,
                "/icons/heart-badge.svg",
                "Heart Icon",
                "No values insights available"
              )}
            </div>
          ) : (
            <div className={styles.interviewAnalysisEmptyState}>No analysis available</div>
          )}
          </InfoCard>
        </div>

        <div className={isProfileInactiveOrExpired ? styles.disabledSectionCard : undefined}>
          <InfoCard
            title={isAudioRecording ? "Audio Recording" : "Video Recording"}
            icon={
              <img
                src={isAudioRecording ? "/icons/mic_white.svg" : "/icons/video.svg"}
                alt={isAudioRecording ? "Mic Icon" : "Video Icon"}
              />
            }
          >
          {isLoadingRecording ? (
            <div className={styles.recordingLoadingState}>
              <img
                src="/gifs/analysis-loading.gif"
                alt="Loading recording"
                className={styles.recordingLoadingGif}
              />
            </div>
          ) : interviewRecording ? (
            isAudioRecording ? (
              <audio
                className={styles.recordingAudio}
                preload="auto"
                controls
                onError={(error) => {
                  console.error("Audio playback error:", error);
                }}
              >
                <source
                  src={`https://cdn.hellojia.ai/${interviewRecording.filename}`}
                  type={interviewRecording.filetype}
                />
              </audio>
            ) : (
              <>
                <video
                  ref={videoRef}
                  className={styles.recordingVideo}
                  preload="metadata"
                  controls
                  src={`https://cdn.hellojia.ai/${interviewRecording.filename}`}
                />
                <div className={styles.recordingPlaybackRow}>
                  <span className={styles.recordingPlaybackLabel}>Playback Speed</span>
                  <select value={playbackRate} onChange={handlePlaybackRateChange}>
                    <option value="1">1x</option>
                    <option value="1.25">1.25x</option>
                    <option value="1.5">1.5x</option>
                    <option value="2">2x</option>
                  </select>
                </div>
              </>
            )
          ) : (
            <div className={styles.transcriptEmptyState}>No recording available</div>
          )}
          </InfoCard>
        </div>

        <div className={isProfileInactiveOrExpired ? styles.disabledSectionCard : undefined}>
          <InfoCard
            title={
              <>
                <span>Transcript</span>
                {duration ? (
                  <span className={styles.transcriptDurationPill}>Duration: {duration}</span>
                ) : null}
              </>
            }
            icon={<img src="/icons/mic_white.svg" alt="Mic Icon" />}
          >
          {isLoadingTranscripts ? (
            <div className={styles.transcriptEmptyState}>
              <span>Loading Transcripts...</span>
              <small className={styles.transcriptLoadingSubtext}>
                Fetching the interview transcript...
              </small>
            </div>
          ) : transcripts.length > 0 ? (
            <div className={styles.transcriptList}>
              {transcripts.map((message, index) => (
                <div
                  key={`${String(message.time || "no-time")}-${index}`}
                  className={styles.transcriptItem}
                >
                  <div className={styles.transcriptMetaRow}>
                    <strong>{message.type === "user" ? "You" : "Jia"}</strong>
                    <small>{formatTranscriptTime(message.time)}</small>
                    <div className={styles.transcriptMetaDivider}></div>
                    <small title="Amount of time from the last message">
                      {index > 0
                        ? formatMessageGap(message.time, transcripts[index - 1]?.time)
                        : "0.0s"}
                    </small>
                  </div>

                  <div
                    className={`${styles.transcriptBubble} ${
                      message.type === "user"
                        ? styles.transcriptBubbleUser
                        : styles.transcriptBubbleJia
                    }`}
                  >
                    {message.content || ""}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.transcriptEmptyState}>No transcript available</div>
          )}
          </InfoCard>
        </div>
      </div>

      <div className={styles.profileSideColumn}>
        <div className={isProfileInactiveOrExpired ? styles.disabledSectionCard : undefined}>
          <InfoCard
            title="Jia Interview Analysis"
            icon={<img src="/icons/three_sparkle.svg" alt="Three Sparkles" />}
            glow={true}
          >
          {isLoadingInsights ? (
            <div className={styles.recordingLoadingState}>
              <img
                src="/gifs/analysis-loading.gif"
                alt="Loading Jia interview analysis"
                className={styles.recordingLoadingGif}
              />
            </div>
          ) : positiveFeedback || improvementsFeedback ? (
            <ul className={styles.jiaFeedbackList}>
              {positiveFeedback ? (
                <li className={styles.jiaFeedbackItem}>
                  <strong className={styles.jiaFeedbackLabel}>What you did well:</strong>
                  <span>{positiveFeedback}</span>
                </li>
              ) : null}
              {improvementsFeedback ? (
                <li className={styles.jiaFeedbackItem}>
                  <strong className={styles.jiaFeedbackLabel}>What can be improved:</strong>
                  <span>{improvementsFeedback}</span>
                </li>
              ) : null}
            </ul>
          ) : (
            <div className={styles.interviewAnalysisEmptyState}>No feedback available</div>
          )}
          </InfoCard>
        </div>

        <div className={isProfileInactiveOrExpired ? styles.disabledSectionCard : undefined}>
          <InfoCard title="Tips">
          <div>
            <p style={{ fontWeight: 400 }}>
              Not satisfied with your interview? Feel free to retake your interview as many times
              as you want. Hit the button below to retake.
            </p>
            <div className={styles.tipsRetakeAction}>
              <button
                type="button"
                className={styles.filledPillActionButton}
                onClick={() => void handleRetakeInterview()}
                disabled={isRetakingInterview}
              >
                {isRetakingInterview ? "Preparing..." : "Retake Interview"}
              </button>
            </div>
          </div>
          </InfoCard>
        </div>

      </div>
    </div>
  );
}
