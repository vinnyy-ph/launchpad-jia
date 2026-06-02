"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/utils/apiClient";

type Voice = "alloy" | "ash" | "ballad" | "cedar" | "coral" | "echo" | "fable" | "onyx" | "nova" | "marin" | "sage" | "shimmer" | "verse";

interface VoiceTextToSpeechProps {
  text: string;
  autoPlay?: boolean;
  voice?: Voice;
  onPlay?: () => void;
  onEnd?: () => void;
  onReady?: () => void;
  className?: string;
  buttonText?: string;
  loadingText?: string;
}

export const VoiceTextToSpeech = ({
  text,
  autoPlay = false,
  voice = "alloy" as Voice,
  onPlay,
  onEnd,
  onReady,
  className = "",
  buttonText = "Play",
  loadingText = "Loading...",
}: VoiceTextToSpeechProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null
  );

  useEffect(() => {
    let isCancelled = false;

    const generateSpeech = async () => {
      if (!text) return;

      try {
        setIsLoading(true);
        setIsReady(false);

        const response = await api.post(
          "/api/text-to-speech",
          {
            text,
            voice,
          },
          { responseType: "blob" }
        );

        if (isCancelled) return;

        if (response.data?.error) {
          throw new Error("Failed to generate speech");
        }

        const audioBlob = await response.data;
        const audioUrl = URL.createObjectURL(audioBlob);

        setAudioElement((prev) => {
          if (prev) {
            URL.revokeObjectURL(prev.src);
            prev.pause();
          }
          return new Audio(audioUrl);
        });
      } catch (error) {
        console.error("Error generating speech:", error);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    if (text) {
      generateSpeech();
    }

    return () => {
      isCancelled = true;
    };
  }, [text, voice]);

  useEffect(() => {
    if (audioElement) {
      audioElement.onended = () => {
        onEnd?.();
      };
      setIsReady(true);
      onReady?.();
    }
  }, [audioElement]);

  useEffect(() => {
    if (autoPlay && isReady && audioElement) {
      playAudio();
    }
  }, [isReady, autoPlay]);

  const playAudio = () => {
    if (audioElement && isReady) {
      audioElement.currentTime = 0;
      audioElement.play();
      onPlay?.();
    }
  };

  const stopAudio = () => {
    if (audioElement) {
      audioElement.pause();
      onEnd?.();
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className} d-none`}>
      <button
        onClick={playAudio}
        disabled={isLoading || !isReady}
        className="px-3 py-1 rounded bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        aria-label="Play text as speech"
        id="play-tts-btn"
      >
        {isLoading ? loadingText : buttonText}
      </button>
      {audioElement && audioElement.paused === false && (
        <button
          onClick={stopAudio}
          className="px-3 py-1 rounded bg-red-500 hover:bg-red-600 text-white transition-colors"
          aria-label="Stop playing speech"
        >
          Stop
        </button>
      )}
    </div>
  );
};

export default VoiceTextToSpeech;
