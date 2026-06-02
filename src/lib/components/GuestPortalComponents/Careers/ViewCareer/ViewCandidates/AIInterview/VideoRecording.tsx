"use client";

import React, { useRef, useState } from "react";
import Container from "../../../../Container";
import type { InterviewRecording } from "./useAIInterviewData";

type Props = {
  recording: InterviewRecording | null;
};

const CDN_URL = "https://cdn.hellojia.ai";

export default function VideoRecording({ recording }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackRate, setPlaybackRate] = useState(1);

  const hasData = recording !== null;
  const isAudio = recording?.filetype?.includes("audio");

  function handlePlaybackRateChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const rate = Number(event.target.value);
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  }

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
            className={`la la-${isAudio ? "microphone" : "video"}`}
            style={{ color: "#FFFFFF", fontSize: 20 }}
          />
        </div>
      }
      title={
        <span style={{ fontSize: 16, fontWeight: 600, color: "#101828" }}>
          {isAudio ? "Audio Recording" : "Video Recording"}
        </span>
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
          <span style={{ fontSize: 14 }}>No recording available</span>
        </div>
      ) : isAudio ? (
        <audio
          style={{ width: "100%" }}
          preload="auto"
          controls
          onError={(e) => {
            console.error("Audio playback error:", e);
          }}
        >
          <source
            src={`${CDN_URL}/${recording.filename}`}
            type={recording.filetype}
          />
        </audio>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <video
            ref={videoRef}
            style={{ width: "100%", borderRadius: 8 }}
            preload="metadata"
            controls
            src={`${CDN_URL}/${recording.filename}`}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 500, color: "#344054" }}>
              Playback Speed
            </span>
            <select
              value={playbackRate}
              onChange={handlePlaybackRateChange}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #D5D7DA",
                fontSize: 14,
                color: "#344054",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              <option value="1">1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>
          </div>
        </div>
      )}
    </Container>
  );
}









