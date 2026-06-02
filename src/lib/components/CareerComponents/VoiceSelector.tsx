"use client";

import React, { useState, useRef, useEffect } from "react";
import { api } from "@/lib/utils/apiClient";
import { loadingToast, successToast, errorToast } from "@/lib/Utils";
import { toast } from "react-toastify";

const OPENAI_VOICES = [
  { id: "alloy", name: "Alloy" },
  { id: "ash", name: "Ash" },
  { id: "ballad", name: "Ballad" },
  { id: "cedar", name: "Cedar" },
  { id: "coral", name: "Coral" },
  { id: "echo", name: "Echo" },
  { id: "marin", name: "Marin" },
  { id: "sage", name: "Sage" },
  { id: "shimmer", name: "Shimmer" },
  { id: "verse", name: "Verse" },
];

const VOICE_DESCRIPTIONS: Record<string, string> = {
  alloy: "Alloy, I have a versatile, balanced, and warm voice, perfect for any situation.",
  ash: "Ash, I provide a clear, professional, and composed tone for your interactions.",
  ballad: "Ballad, I have a melodic, engaging, and expressive voice that feels very natural.",
  cedar: "Cedar, I offer a deep, stable, and confident voice that conveys authority and trust.",
  coral: "Coral, I have a bright, friendly, and enthusiastic voice that's easy to listen to.",
  echo: "Echo, I provide a calm, steady, and neutral voice suitable for long conversations.",
  marin: "Marin, I have a gentle, soothing, and approachable voice that creates a relaxed atmosphere.",
  sage: "Sage, I offer a thoughtful, articulate, and wise tone for your AI assistant.",
  shimmer: "Shimmer, I have a soft, clear, and empathetic voice that feels very personal.",
  verse: "Verse, I provide a dynamic, rhythmic, and lively voice that keeps users engaged.",
};

interface VoiceSelectorProps {
  selectedVoice: string;
  onSelectVoice: (voiceId: string) => void;
}

export default function VoiceSelector({
  selectedVoice,
  onSelectVoice,
}: VoiceSelectorProps) {
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    // Cleanup object URLs on unmount
    return () => {
      Object.values(previewsRef.current).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  const toggleDropdown = () => setIsOpen(!isOpen);

  const playPreview = async (e: React.MouseEvent, voiceId: string) => {
    e.stopPropagation();

    if (playingVoice === voiceId) {
      if (audioRef.current) {
        audioRef.current.pause();
        setPlayingVoice(null);
      }
      return;
    }

    try {
      setPlayingVoice(voiceId);
      const voiceName =
        OPENAI_VOICES.find((v) => v.id === voiceId)?.name || voiceId;

      let audioUrl = previewsRef.current[voiceId];

      if (!audioUrl) {
        loadingToast(`Preparing ${voiceName} preview...`);

        const response = await api.post(
          "/api/text-to-speech",
          {
            text: VOICE_DESCRIPTIONS[voiceId] || `I am ${voiceName}, your AI assistant.`,
            voice: voiceId,
          },
          { responseType: "blob" }
        );

        audioUrl = URL.createObjectURL(response.data);
        previewsRef.current[voiceId] = audioUrl;
      }

      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.oncanplaythrough = () => {
        toast.dismiss("loading-toast");
        successToast(`${voiceName} Preview voice ready!`, 5000);
        audio.play();
      };

      audio.onended = () => setPlayingVoice(null);

      audio.onerror = () => {
        toast.dismiss("loading-toast");
        errorToast("Failed to play preview", 5000);
        setPlayingVoice(null);
      };
    } catch (error) {
      console.error("Error playing preview:", error);
      toast.dismiss("loading-toast");
      errorToast("Failed to generate preview", 5000);
      setPlayingVoice(null);
    }
  };

  const selectedVoiceName =
    OPENAI_VOICES.find((v) => v.id === (selectedVoice || "alloy"))?.name ||
    "Alloy";

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div
        onClick={toggleDropdown}
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          backgroundColor: "#FFFFFF",
          border: "1px solid #E9EAEB",
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "14px",
          color: "#181D27",
        }}
      >
        <span>{selectedVoiceName}</span>
        <i
          className={`la la-chevron-${isOpen ? "up" : "down"}`}
          style={{ color: "#717680" }}
        ></i>
      </div>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "4px",
            backgroundColor: "#FFFFFF",
            border: "1px solid #E9EAEB",
            borderRadius: "12px",
            boxShadow:
              "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
            zIndex: 1000,
            maxHeight: "300px",
            overflowY: "auto",
            padding: "8px",
          }}
        >
          {OPENAI_VOICES.map((voice) => (
            <div
              key={voice.id}
              onClick={() => {
                onSelectVoice(voice.id);
                setIsOpen(false);
              }}
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                borderRadius: "8px",
                cursor: "pointer",
                backgroundColor:
                  selectedVoice === voice.id ? "#F9FAFB" : "transparent",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#F9FAFB")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  selectedVoice === voice.id ? "#F9FAFB" : "transparent")
              }
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                {selectedVoice === voice.id && (
                  <i
                    className="la la-check"
                    style={{ color: "#181D27", fontSize: "14px" }}
                  ></i>
                )}
                <span
                  style={{
                    fontSize: "14px",
                    color: "#181D27",
                    fontWeight: selectedVoice === voice.id ? 600 : 400,
                    marginLeft: selectedVoice === voice.id ? 0 : "22px",
                  }}
                >
                  {voice.name}
                </span>
              </div>
              <button
                onClick={(e) => playPreview(e, voice.id)}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  backgroundColor:
                    playingVoice === voice.id ? "#F3F4F6" : "transparent",
                }}
              >
                <i
                  className={`la la-${
                    playingVoice === voice.id ? "stop-circle" : "play-circle"
                  }`}
                  style={{ fontSize: "20px", color: "#717680" }}
                ></i>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
