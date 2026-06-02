"use client";

import React, { useMemo } from "react";
import moment from "moment";
import Container from "../../../../Container";
import type { TranscriptMessage } from "./useAIInterviewData";

type Props = {
  transcripts: TranscriptMessage[];
  candidateName?: string | null;
};

export default function InterviewTranscript({ transcripts, candidateName }: Props) {
  const hasData = transcripts.length > 0;

  // Calculate interview duration
  const duration = useMemo(() => {
    if (transcripts.length < 2) return null;
    const startTime = new Date(transcripts[0].time);
    const endTime = new Date(transcripts[transcripts.length - 1].time);
    const durationMs = endTime.getTime() - startTime.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }, [transcripts]);

  return (
    <Container
      icon={
        <div
          style={{
            width: 32,
            height: 32,
            backgroundColor: "#181D27",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <i
            className="la la-microphone"
            style={{ color: "#FFFFFF", fontSize: 20 }}
          />
        </div>
      }
      title={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: "#101828" }}>
              Interview Transcript
            </span>
            {duration && (
              <span
                style={{
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  borderRadius: 60,
                  padding: "4px 10px",
                  border: "1px solid #D5D7DA",
                  background: "#fff",
                  color: "#475467",
                }}
              >
                Duration: {duration}
              </span>
            )}
          </div>
        </div>
      }
    >
      {!hasData ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px 24px",
            color: "#667085",
          }}
        >
          <span style={{ fontSize: 14 }}>No transcript available</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {transcripts.map((msg, idx) => {
            // Calculate time elapsed from previous message
            const timeElapsed = idx > 0
              ? (() => {
                  const dur = moment.duration(
                    moment(msg.time).diff(moment(transcripts[idx - 1].time))
                  );
                  const seconds = dur.asSeconds();
                  const minutes = Math.floor(seconds / 60);
                  return seconds >= 60
                    ? `${minutes}m ${(seconds - minutes * 60).toFixed(1)}s`
                    : `${seconds.toFixed(1)}s`;
                })()
              : "0.0s";

            const isUser = msg.type === "user";
            const speakerName = isUser ? (candidateName || "Applicant") : "Jia";

            return (
              <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {/* Message Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#344054" }}>
                    {speakerName}
                  </span>
                  <span style={{ fontSize: 12, color: "#667085" }}>
                    {moment(msg.time).format("hh:mm A")}
                  </span>
                  <div
                    style={{
                      width: 1,
                      height: 14,
                      backgroundColor: "#E9EAEB",
                    }}
                  />
                  <span
                    style={{ fontSize: 12, color: "#98A2B3" }}
                    title="Time from previous message"
                  >
                    {timeElapsed}
                  </span>
                </div>

                {/* Message Bubble */}
                <div
                  style={{
                    backgroundColor: isUser ? "#F8F9FC" : "#EFF8FF",
                    borderRadius: "8px 20px 20px 20px",
                    border: "1px solid #E9EAEB",
                    padding: "10px 16px",
                    width: "fit-content",
                    maxWidth: "85%",
                    fontSize: 14,
                    lineHeight: "20px",
                    color: "#344054",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Container>
  );
}









