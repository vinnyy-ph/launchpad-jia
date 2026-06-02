"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import { useAppContext } from "@/lib/context/AppContext";
import { guid } from "../Utils";
import Swal from "sweetalert2";
import AvatarImage from "../components/AvatarImage/AvatarImage";
import FeedbackModal from "../Modal/FeedbackModal";
import VoiceTextToSpeech from "./VoiceTextToSpeech";
import { refineUserTranscriptInput } from "./TranscriptUtils";
import { customLog } from "../CustomLogs";
import { Offline } from "react-detect-offline";
import { infoToast } from "../Utils";

// Helper function for safe JSON stringification
const safeStringify = (data: any): string | null => {
  try {
    if (data === null || data === undefined) {
      return null;
    }
    return JSON.stringify(data);
  } catch (error) {
    console.warn("Failed to stringify data:", error);
    return null;
  }
};

// Normalize errors (e.g. Axios) to a plain object so JSON.stringify yields useful errTrace
const errorToSerializable = (rawError: unknown): Record<string, unknown> => {
  try {
    if (rawError && typeof rawError === "object" && "isAxiosError" in rawError) {
      const ax = rawError as {
        message?: string;
        code?: string;
        response?: { status?: number; statusText?: string; data?: unknown };
        config?: { url?: string; method?: string };
      };
      return {
        message: ax.message,
        code: ax.code,
        status: ax.response?.status,
        statusText: ax.response?.statusText,
        responseData: ax.response?.data,
        url: ax.config?.url,
        method: ax.config?.method,
      };
    }
    if (rawError instanceof Error) {
      return { name: rawError.name, message: rawError.message, stack: rawError.stack };
    }
    return { raw: String(rawError) };
  } catch (error) {
    console.warn("Failed to serialize error:", error);
    return { raw: rawError }
  }
};

import JiaOrb from "./JiaOrb";
import MeetingTimer from "./MeetingTimer";
import MeetingClock from "./MeetingClock";
import UserTranscriptPreview from "./UserTranscriptPreview";
import InterviewSummary from "./InterviewSummary";
import InterviewSystemCheck from "./InterviewSystemCheck";
import NetworkMonitorTag from "./NetworkMonitorTag";

// Declare the switchTabCount property on the Window interface
declare global {
  interface Window {
    switchTabCount: number;
    savedMessageIDs: any[];
  }
}

export default function VoiceAssistantV2({
  interviewID,
}: {
  interviewID: string;
}) {
  const { user } = useAppContext();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recorderRef = useRef(null);
  const pcRef = useRef(null);
  const [message, setMessage] = useState([]);

  const [userSpeaking, setUserSpeaking] = useState(false);
  const [jiaSpeaking, setJiaSpeaking] = useState(false);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isStarted, setIsStarted] = useState(false);

  const [cameraOpen, setCameraOpen] = useState(false);
  const mixedRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const videoElement = useRef<HTMLVideoElement>(null);
  const videoElement2 = useRef<HTMLVideoElement>(null);
  const actualMimeTypeRef = useRef("");
  const uploadIdRef = useRef(null);
  const recordingIdRef = useRef(null);
  const uploadPartsRef = useRef<{ partNumber: number; etag: string }[]>([]);
  const currentPartNumberRef = useRef(0);
  const uploadChainRef = useRef(Promise.resolve());
  const finalUploadRef = useRef(false);
  const bufferSizeRef = useRef(0);
  const recordingChunksRef = useRef([]);
  const CHUNK_SIZE = 5 * 1024 * 1024;
  const [currentJiaMessage, setCurrentJiaMessage] = useState(null);
  const [currentScreen, setCurrentScreen] = useState("interview");
  const [savingInProgress, setSavingInProgress] = useState(false);

  const sessionContextRef = useRef<any>(null);
  const isResumedSessionRef = useRef(false);
  const contextSaveChainRef = useRef(Promise.resolve());
  const selectedQuestionsRef = useRef<string[]>([]);
  const [greetingText, setGreetingText] = useState(
    "Hello there, how are you doing. Let's start the interview, when you are ready, just start speaking."
  );

  const [selectedVideoDevice, setSelectedVideoDevice] = useState("");
  const [selectedMicrophoneDevice, setSelectedMicrophoneDevice] = useState("");
  const [selectedSpeakerDevice, setSelectedSpeakerDevice] = useState("");
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [microphoneDevices, setMicrophoneDevices] = useState<MediaDeviceInfo[]>(
    []
  );
  const [speakerDevices, setSpeakerDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioTrackActive, setAudioTrackActive] = useState(false);
  const [videoTrackActive, setVideoTrackActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const webrtcRetryCountRef = useRef(0);
  const openaiRetryCountRef = useRef(0);
  const MAX_RETRY_ATTEMPTS = 3;
  const deviceModalShownRef = useRef<{ audio: boolean; video: boolean }>({
    audio: false,
    video: false,
  });

  // Function to enumerate available devices
  const enumerateDevices = async () => {
    try {
      // Request permission first
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

      const devices = await navigator.mediaDevices.enumerateDevices();

      const cameras = devices.filter((device) => device.kind === "videoinput");
      const microphones = devices.filter(
        (device) => device.kind === "audioinput"
      );
      const speakers = devices.filter(
        (device) => device.kind === "audiooutput"
      );

      setCameraDevices(cameras);
      setMicrophoneDevices(microphones);
      setSpeakerDevices(speakers);

      // Set default selections if available
      if (cameras.length > 0) {
        setSelectedVideoDevice(cameras[0].deviceId);
      }
      if (microphones.length > 0) {
        setSelectedMicrophoneDevice(microphones[0].deviceId);
      }
      if (speakers.length > 0) {
        setSelectedSpeakerDevice(speakers[0].deviceId);
      }
    } catch (error) {
      console.error("Error enumerating devices:", error);
      customLog({
        name: "Device Enumeration Error",
        errCode: "VA_DEV_ENUM_001",
        errTrace: safeStringify(error),
        interviewID: interviewID,
      });
    }
  };

  // Function to validate if a device is still available
  const isDeviceAvailable = (
    deviceId: string,
    deviceList: MediaDeviceInfo[]
  ) => {
    return deviceList.some((device) => device.deviceId === deviceId);
  };

  // Function to get fallback device
  const getFallbackDevice = (deviceList: MediaDeviceInfo[]) => {
    return deviceList.length > 0 ? deviceList[0].deviceId : undefined;
  };

  // Listen for device changes
  useEffect(() => {
    const handleDeviceChange = () => {
      enumerateDevices();
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange
      );
    };
  }, []);

  // Callback functions for device selection
  const handleVideoDeviceChange = (deviceId: string) => {
    if (isDeviceAvailable(deviceId, cameraDevices)) {
      setSelectedVideoDevice(deviceId);
    } else {
      console.warn(`Selected video device ${deviceId} is not available`);
      const fallbackDevice = getFallbackDevice(cameraDevices);
      if (fallbackDevice) {
        setSelectedVideoDevice(fallbackDevice);
      }
    }
  };

  const handleMicrophoneDeviceChange = (deviceId: string) => {
    if (isDeviceAvailable(deviceId, microphoneDevices)) {
      setSelectedMicrophoneDevice(deviceId);
    } else {
      console.warn(`Selected microphone device ${deviceId} is not available`);
      const fallbackDevice = getFallbackDevice(microphoneDevices);
      if (fallbackDevice) {
        setSelectedMicrophoneDevice(fallbackDevice);
      }
    }
  };

  const handleSpeakerDeviceChange = (deviceId: string) => {
    if (isDeviceAvailable(deviceId, speakerDevices)) {
      setSelectedSpeakerDevice(deviceId);
    } else {
      console.warn(`Selected speaker device ${deviceId} is not available`);
      const fallbackDevice = getFallbackDevice(speakerDevices);
      if (fallbackDevice) {
        setSelectedSpeakerDevice(fallbackDevice);
      }
    }
  };

  // Helper function to show device disabled modal
  const showDeviceDisabledModal = async (
    mediaType: "audio" | "video",
    requiresReload: boolean = false
  ) => {
    // Prevent duplicate modals
    if (deviceModalShownRef.current[mediaType]) {
      console.log(`[INFO] ${mediaType} disabled modal already shown, skipping`);
      return;
    }

    const mediaText = mediaType === "audio" ? "microphone" : "camera";

    // Mark modal as shown
    deviceModalShownRef.current[mediaType] = true;

    // Log the error
    customLog({
      name: `${
        mediaText.charAt(0).toUpperCase() + mediaText.slice(1)
      } Disabled`,
      errCode: `VA_${mediaType.toUpperCase()}_DISABLED_001`,
      errTrace: safeStringify({ mediaType, requiresReload }),
      interviewID: interviewID,
    });

    console.log(`[ERROR] Showing ${mediaText} disabled modal`);

    // Close any existing modals first
    try {
      await Swal.close();
    } catch (e) {
      // Ignore errors when closing
    }

    // Wait a bit to ensure DOM is ready
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(async () => {
      try {
        const result = await Swal.fire({
          icon: "info",
          title: `Media Device Turned Off`,
          html: `
            <div style="text-align: left;">
              <p style="margin-bottom: 15px;">Microphone is Camera is required for the interview.</p>
              <p style="margin-bottom: 15px;"><strong>Please:</strong></p>
              <ul style="text-align: left; margin-left: 20px; margin-bottom: 15px;">
                <li>Turn on your microphone and camera in your device settings</li>
                <li>Check browser permissions for microphone and camera access</li>
                <li>Ensure no other application is blocking your microphone and camera</li>
              </ul>
              <p style="margin-top: 15px;">After turning on your microphone and camera, please reload the page to continue.</p>
            </div>
          `,
          confirmButtonText: requiresReload ? "Reload Page" : "OK",
          allowOutsideClick: false,
          allowEscapeKey: false,
          showCancelButton: false,
          didOpen: () => {
            console.log(`[INFO] ${mediaText} disabled modal opened`);
          },
          didClose: () => {
            // Reset flag when modal is closed so it can be shown again if needed
            deviceModalShownRef.current[mediaType] = false;
          },
        });

        if (result.isConfirmed && requiresReload) {
          window.location.reload();
        } else {
          // Reset flag after a delay to allow re-showing if device is still disabled
          setTimeout(() => {
            deviceModalShownRef.current[mediaType] = false;
          }, 5000);
        }
      } catch (error) {
        console.error(
          `[ERROR] Failed to show ${mediaText} disabled modal:`,
          error
        );
        // Reset flag on error
        deviceModalShownRef.current[mediaType] = false;
      }
    });
  };

  // Helper function to show device/permission error modal
  const showDevicePermissionError = async (
    mediaType: "audio" | "video" | "both"
  ) => {
    const mediaText =
      mediaType === "audio"
        ? "microphone"
        : mediaType === "video"
        ? "camera"
        : "microphone and camera";

    // Log the error
    customLog({
      name: "Device Permission Error",
      errCode: "VA_DEVICE_PERM_001",
      errTrace: safeStringify({ mediaType, mediaText }),
      interviewID: interviewID,
    });

    console.log(
      `[ERROR] Showing device permission error modal for: ${mediaText}`
    );

    // Close any existing modals first and wait for it to complete
    try {
      await Swal.close();
    } catch (e) {
      // Ignore errors when closing
    }

    // Wait a bit longer to ensure DOM is ready
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(async () => {
      try {
        const result = await Swal.fire({
          icon: "info",
          title: "Recording Issue Detected",
          html: `
            <div style="text-align: left;">
              <p style="margin-bottom: 15px;">We detected an issue with your ${mediaText} recording.</p>
              <p style="margin-bottom: 15px;"><strong>Please check:</strong></p>
              <ul style="text-align: left; margin-left: 20px; margin-bottom: 15px;">
                <li>Your ${mediaText} is properly connected</li>
                <li>Browser permissions are granted for ${mediaText}</li>
                <li>No other application is using your ${mediaText}</li>
                <li>Your device settings allow ${mediaText} access</li>
              </ul>
              <p style="margin-top: 15px;">After checking, please reload the page to restart the interview.</p>
            </div>
          `,
          confirmButtonText: "Reload Page",
          allowOutsideClick: false,
          allowEscapeKey: false,
          showCancelButton: false,
          didOpen: () => {
            console.log(
              `[INFO] Device permission error modal opened for: ${mediaText}`
            );
          },
        });

        if (result.isConfirmed) {
          window.location.reload();
        }
      } catch (error) {
        console.error(
          "[ERROR] Failed to show device permission error modal:",
          error
        );
        // Fallback: try again after a delay
        setTimeout(async () => {
          try {
            await Swal.fire({
              icon: "info",
              title: "Recording Issue Detected",
              text: `We detected an issue with your ${mediaText} recording. Please check your device and permissions, then reload the page.`,
              confirmButtonText: "Reload Page",
              allowOutsideClick: false,
              allowEscapeKey: false,
              showCancelButton: false,
            }).then((result) => {
              if (result.isConfirmed) {
                window.location.reload();
              }
            });
          } catch (retryError) {
            console.error("[ERROR] Retry modal also failed:", retryError);
            // Last resort: alert
            if (
              window.confirm(
                `Recording issue detected with ${mediaText}. Reload page?`
              )
            ) {
              window.location.reload();
            }
          }
        }, 500);
      }
    });
  };

  // Helper function to show WebRTC/OpenAI API error modal
  const showConnectionError = async (
    errorType: "webrtc" | "openai",
    errorDetails?: any
  ) => {
    const errorTitle =
      errorType === "webrtc"
        ? "WebRTC Connection Error"
        : "OpenAI API Connection Error";

    // Log the error
    customLog({
      name: `${errorTitle} - Final Failure`,
      errCode:
        errorType === "webrtc" ? "VA_WEBRTC_FINAL_001" : "VA_OPENAI_FINAL_001",
      errTrace: safeStringify({
        errorType,
        errorDetails,
        retryAttempts:
          errorType === "webrtc"
            ? webrtcRetryCountRef.current
            : openaiRetryCountRef.current,
      }),
      interviewID: interviewID,
    });

    console.log(`[ERROR] Showing connection error modal for: ${errorTitle}`);

    // Close any existing modals first and wait for it to complete
    try {
      await Swal.close();
    } catch (e) {
      // Ignore errors when closing
    }

    // Wait a bit longer to ensure DOM is ready
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(async () => {
      try {
        const result = await Swal.fire({
          icon: "error",
          title: "Serious Error Occurred",
          html: `
            <div style="text-align: left;">
              <p style="margin-bottom: 15px;">A serious connection error has occurred (${errorTitle}).</p>
              <p style="margin-bottom: 15px;"><strong>Please check:</strong></p>
              <ul style="text-align: left; margin-left: 20px; margin-bottom: 15px;">
                <li>Your internet connection is stable</li>
                <li>You are not behind a firewall blocking connections</li>
                <li>Your network allows WebRTC connections</li>
                <li>Try refreshing your connection</li>
              </ul>
              <p style="margin-top: 15px;">You can reload the page to restart the interview.</p>
            </div>
          `,
          confirmButtonText: "Reload Page",
          allowOutsideClick: false,
          allowEscapeKey: false,
          showCancelButton: false,
          didOpen: () => {
            console.log(
              `[INFO] Connection error modal opened for: ${errorTitle}`
            );
          },
        });

        if (result.isConfirmed) {
          window.location.reload();
        }
      } catch (error) {
        console.error("[ERROR] Failed to show connection error modal:", error);
        // Fallback: try again after a delay
        setTimeout(async () => {
          try {
            await Swal.fire({
              icon: "error",
              title: "Serious Error Occurred",
              text: `A serious connection error has occurred (${errorTitle}). Please check your connection and reload the page.`,
              confirmButtonText: "Reload Page",
              allowOutsideClick: false,
              allowEscapeKey: false,
              showCancelButton: false,
            }).then((result) => {
              if (result.isConfirmed) {
                window.location.reload();
              }
            });
          } catch (retryError) {
            console.error("[ERROR] Retry modal also failed:", retryError);
            // Last resort: alert
            if (
              window.confirm(
                `Connection error occurred (${errorTitle}). Reload page?`
              )
            ) {
              window.location.reload();
            }
          }
        }, 500);
      }
    });
  };

  // Helper function to attempt WebRTC reconnection
  const attemptWebRTCReconnection = async (
    keyResponse: any,
    error: any,
    retryFunction: () => void
  ) => {
    if (webrtcRetryCountRef.current < MAX_RETRY_ATTEMPTS) {
      webrtcRetryCountRef.current += 1;
      console.log(
        `[INFO] Attempting WebRTC reconnection (${webrtcRetryCountRef.current}/${MAX_RETRY_ATTEMPTS})`
      );

      customLog({
        name: "WebRTC Reconnection Attempt",
        errCode: "VA_WEBRTC_RETRY_002",
        errTrace: safeStringify({
          attempt: webrtcRetryCountRef.current,
          maxAttempts: MAX_RETRY_ATTEMPTS,
          error: safeStringify(error),
        }),
        interviewID: interviewID,
      });

      // Wait 2 seconds before retry
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Reset retry count on successful connection (will be reset in the success handler)
      try {
        retryFunction();
      } catch (retryError) {
        console.error("[Error] Reconnection attempt failed:", retryError);
        // If retry function throws, try again or show error
        if (webrtcRetryCountRef.current >= MAX_RETRY_ATTEMPTS) {
          showConnectionError("webrtc", retryError);
        } else {
          attemptWebRTCReconnection(keyResponse, retryError, retryFunction);
        }
      }
    } else {
      // All retries exhausted
      console.error("[Error] WebRTC reconnection failed after all attempts");
      webrtcRetryCountRef.current = 0; // Reset for next session
      showConnectionError("webrtc", error);
    }
  };

  // Helper function to attempt OpenAI API reconnection
  const attemptOpenAIReconnection = async (
    retryFunction: () => Promise<void>,
    error: any
  ) => {
    if (openaiRetryCountRef.current < MAX_RETRY_ATTEMPTS) {
      openaiRetryCountRef.current += 1;
      console.log(
        `[INFO] Attempting OpenAI API reconnection (${openaiRetryCountRef.current}/${MAX_RETRY_ATTEMPTS})`
      );

      customLog({
        name: "OpenAI API Reconnection Attempt",
        errCode: "VA_OPENAI_RETRY_002",
        errTrace: safeStringify({
          attempt: openaiRetryCountRef.current,
          maxAttempts: MAX_RETRY_ATTEMPTS,
          error: safeStringify(error),
        }),
        interviewID: interviewID,
      });

      // Wait 2 seconds before retry
      await new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        await retryFunction();
        // Reset on success
        openaiRetryCountRef.current = 0;
      } catch (retryError) {
        console.error(
          "[Error] OpenAI reconnection attempt failed:",
          retryError
        );
        if (openaiRetryCountRef.current >= MAX_RETRY_ATTEMPTS) {
          openaiRetryCountRef.current = 0; // Reset for next session
          showConnectionError("openai", retryError);
        } else {
          attemptOpenAIReconnection(retryFunction, retryError);
        }
      }
    } else {
      // All retries exhausted
      console.error(
        "[Error] OpenAI API reconnection failed after all attempts"
      );
      openaiRetryCountRef.current = 0; // Reset for next session
      showConnectionError("openai", error);
    }
  };

  function start() {
    if (!localStorage.acceptedDisclaimer) {
      runDisclaimer(start);
      return false;
    }

    // Verify audio track is active before starting - ALWAYS REQUIRED
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      const hasActiveAudio =
        audioTracks.length > 0 &&
        audioTracks.some((t) => t.enabled && t.readyState === "live");

      if (!hasActiveAudio) {
        console.error("[Error] Cannot start: Audio track not active");
        // Check if track exists but is disabled
        const disabledTrack = audioTracks.find(
          (t) => !t.enabled && t.readyState === "live"
        );
        if (disabledTrack) {
          showDeviceDisabledModal("audio", false);
        } else {
          showDevicePermissionError("audio");
        }
        return false;
      }

      // Double-check: ensure microphone is enabled
      const enabledTrack = audioTracks.find(
        (t) => t.enabled && t.readyState === "live"
      );
      if (!enabledTrack) {
        console.error("[Error] Cannot start: Microphone is disabled");
        showDeviceDisabledModal("audio", false);
        return false;
      }

      // Verify video track if required
      if (interviewDetails?.requireVideo) {
        const videoTracks = streamRef.current.getVideoTracks();
        const hasActiveVideo =
          videoTracks.length > 0 &&
          videoTracks.some((t) => t.enabled && t.readyState === "live");

        if (!hasActiveVideo) {
          console.error("[Error] Cannot start: Video track not active");
          showDevicePermissionError("video");
          return false;
        }
      }
    }

    // Verify MediaRecorder is ready
    if (!mixedRecorderRef.current) {
      console.error("[Error] Cannot start: MediaRecorder not initialized");
      showDevicePermissionError(
        interviewDetails?.requireVideo ? "both" : "audio"
      );
      return false;
    }

    try {
      recorderRef.current?.start();
      // Add timesplice to chunk data every 1 second
      mixedRecorderRef.current?.start(1000);

      // Verify recording actually started
      setTimeout(() => {
        if (mixedRecorderRef.current?.state !== "recording") {
          console.error("[Error] Recording did not start properly");
          const hasAudio = streamRef.current
            ?.getAudioTracks()
            .some((t) => t.enabled && t.readyState === "live");
          const hasVideo = interviewDetails?.requireVideo
            ? streamRef.current
                ?.getVideoTracks()
                .some((t) => t.enabled && t.readyState === "live")
            : true;

          if (!hasAudio) {
            showDevicePermissionError("audio");
          } else if (interviewDetails?.requireVideo && !hasVideo) {
            showDevicePermissionError("video");
          } else {
            showDevicePermissionError(
              interviewDetails?.requireVideo ? "both" : "audio"
            );
          }
          return;
        }
      }, 1000);

      setIsSpeaking(true);

      if (document.getElementById("play-tts-btn")) {
        setTimeout(() => {
          document.getElementById("play-tts-btn").click();
        }, 200);
      }

      setIsStarted(true);
    } catch (error) {
      console.error("[Error] Failed to start recording:", error);
      customLog({
        name: "Recording Start Error",
        errCode: "VA_REC_START_001",
        errTrace: safeStringify(error),
        interviewID: interviewID,
      });
      showDevicePermissionError(
        interviewDetails?.requireVideo ? "both" : "audio"
      );
      return false;
    }
  }

  function endInterview() {
    recorderRef.current?.stop();
    mixedRecorderRef.current?.stop();
    setIsSpeaking(false);
    setJiaSpeaking(false);
    setUserSpeaking(false);

    setCurrentScreen("summary");
    setCurrentJiaMessage(null);

    // Trigger the run-auto-interview endpoint when ending the interview
    try {
      api.post("/api/autorun-interview-analysis", {
        interviewID: interviewID,
      });
    } catch (err) {
      console.warn("Failed to trigger run-auto-interview endpoint:", err);
    }
  }

  function stop() {
    if (savingInProgress) {
      infoToast(
        "JIA is trying to save your responses, please try again in a few moments...",
        2500
      );
      return false;
    }

    // Get all user messages
    const userMessages = message.filter((msg) => msg.type === "user");

    // If no user messages, return false
    if (userMessages.length === 0) {
      Swal.fire({
        icon: "info",
        title: "No Transcript warning",
        text: "Are you sure you want to end the interview? JIA has not recorded any transcript yet. You can refresh the page and start again to continue. If really want to end the interview, click on the button below.",
        confirmButtonText: "End Interview",
        allowOutsideClick: false,
        showCancelButton: true,
      }).then((result) => {
        if (result.isConfirmed) {
          endInterview();
        }
      });

      return false;
    }

    // Count all words from user messages
    const totalWords = userMessages.reduce((wordCount, msg) => {
      if (!msg.content) return wordCount;

      // Handle both string and array content
      const content = Array.isArray(msg.content)
        ? msg.content.join(" ")
        : String(msg.content);

      // Count words by splitting on whitespace and filtering out empty strings
      const words = content
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0);
      return wordCount + words.length;
    }, 0);

    // If total word count is less than 200, show warning
    if (totalWords < 200) {
      Swal.fire({
        icon: "info",
        title: "Insufficient transcript warning",
        text: `Are you sure you want to end the interview? JIA has only recorded ${totalWords} words. You can refresh the page and start again if you are having issues with the interview. If really want to end the interview, click on the button below.`,
        confirmButtonText: "End Interview",
        allowOutsideClick: false,
        showCancelButton: true,
      }).then((result) => {
        if (result.isConfirmed) {
          endInterview();
        }
      });

      return false;
    }

    endInterview();
  }

  function runDisclaimer(start: any) {
    const steps = [
      {
        title: "Interview Terms and Conditions",
        html: `
          <div style="text-align: left; padding: 20px;">
            <p style="margin-bottom: 20px;">By proceeding, you confirm that you have read, understood, and agree to the following terms:</p>
            
            <div style="margin-bottom: 15px;">
              <h3 style="color: #333; margin-bottom: 8px;">Authenticity</h3>
              <p style="margin: 0; font-size: 14px;">You will complete this interview independently. You confirm that all responses provided are your own and that you are the actual applicant participating in the interview.</p>
            </div>
            
            <div style="margin-bottom: 15px;">
              <h3 style="color: #333; margin-bottom: 8px;">Fairness</h3>
              <p style="margin: 0; font-size: 14px;">You agree not to use any external assistance, tools, or AI systems that may give you an unfair advantage over other applicants.</p>
            </div>
            
            <div style="margin-bottom: 15px;">
              <h3 style="color: #333; margin-bottom: 8px;">Confidentiality</h3>
              <p style="margin: 0; font-size: 14px;">You will not copy, share, or distribute any part of the interview questions or process to others in any form.</p>
            </div>
            
            <div style="margin-bottom: 15px;">
              <h3 style="color: #333; margin-bottom: 8px;">Audio Recording</h3>
              <p style="margin: 0; font-size: 14px;">You consent to the recording of your audio responses for the purpose of review, assessment, and audit. These recordings will be handled in accordance with our data privacy policy.</p>
            </div>
            
            <div style="margin-bottom: 15px;">
              <h3 style="color: #333; margin-bottom: 8px;">Data Privacy</h3>
              <p style="margin: 0; font-size: 14px;">Your interview data, including audio and metadata, will be stored securely and used solely for recruitment purposes in compliance with applicable data protection laws.</p>
            </div>
            
            <p style="margin-top: 20px; font-weight: bold;">By clicking Start Interview, you agree to be bound by these terms.</p>
          </div>
        `,
        confirmButtonText: "Start Interview",
        showCancelButton: true,
        cancelButtonText: "Cancel",
        preConfirm: undefined,
      },
    ];

    let currentStep = 0;

    const showStep = (stepIndex: number) => {
      const step = steps[stepIndex];

      Swal.fire({
        title: step.title,
        html: step.html,
        confirmButtonText: step.confirmButtonText,
        showCancelButton: step.showCancelButton || false,
        cancelButtonText: step.cancelButtonText || "Cancel",
        allowOutsideClick: false,
        allowEscapeKey: false,
        heightAuto: false,
        preConfirm: step.preConfirm,
        customClass: {
          popup: "disclaimer-popup fade-in-bottom",
          htmlContainer: "disclaimer-html-container",
        },
        showClass: {
          popup: `
     fade-in-bottom
    `,
        },
      }).then((result) => {
        if (result.isConfirmed) {
          if (stepIndex < steps.length - 1) {
            currentStep++;
            showStep(currentStep);
          } else {
            // All steps completed, mark disclaimer as accepted and start interview
            localStorage.setItem("acceptedDisclaimer", "true");
            start();
          }
        } else if (result.isDismissed && step.showCancelButton) {
          // User cancelled on final step
          Swal.fire({
            icon: "info",
            title: "Interview Cancelled",
            text: "You can restart when you're ready.",
            confirmButtonText: "OK",
          });
        }
      });
    };

    // Start the disclaimer flow
    showStep(0);
  }

  async function progressivelySaveTranscript() {
    if (message.length === 0) {
      return false;
    }

    let currentMessage = message[message.length - 1];

    setSavingInProgress(true);

    await api
      .post("/api/save-transcript", {
        interviewID: interviewID,
        data: [currentMessage],
      })
      .then((res) => {
        // console.log(`[INFO] Message ${currentMessage.uid} Saved!`);
        setSavingInProgress(false);
        Swal.close();
      })
      .catch((err) => {
        console.log(`[ERR] Message ${currentMessage.uid}`);
        console.log(err);
        customLog({
          name: "Transcript Save Error",
          errCode: "VA_TRANS_SAVE_001",
          errTrace: safeStringify(err),
          interviewID: interviewID,
        });
        setSavingInProgress(false);
        Swal.close();
      });

    // Save session context for continuity (fire-and-forget, chained to avoid races)
    contextSaveChainRef.current = contextSaveChainRef.current.then(async () => {
      try {
        const transcript = message.map((msg: any) => ({
          role: msg.type === "user" ? "user" : "jia",
          text:
            typeof msg.content === "string"
              ? msg.content
              : Array.isArray(msg.content)
              ? msg.content.join(" ")
              : String(msg.content || ""),
          time: msg.time,
        }));

        const allQuestions = selectedQuestionsRef.current;

        const getMsgText = (msg: any): string =>
          typeof msg.content === "string"
            ? msg.content
            : Array.isArray(msg.content)
            ? msg.content.join(" ")
            : String(msg.content || "");

        const fuzzyMatchesQuestion = (
          jiaText: string,
          question: string
        ): boolean => {
          const qWords = question
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 3);
          if (qWords.length === 0) return false;
          const jiaLower = jiaText.toLowerCase();
          const matchCount = qWords.filter((w) => jiaLower.includes(w)).length;
          return matchCount >= Math.ceil(qWords.length * 0.4);
        };

        type QuestionStatus = {
          index: number;
          question: string;
          status: "unanswered" | "asked" | "answered";
          answer?: string;
        };

        const questionsStatus: QuestionStatus[] = allQuestions.map(
          (q, idx) => ({
            index: idx,
            question: q,
            status: "unanswered" as const,
          })
        );

        // Walk the transcript sequentially to pair questions with answers
        for (let i = 0; i < message.length; i++) {
          const msg = message[i];
          if (msg.type !== "jia") continue;

          const jiaText = getMsgText(msg);
          const matchedIdx = questionsStatus.findIndex(
            (qs) =>
              qs.status === "unanswered" &&
              fuzzyMatchesQuestion(jiaText, qs.question)
          );
          if (matchedIdx === -1) continue;

          questionsStatus[matchedIdx].status = "asked";

          // Look for the next user response before the next jia message
          for (let j = i + 1; j < message.length; j++) {
            if (message[j].type === "jia") break;
            if (message[j].type === "user") {
              const userText = getMsgText(message[j]).trim();
              if (userText.length > 0) {
                questionsStatus[matchedIdx].status = "answered";
                questionsStatus[matchedIdx].answer = userText;
              }
              break;
            }
          }
        }

        const questionsAsked = questionsStatus
          .filter((qs) => qs.status !== "unanswered")
          .map((qs) => qs.index);
        const lastQuestionIndex =
          questionsAsked.length > 0 ? Math.max(...questionsAsked) : 0;

        await api.post("/api/interview-context", {
          interviewID,
          transcript,
          questionsAsked,
          lastQuestionIndex,
          allQuestions,
          questionsStatus: questionsStatus.map((qs) => ({
            index: qs.index,
            question: qs.question,
            status: qs.status,
            ...(qs.answer ? { answer: qs.answer.slice(0, 500) } : {}),
          })),
        });
      } catch (err) {
        console.warn("[WARN] Failed to save session context:", err);
      }
    });
  }

  const [interviewDetails, setInterviewDetails] = useState(null);
  const [meetingPrompt, setMeetingPrompt] = useState(null);

  const fetchInterviewDetails = async () => {
    Swal.fire({
      icon: "info",
      title: "Preparing Interview...",
      text: "Please wait, for a few moments, Thank you..",
      allowOutsideClick: false,
      showCancelButton: false,
      showConfirmButton: false,
      showClass: {
        popup: `
     fade-in-bottom
    `,
      },
    });
    Swal.showLoading();

    const response = await api
      .post("/api/interview-details", {
        id: interviewID,
      })
      .then((res: any) => {
        return res;
      })
      .catch((err) => {
        console.log(err);
        customLog({
          name: "Interview Details Fetch Error",
          errCode: "VA_INT_DETAILS_001",
          errTrace: safeStringify(err),
          interviewID: interviewID,
        });
        Swal.fire({
          icon: "error",
          title: "Interview Not Found",
          text: "This interview is not available anymore.",
          allowOutsideClick: false,
        }).then((res) => {
          if (res.isConfirmed) {
            window.location.href = "/dashboard";
            // const interviewRedirection = sessionStorage.getItem(
            //   "interviewRedirection"
            // );

            // if (interviewRedirection) {
            //   sessionStorage.removeItem("interviewRedirection");
            //   window.location.href = interviewRedirection;
            // } else {
            //   window.location.href = "/applicant";
            // }
          }
        });

        return false;
      });

    let details = response.data;

    if (!["For Interview", "For AI Interview"].includes(details.status)) {
      window.location.href = "/dashboard";
      // const interviewRedirection = sessionStorage.getItem(
      //   "interviewRedirection"
      // );

      // if (interviewRedirection) {
      //   sessionStorage.removeItem("interviewRedirection");
      //   window.location.href = interviewRedirection;
      // } else {
      //   window.location.href = "/applicant";
      // }

      return false;
    }

    // Set default requireVideo to true if it is undefined or null
    if (details.requireVideo === undefined || details.requireVideo === null) {
      details.requireVideo = true;
    }

    setInterviewDetails(details);

    let selectedQuestions = [];
    if (details.questions?.[0]?.category) {
      const filteredQuestions = details.questions.filter(
        (questionGroup) => questionGroup.questions.length > 0
      );

      filteredQuestions.forEach((questionGroup) => {
        const allQuestionsInGroup = questionGroup.questions.map(
          (question) => question.question
        );

        // If questionCountToAsk is specified and valid, limit the questions
        if (
          questionGroup.questionCountToAsk !== null &&
          questionGroup.questionCountToAsk !== undefined &&
          questionGroup.questionCountToAsk > 0 &&
          questionGroup.questionCountToAsk < allQuestionsInGroup.length
        ) {
          // Take only the specified number of questions from this category
          selectedQuestions.push(
            ...allQuestionsInGroup.slice(0, questionGroup.questionCountToAsk)
          );
        } else {
          // Use all questions if no limit is specified or limit is >= total questions
          selectedQuestions.push(...allQuestionsInGroup);
        }
      });
    } else {
      // Old data structure
      selectedQuestions = details.questions.map(
        (question) => question.question
      );
    }

    selectedQuestionsRef.current = selectedQuestions;

    // Build question list with category information
    let questionListText = "";
    let questionNumber = 1;

    if (details.questions?.[0]?.category) {
      const filteredQuestions = details.questions.filter(
        (questionGroup) => questionGroup.questions.length > 0
      );

      filteredQuestions.forEach((questionGroup) => {
        const allQuestionsInGroup = questionGroup.questions.map(
          (question) => question.question
        );

        let questionsToAsk = allQuestionsInGroup;
        if (
          questionGroup.questionCountToAsk !== null &&
          questionGroup.questionCountToAsk !== undefined &&
          questionGroup.questionCountToAsk > 0 &&
          questionGroup.questionCountToAsk < allQuestionsInGroup.length
        ) {
          questionsToAsk = allQuestionsInGroup.slice(
            0,
            questionGroup.questionCountToAsk
          );
        }

        if (questionsToAsk.length > 0) {
          questionListText += `\n${questionGroup.category} (${
            questionsToAsk.length
          } question${questionsToAsk.length > 1 ? "s" : ""}):\n`;
          questionsToAsk.forEach((question) => {
            questionListText += `${questionNumber}. ${question}\n`;
            questionNumber++;
          });
        }
      });
    } else {
      // Old data structure
      selectedQuestions.forEach((question, i) => {
        questionListText += `${i + 1}. ${question}\n`;
      });
    }

    // Fetch secret prompt separately for security
    let secretPrompt = "";
    try {
      const secretPromptResponse = await api.post(
        "/api/get-interview-secret-prompt",
        {
          interviewID: interviewID,
        }
      );
      secretPrompt = secretPromptResponse.data?.interviewSecretPrompt || "";
    } catch (error) {
      console.log("No secret prompt found or error fetching:", error);
      // Continue without secret prompt
    }

    let interviewInstructions = `
    You an Job Interview Assistant named Jia from White Cloak Technologies
    Speak and conduct the entire interview in ${details.aiInterviewLanguage || "English"}.
    Greet the user first to start the interview in the specified language.
    Interview the applicant based of the information and instructions below:

    Applicant Name: 
    ${details.name}
    Role Applying for: 
    ${details.jobTitle}
    Job Description: 
    ${details.description}

    Question List:
    ${questionListText}

    
      ${details.config?.traits_prompt?.prompt || ""}
    `;

    console.log(interviewInstructions);

    // Load session context for continuity (if candidate was previously disconnected)
    try {
      const contextResponse = await api.get(
        `/api/interview-context?interviewID=${interviewID}`
      );
      const ctx = contextResponse.data?.context;
      if (ctx && ctx.transcript && ctx.transcript.length > 0) {
        console.log(
          "[INFO] Session context found, resuming interview. Reconnect count:",
          ctx.reconnectCount
        );
        sessionContextRef.current = ctx;
        isResumedSessionRef.current = true;

        const restoredMessages = ctx.transcript.map(
          (turn: { role: string; text: string; time: number }) => ({
            type: turn.role === "user" ? "user" : "jia",
            content: turn.text,
            time: turn.time,
            uid: guid(),
            restored: true,
          })
        );
        setMessage(restoredMessages);

        const firstName = (details.name || "").split(" ")[0];
        const resumeGreetings = [
          `Welcome back${firstName ? `, ${firstName}` : ""}! Sorry about the interruption. Let's pick up right where we left off.`,
          `Glad you're back${firstName ? `, ${firstName}` : ""}! Sorry about that. Let's continue the interview.`,
          `Hey${firstName ? ` ${firstName}` : ""}, welcome back! Apologies for the disruption. We'll continue from where we stopped.`,
          `Good to see you again${firstName ? `, ${firstName}` : ""}! Sorry for the interruption, let's get back to it.`,
          `You're back${firstName ? `, ${firstName}` : ""}! No worries about the disconnect. Let's carry on with the interview.`,
        ];
        const greetIdx = (ctx.reconnectCount || 1) % resumeGreetings.length;
        setGreetingText(resumeGreetings[greetIdx]);
      } else {
        const firstName = (details.name || "").split(" ")[0];
        const freshGreetings = [
          `Hello${firstName ? ` ${firstName}` : " there"}, welcome to your interview! When you're ready, just start speaking.`,
          `Hi${firstName ? ` ${firstName}` : ""}! Great to meet you. Let's get started, just speak whenever you're ready.`,
          `Welcome${firstName ? `, ${firstName}` : ""}! I'm Jia and I'll be conducting your interview today. Go ahead and start whenever you're ready.`,
        ];
        const greetIdx = Math.floor(Math.random() * freshGreetings.length);
        setGreetingText(freshGreetings[greetIdx]);
      }
    } catch (err) {
      console.warn("[INFO] No session context found or error fetching:", err);
    }

    setMeetingPrompt(interviewInstructions);
  };

  const fns = {
    endInterview: () => {
      stop();
      return { success: true };
    },
  };

  useEffect(() => {
    fetchInterviewDetails();
    enumerateDevices();

    window.switchTabCount = 0;

    window.onblur = () => {
      window.switchTabCount += 1;
      console.log("Tab switched away. Count:", window.switchTabCount);
    };

    window.onfocus = () => {
      console.log("Tab focused back. Count:", window.switchTabCount);
    };
  }, []);

  const handleVideoEnded = () => {
    console.log("[INFO] Camera has been turned off or disconnected");
    setCameraOpen(false);

    // If video is required and interview has started, show modal
    if (interviewDetails?.requireVideo && isStarted) {
      showDeviceDisabledModal("video", true);
    }
  };

  useEffect(() => {
    if (meetingPrompt && isReady) {
      let BASE_URL = window.location.origin;

      api
        .post(`${BASE_URL}/api/ephemeral-key`, {
          instructions: meetingPrompt,
          config: interviewDetails.config,
          interviewID: interviewID,
          candidateName: interviewDetails.name,
          sessionContext: sessionContextRef.current || undefined,
          tools: [
            {
              type: "function",
              name: "endInterview",
              description:
                "Ends the interview, can be triggered by assistant or user",
              parameters: {
                type: "object",
                properties: {},
              },
            },
          ],
        })
        .then((keyResponse) => {
          const startWebRTCLLMSession = (keyResponse: any) => {
            // Validate and get available devices
            const validVideoDevice = isDeviceAvailable(
              selectedVideoDevice,
              cameraDevices
            )
              ? selectedVideoDevice
              : getFallbackDevice(cameraDevices);

            const validAudioDevice = isDeviceAvailable(
              selectedMicrophoneDevice,
              microphoneDevices
            )
              ? selectedMicrophoneDevice
              : getFallbackDevice(microphoneDevices);

            // Create constraints based on selected devices
            const videoConstraints = Boolean(interviewDetails?.requireVideo)
              ? {
                  width: { ideal: 640 },
                  height: { ideal: 360 },
                  frameRate: { ideal: 15 },
                  deviceId: validVideoDevice ? validVideoDevice : undefined,
                }
              : false;

            const audioConstraints = {
              noiseSuppression: true,
              autoGainControl: true,
              echoCancellation: true,
              deviceId: validAudioDevice ? validAudioDevice : undefined,
            };

            navigator.mediaDevices
              .getUserMedia({
                video: videoConstraints,
                audio: audioConstraints,
              })
              .then(async (stream) => {
                // Store stream reference
                streamRef.current = stream;

                // Verify audio track is present and active - ALWAYS REQUIRED
                const audioTracks = stream.getAudioTracks();
                if (audioTracks.length === 0) {
                  console.error("[Error] Audio track not available");
                  showDevicePermissionError("audio");
                  return;
                }

                // Check if audio track is disabled
                if (!audioTracks[0].enabled) {
                  console.error("[Error] Audio track is disabled");
                  showDeviceDisabledModal("audio", true);
                  return;
                }

                if (audioTracks[0].readyState !== "live") {
                  console.error("[Error] Audio track not live");
                  showDevicePermissionError("audio");
                  return;
                }

                setAudioTrackActive(true);

                // Verify video track if required
                if (interviewDetails?.requireVideo) {
                  const videoTracks = stream.getVideoTracks();
                  if (videoTracks.length === 0) {
                    console.error("[Error] Video track not available");
                    showDevicePermissionError("video");
                    return;
                  }

                  // Check if video track is disabled
                  if (!videoTracks[0].enabled) {
                    console.error("[Error] Video track is disabled");
                    showDeviceDisabledModal("video", true);
                    return;
                  }

                  if (videoTracks[0].readyState !== "live") {
                    console.error("[Error] Video track not live");
                    showDevicePermissionError("video");
                    return;
                  }

                  setVideoTrackActive(true);
                }

                // Monitor audio track for issues - ALWAYS REQUIRED
                audioTracks.forEach((track) => {
                  track.addEventListener("ended", () => {
                    console.error("[Error] Audio track ended unexpectedly");
                    setAudioTrackActive(false);
                    showDeviceDisabledModal("audio", true);
                  });

                  // Monitor when track is disabled
                  const checkAudioEnabled = () => {
                    if (!track.enabled && track.readyState === "live") {
                      console.warn("[Warning] Audio track disabled");
                      setAudioTrackActive(false);
                      showDeviceDisabledModal("audio", false);
                    } else if (
                      track.enabled &&
                      track.readyState === "live" &&
                      !audioTrackActive
                    ) {
                      setAudioTrackActive(true);
                      // Reset modal flag when track is re-enabled
                      deviceModalShownRef.current.audio = false;
                    }
                  };

                  // Check immediately
                  checkAudioEnabled();

                  // Monitor for changes
                  track.addEventListener("mute", () => {
                    console.warn("[Warning] Audio track muted");
                    checkAudioEnabled();
                  });

                  // Use a MutationObserver-like approach with periodic checks
                  const audioCheckInterval = setInterval(() => {
                    if (track.readyState === "live") {
                      checkAudioEnabled();
                    } else {
                      clearInterval(audioCheckInterval);
                    }
                  }, 1000);

                  // Clean up interval when track ends
                  track.addEventListener("ended", () => {
                    clearInterval(audioCheckInterval);
                  });
                });

                // Monitor video tracks for issues if required
                if (interviewDetails?.requireVideo) {
                  stream.getVideoTracks().forEach((track) => {
                    track.addEventListener("ended", () => {
                      console.error("[Error] Video track ended unexpectedly");
                      setVideoTrackActive(false);
                      showDeviceDisabledModal("video", true);
                    });

                    // Monitor when track is disabled
                    const checkVideoEnabled = () => {
                      if (!track.enabled && track.readyState === "live") {
                        console.warn("[Warning] Video track disabled");
                        setVideoTrackActive(false);
                        showDeviceDisabledModal("video", true);
                      } else if (
                        track.enabled &&
                        track.readyState === "live" &&
                        !videoTrackActive
                      ) {
                        setVideoTrackActive(true);
                        // Reset modal flag when track is re-enabled
                        deviceModalShownRef.current.video = false;
                      }
                    };

                    // Check immediately
                    checkVideoEnabled();

                    // Monitor for changes
                    track.addEventListener("mute", () => {
                      console.warn("[Warning] Video track muted");
                      checkVideoEnabled();
                    });

                    // Use periodic checks to detect when video is disabled
                    const videoCheckInterval = setInterval(() => {
                      if (track.readyState === "live") {
                        checkVideoEnabled();
                      } else {
                        clearInterval(videoCheckInterval);
                      }
                    }, 1000);

                    // Clean up interval when track ends
                    track.addEventListener("ended", () => {
                      clearInterval(videoCheckInterval);
                    });
                  });
                }

                // close loading button
                Swal.close();

                // Reset retry counters on successful stream acquisition
                webrtcRetryCountRef.current = 0;
                openaiRetryCountRef.current = 0;

                const recorder = new MediaRecorder(stream);
                recorderRef.current = recorder;

                const EPHEMERAL_KEY = keyResponse.data.key.client_secret.value;
                const pc = new RTCPeerConnection();
                pcRef.current = pc;

                // Monitor WebRTC peer connection errors
                pc.onconnectionstatechange = () => {
                  console.log(
                    "[INFO] WebRTC connection state:",
                    pc.connectionState
                  );

                  // Reset retry count on successful connection
                  if (pc.connectionState === "connected") {
                    webrtcRetryCountRef.current = 0;
                  }

                  if (
                    pc.connectionState === "failed" ||
                    pc.connectionState === "disconnected"
                  ) {
                    console.error(
                      "[Error] WebRTC connection failed or disconnected"
                    );

                    customLog({
                      name: "WebRTC Connection State Error",
                      errCode: "VA_WEBRTC_STATE_001",
                      errTrace: safeStringify({
                        connectionState: pc.connectionState,
                        isStarted,
                        retryCount: webrtcRetryCountRef.current,
                      }),
                      interviewID: interviewID,
                    });

                    if (isStarted) {
                      attemptWebRTCReconnection(
                        keyResponse,
                        { connectionState: pc.connectionState },
                        () => {
                          // Retry by reinitializing the session
                          startWebRTCLLMSession(keyResponse);
                        }
                      );
                    }
                  }
                };

                pc.oniceconnectionstatechange = () => {
                  console.log(
                    "[INFO] ICE connection state:",
                    pc.iceConnectionState
                  );

                  // Reset retry count on successful connection
                  if (pc.iceConnectionState === "connected") {
                    webrtcRetryCountRef.current = 0;
                  }

                  if (
                    pc.iceConnectionState === "failed" ||
                    pc.iceConnectionState === "disconnected"
                  ) {
                    console.error(
                      "[Error] ICE connection failed or disconnected"
                    );

                    customLog({
                      name: "ICE Connection State Error",
                      errCode: "VA_ICE_STATE_001",
                      errTrace: safeStringify({
                        iceConnectionState: pc.iceConnectionState,
                        isStarted,
                        retryCount: webrtcRetryCountRef.current,
                      }),
                      interviewID: interviewID,
                    });

                    if (isStarted) {
                      attemptWebRTCReconnection(
                        keyResponse,
                        { iceConnectionState: pc.iceConnectionState },
                        () => {
                          // Retry by reinitializing the session
                          startWebRTCLLMSession(keyResponse);
                        }
                      );
                    }
                  }
                };

                // Create an audio context for mixing video and audio streams
                if (!audioContextRef.current) {
                  try {
                    audioContextRef.current = new AudioContext({
                      sampleRate: 16000,
                    });
                    if (audioContextRef.current.state === "suspended") {
                      await audioContextRef.current.resume();
                    }
                    console.log(
                      "[INFO] Audio Context Created",
                      audioContextRef.current.state
                    );
                  } catch (error) {
                    console.error("[Error] Creating Audio Context =>", error);
                    customLog({
                      name: "Audio Context Creation Error",
                      errCode: "VA_AUDIO_CTX_001",
                      errTrace: safeStringify(error),
                      interviewID: interviewID,
                    });
                  }
                }

                // Add video to the mix if required
                if (interviewDetails?.requireVideo && videoElement.current) {
                  videoElement.current.srcObject = stream;
                  videoElement2.current.srcObject = stream;
                  setCameraOpen(true);

                  stream.getVideoTracks().forEach((track) => {
                    track?.addEventListener("ended", () => {
                      handleVideoEnded();
                    });
                  });
                }
                const audioContext = audioContextRef.current;
                const destination = audioContext.createMediaStreamDestination();

                // Add microphone audio to the mix
                const micSource = audioContext.createMediaStreamSource(stream);
                micSource.connect(destination);

                // Create and connect speaker audio
                const audioEl = document.createElement("audio");
                audioEl.autoplay = true;
                pc.ontrack = (e) => {
                  audioEl.srcObject = e.streams[0];
                  // Add JIA speaker audio to the mix
                  const speakerSource = audioContext.createMediaStreamSource(
                    e.streams[0]
                  );
                  speakerSource.connect(destination);
                };
                pc.addTrack(stream.getTracks()[0]);

                // Create recorder with the mixed audio stream and video stream
                const mixedStream = new MediaStream([
                  ...destination.stream.getAudioTracks(),
                  ...stream.getVideoTracks(),
                ]);
                let mimeType = interviewDetails?.requireVideo
                  ? "video/webm;codecs=vp9,opus"
                  : "audio/webm;codecs=opus";
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                  console.log(
                    `[INFO] MIME type ${mimeType} not supported, using default`
                  );
                  mimeType = "";
                }
                const constraints: any = {
                  audioBitsPerSecond: 32000,
                };
                if (interviewDetails?.requireVideo) {
                  constraints.videoBitsPerSecond = 400000;
                }
                if (mimeType) {
                  constraints.mimeType = mimeType;
                }
                const mixedRecorder = new MediaRecorder(
                  mixedStream,
                  constraints
                );
                mixedRecorderRef.current = mixedRecorder;
                console.log(`[INFO] MIME type ${mixedRecorder.mimeType}`);
                actualMimeTypeRef.current =
                  mixedRecorder.mimeType ||
                  (interviewDetails?.requireVideo
                    ? "video/webm;codecs=vp9,opus"
                    : "audio/webm;codecs=opus");

                mixedRecorder.onerror = (event) => {
                  console.error("[Error] MediaRecorder error:", event);
                  customLog({
                    name: "MediaRecorder Error",
                    errCode: "VA_MEDIA_REC_001",
                    errTrace: safeStringify(event),
                    interviewID: interviewID,
                  });

                  // Check if recording is actually happening
                  if (isStarted && mixedRecorder.state !== "recording") {
                    const hasAudio =
                      mixedStream.getAudioTracks().length > 0 &&
                      mixedStream
                        .getAudioTracks()
                        .some((t) => t.enabled && t.readyState === "live");
                    const hasVideo = interviewDetails?.requireVideo
                      ? mixedStream.getVideoTracks().length > 0 &&
                        mixedStream
                          .getVideoTracks()
                          .some((t) => t.enabled && t.readyState === "live")
                      : true;

                    if (!hasAudio) {
                      showDevicePermissionError("audio");
                    } else if (interviewDetails?.requireVideo && !hasVideo) {
                      showDevicePermissionError("video");
                    }
                  }
                };

                mixedRecorder.onstop = () => {
                  console.log("[INFO] Recording stopped, finishing upload");
                  if (
                    bufferSizeRef.current > 0 &&
                    recordingChunksRef.current.length > 0
                  ) {
                    const finalChunk = new Blob(recordingChunksRef.current);
                    uploadChainRef.current = uploadChainRef.current.then(() =>
                      saveInterviewRecording(finalChunk)
                    );
                  }
                  uploadChainRef.current = uploadChainRef.current.then(() =>
                    completeInterviewUpload()
                  );
                };

                mixedRecorder.ondataavailable = (e) => {
                  if (e.data.size > 0) {
                    // console.log("[INFO] Recording chunk received");
                    recordingChunksRef.current.push(e.data);
                    bufferSizeRef.current += e.data.size;

                    let fullBlob = new Blob(recordingChunksRef.current);
                    let bufferSize = fullBlob.size;

                    while (bufferSize >= CHUNK_SIZE) {
                      const chunk = fullBlob.slice(0, CHUNK_SIZE);
                      uploadChainRef.current = uploadChainRef.current.then(() =>
                        saveInterviewRecording(chunk)
                      );

                      fullBlob = fullBlob.slice(CHUNK_SIZE);
                      bufferSize = fullBlob.size;
                    }

                    recordingChunksRef.current =
                      bufferSize > 0 ? [fullBlob] : [];
                    bufferSizeRef.current = bufferSize;
                  } else {
                    customLog({
                      name: "MediaRecorder Empty Chunk",
                      errCode: "VA_MEDIA_EMPTY_001",
                      errTrace: null,
                      interviewID: interviewID,
                    });
                  }
                };

                const dc = pc.createDataChannel("oai-events");

                // Monitor data channel errors
                dc.onerror = (error) => {
                  console.error("[Error] Data channel error:", error);
                  customLog({
                    name: "Data Channel Error",
                    errCode: "VA_DATA_CH_ERROR_001",
                    errTrace: safeStringify(error),
                    interviewID: interviewID,
                  });
                  if (isStarted) {
                    attemptWebRTCReconnection(keyResponse, error, () => {
                      // Retry by reinitializing the session
                      startWebRTCLLMSession(keyResponse);
                    });
                  }
                };

                dc.onclose = () => {
                  console.warn("[Warning] Data channel closed");
                  customLog({
                    name: "Data Channel Closed",
                    errCode: "VA_DATA_CH_CLOSED_001",
                    errTrace: safeStringify({ isStarted }),
                    interviewID: interviewID,
                  });
                  if (isStarted) {
                    attemptWebRTCReconnection(
                      keyResponse,
                      { reason: "Data channel closed" },
                      () => {
                        // Retry by reinitializing the session
                        startWebRTCLLMSession(keyResponse);
                      }
                    );
                  }
                };

                dc.addEventListener("message", (e) => {
                  try {
                    const data = JSON.parse(e.data);

                    // console.log(data);

                    if (
                      data.type.includes("input_audio_buffer.speech_started") ||
                      data.type.includes("input_audio_buffer.committed")
                    ) {
                      setUserSpeaking(true);
                      setSavingInProgress(true);
                      setJiaSpeaking(false);
                    }

                    if (
                      data.type.includes("output_audio") ||
                      data.type.includes("input_audio_buffer.speech_stopped")
                    ) {
                      setUserSpeaking(false);
                      setJiaSpeaking(true);
                    }

                    if (
                      data.type ===
                        "conversation.item.input_audio_transcription.completed" &&
                      data?.transcript
                    ) {
                      setMessage((prevMessages) => {
                        let lastMessage = prevMessages[prevMessages.length - 1];

                        if (
                          prevMessages.length === 0 ||
                          (lastMessage && lastMessage.type !== "user")
                        ) {
                          setSavingInProgress(true);
                          console.log("[new user msg] Add new user message");

                          let firstEntry = refineUserTranscriptInput(
                            data.transcript,
                            data.transcript
                          );

                          if (firstEntry.length === 0) {
                            return prevMessages;
                          }

                          return [
                            ...prevMessages,
                            {
                              type: "user",
                              content: firstEntry,
                              time: Date.now(),
                              uid: guid(),
                            },
                          ];
                        }

                        // bind content to the last type if it is the same type
                        if (lastMessage && lastMessage.type === "user") {
                          lastMessage.content = refineUserTranscriptInput(
                            lastMessage.content,
                            data.transcript
                          );
                          lastMessage.time = Date.now();
                          lastMessage.updated = true;

                          if (prevMessages.length === 0) return [lastMessage]; // edge case: empty array
                          return [...prevMessages.slice(0, -1), lastMessage]; // immutably replace last item
                        }
                      });
                    }

                    if (
                      data.type === "response.done" &&
                      data?.response?.output[0]?.type === "message"
                    ) {
                      setJiaSpeaking(true);
                      setUserSpeaking(false);
                      const newAIMessage = {
                        type: "jia",
                        content:
                          data?.response?.output[0]?.content[0]?.transcript,
                        time: Date.now(),
                        uid: guid(),
                      };

                      setCurrentJiaMessage(newAIMessage);

                      if (newAIMessage.content) {
                        setMessage((prevMessages) => {
                          // Check if this message content already exists in previous messages
                          const isDuplicate = prevMessages.some(
                            (msg) =>
                              msg.type === "jia" &&
                              msg.content === newAIMessage.content
                          );

                          if (isDuplicate) {
                            return prevMessages; // Don't add duplicate message
                          }

                          return [...prevMessages, newAIMessage].sort(
                            (a, b) => a.time - b.time
                          );
                        });
                      }
                    }

                    // handle function calls

                    // if (data.type === "response.function_call_arguments.done") {
                    //   const fn = fns[data.name];
                    //   fn();
                    // }

                    // catch possible event errors on custom logs
                    if (
                      data.type.includes("error") ||
                      data.type.includes("failed")
                    ) {
                      console.error("[Error] OpenAI Realtime error:", data);
                      customLog({
                        name: "OpenAI RT Error",
                        errCode: "VA_OPENAI_RT_001",
                        errTrace: safeStringify(data),
                        interviewID: interviewID,
                      });

                      // Show connection error for serious API errors
                      if (
                        isStarted &&
                        (data.type.includes("error") ||
                          data.type.includes("connection_failed"))
                      ) {
                        attemptOpenAIReconnection(async () => {
                          // For OpenAI errors, we need to reinitialize the entire session
                          // This would require getting a new ephemeral key
                          throw new Error(
                            "OpenAI API error requires session restart"
                          );
                        }, data);
                      }
                    }
                  } catch (error) {
                    console.error("[Error] Data Channel Message =>", error);
                    customLog({
                      name: "Data Channel Error",
                      errCode: "VA_DATA_CH_001",
                      errTrace: safeStringify(error),
                      interviewID: interviewID,
                    });
                  }
                });

                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                recorder.onstart = () => {
                  const makeOpenAIRequest = async () => {
                    return axios({
                      method: "POST",
                      url: "https://api.openai.com/v1/realtime/calls",
                      data: offer.sdp,
                      headers: {
                        Authorization: `Bearer ${EPHEMERAL_KEY}`,
                        "Content-Type": "application/sdp",
                      },
                    });
                  };

                  makeOpenAIRequest()
                    .then(async (sdpResponse) => {
                      // Reset retry count on success
                      openaiRetryCountRef.current = 0;
                      await pc.setRemoteDescription({
                        type: "answer",
                        sdp: await sdpResponse.data,
                      });
                    })
                    .catch(async (error) => {
                      console.error("[Error] OpenAI Realtime API =>", error);
                      customLog({
                        name: "OpenAI Realtime API Error",
                        errCode: "VA_OPENAI_API_001",
                        errTrace: safeStringify(error),
                        interviewID: interviewID,
                      });

                      // Attempt reconnection
                      await attemptOpenAIReconnection(async () => {
                        const retryResponse = await makeOpenAIRequest();
                        await pc.setRemoteDescription({
                          type: "answer",
                          sdp: await retryResponse.data,
                        });
                      }, error);
                    });
                };

                recorder.onstop = () => {
                  pcRef.current?.close();
                  pcRef.current = null;
                };
              })
              .catch((error) => {
                console.error("[WebRTC Error] =>", error);
                customLog({
                  name: "WebRTC Error",
                  errCode: "VA_WEBRTC_001",
                  errTrace: safeStringify(error),
                  interviewID: interviewID,
                });

                // If error is permission denied, show a modal to ask for permission
                if (error.name === "NotAllowedError") {
                  const requiredMedia = interviewDetails?.requireVideo
                    ? "both"
                    : "audio";
                  showDevicePermissionError(requiredMedia);
                  customLog({
                    name: "Permission Denied Error",
                    errCode: "VA_PERM_DENIED_001",
                    errTrace: safeStringify(error),
                    interviewID: interviewID,
                  });
                  return;
                }

                // For other WebRTC errors, attempt reconnection
                if (
                  error.name === "NetworkError" ||
                  error.name === "AbortError" ||
                  error.name === "NotReadableError"
                ) {
                  customLog({
                    name: "WebRTC Network Error",
                    errCode: "VA_WEBRTC_NETWORK_001",
                    errTrace: safeStringify(error),
                    interviewID: interviewID,
                  });

                  attemptWebRTCReconnection(keyResponse, error, () => {
                    startWebRTCLLMSession(keyResponse);
                  });
                  return;
                }

                // If device not found or overconstrained, try with default constraints
                if (
                  error.name === "NotFoundError" ||
                  error.name === "NotReadableError" ||
                  error.name === "OverconstrainedError"
                ) {
                  console.log(
                    "[INFO] Selected device not available or overconstrained, trying with default devices"
                  );
                  const fallbackConstraints = {
                    video: Boolean(interviewDetails?.requireVideo)
                      ? {
                          width: { ideal: 640 },
                          height: { ideal: 360 },
                          frameRate: { ideal: 15 },
                        }
                      : false,
                    audio: {
                      noiseSuppression: true,
                      autoGainControl: true,
                      echoCancellation: true,
                    },
                  };

                  navigator.mediaDevices
                    .getUserMedia(fallbackConstraints)
                    .then(async (stream) => {
                      // Retry the session with default devices
                      startWebRTCLLMSession(keyResponse);
                    })
                    .catch((fallbackError) => {
                      console.error(
                        "[WebRTC Fallback Error] =>",
                        fallbackError
                      );
                      customLog({
                        name: "WebRTC Fallback Error",
                        errCode: "VA_WEBRTC_FALLBACK_001",
                        errTrace: safeStringify(fallbackError),
                        interviewID: interviewID,
                      });

                      // Show error to user
                      const requiredMedia = interviewDetails?.requireVideo
                        ? "both"
                        : "audio";
                      showDevicePermissionError(requiredMedia);
                    });
                  return;
                }

                // try to reinitiate session with retry logic
                customLog({
                  name: "WebRTC General Error",
                  errCode: "VA_WEBRTC_GENERAL_001",
                  errTrace: safeStringify(error),
                  interviewID: interviewID,
                });

                attemptWebRTCReconnection(keyResponse, error, () => {
                  startWebRTCLLMSession(keyResponse);
                });
              });
          };

          startWebRTCLLMSession(keyResponse);
        })
        .catch((error) => {
          console.error("[Error] Starting Voice Assistant Session =>", error);
          Swal.close();
          customLog({
            name: "Voice Assistant Session Start Error",
            errCode: "VA_SESSION_START_001",
            errTrace: safeStringify(error),
            interviewID: interviewID,
          });

          // Attempt reconnection for ephemeral key API
          // For ephemeral key errors, we need to retry the entire flow
          // Since we can't easily access startWebRTCLLMSession from here,
          // we'll show the error modal after retries
          attemptOpenAIReconnection(async () => {
            // Retry getting ephemeral key - if this succeeds, the useEffect will handle the rest
            await api.post(`${BASE_URL}/api/ephemeral-key`, {
              instructions: meetingPrompt,
              config: interviewDetails.config,
              interviewID: interviewID,
              candidateName: interviewDetails.name,
              tools: [
                {
                  type: "function",
                  name: "endInterview",
                  description:
                    "Ends the interview, can be triggered by assistant or user",
                  parameters: {
                    type: "object",
                    properties: {},
                  },
                },
              ],
            });
            // If successful, trigger a re-render by updating state or reload
            // For now, we'll just log success - the useEffect should handle it
            console.log("[INFO] Ephemeral key retry successful");
            // Note: The session will be reinitialized on next render
          }, error);
        });
    }

    return () => {
      mixedRecorderRef.current?.stream?.getVideoTracks()?.forEach((track) => {
        track?.removeEventListener("ended", handleVideoEnded);
      });

      if (audioContextRef.current) {
        audioContextRef.current?.close().catch((error) => {
          console.error("[Error] Closing Audio Context =>", error);
          customLog({
            name: "Audio Context Cleanup Error",
            errCode: "VA_AUDIO_CLEANUP_001",
            errTrace: safeStringify(error),
            interviewID: interviewID,
          });
        });
        audioContextRef.current = null;
      }
    };
  }, [meetingPrompt, isReady]);

  useEffect(() => {
    progressivelySaveTranscript();
  }, [message]);

  // Monitor recording status during interview
  useEffect(() => {
    if (!isStarted) return;

    const checkRecordingStatus = () => {
      // Skip check if interview is not started
      if (!isStarted) return;

      // Check audio track status - ALWAYS REQUIRED
      if (streamRef.current) {
        const audioTracks = streamRef.current.getAudioTracks();
        const hasActiveAudio =
          audioTracks.length > 0 &&
          audioTracks.some((t) => t.enabled && t.readyState === "live");

        if (!hasActiveAudio) {
          console.error("[Error] Audio track not active or disabled");
          setAudioTrackActive(false);
          // Check if track exists but is disabled
          const disabledTrack = audioTracks.find(
            (t) => !t.enabled && t.readyState === "live"
          );
          if (disabledTrack) {
            showDeviceDisabledModal("audio", false);
          } else {
            showDevicePermissionError("audio");
          }
          return;
        } else if (!audioTrackActive && hasActiveAudio) {
          // Track was re-enabled
          setAudioTrackActive(true);
        }

        // Check video track status if required
        if (interviewDetails?.requireVideo) {
          const videoTracks = streamRef.current.getVideoTracks();
          const hasActiveVideo =
            videoTracks.length > 0 &&
            videoTracks.some((t) => t.enabled && t.readyState === "live");

          if (!hasActiveVideo) {
            console.error("[Error] Video track not active or disabled");
            setVideoTrackActive(false);
            // Check if track exists but is disabled
            const disabledTrack = videoTracks.find(
              (t) => !t.enabled && t.readyState === "live"
            );
            if (disabledTrack) {
              showDeviceDisabledModal("video", true);
            } else {
              showDevicePermissionError("video");
            }
            return;
          } else if (!videoTrackActive && hasActiveVideo) {
            // Track was re-enabled
            setVideoTrackActive(true);
          }
        }

        // Check MediaRecorder status - only if recorder exists and interview is active
        if (mixedRecorderRef.current && isStarted) {
          const recorder = mixedRecorderRef.current;
          if (recorder.state === "inactive" || recorder.state === "paused") {
            console.error("[Error] MediaRecorder is not recording");

            // Verify tracks are still active
            const mixedStream = recorder.stream;
            const hasAudio =
              mixedStream.getAudioTracks().length > 0 &&
              mixedStream
                .getAudioTracks()
                .some((t) => t.enabled && t.readyState === "live");
            const hasVideo = interviewDetails?.requireVideo
              ? mixedStream.getVideoTracks().length > 0 &&
                mixedStream
                  .getVideoTracks()
                  .some((t) => t.enabled && t.readyState === "live")
              : true;

            if (!hasAudio) {
              showDevicePermissionError("audio");
            } else if (interviewDetails?.requireVideo && !hasVideo) {
              showDevicePermissionError("video");
            }
          }
        }
      }
    };

    // Check every 5 seconds during recording
    const intervalId = setInterval(checkRecordingStatus, 5000);

    return () => {
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isStarted,
    audioTrackActive,
    videoTrackActive,
    interviewDetails?.requireVideo,
  ]);

  async function saveInterviewRecording(recordingBlob: Blob) {
    if (finalUploadRef.current) {
      console.log("[INFO] Upload already completed, skipping upload");
      return;
    }
    const partNumber = currentPartNumberRef.current + 1;
    console.log("[INFO] Saving interview recording part", partNumber);
    // Upload interview recording to storage
    try {
      const fileExtension = actualMimeTypeRef.current
        .split(";")[0]
        .split("/")[1];
      if (!recordingIdRef.current) {
        const recordingId = guid();
        const fileName = `recordings/interview_${interviewDetails._id}/${recordingId}.${fileExtension}`;
        recordingIdRef.current = fileName;
      }
      // Start the multipart upload
      if (!uploadIdRef.current) {
        const startUploadResponse = await api.post(
          "/api/start-multi-part-upload",
          {
            name: recordingIdRef.current,
            type: actualMimeTypeRef.current,
          }
        );

        if (startUploadResponse.data?.error) {
          throw new Error(
            `Start upload failed: ${startUploadResponse.status} - ${startUploadResponse.statusText}`
          );
        }

        const { uploadId } = await startUploadResponse.data;
        uploadIdRef.current = uploadId;
      }
      // Upload the part
      const presignedUrlResponse = await api.post("/api/get-presigned-url", {
        uploadId: uploadIdRef.current,
        partNumber: partNumber,
        filename: recordingIdRef.current,
      });

      if (presignedUrlResponse.data?.error) {
        throw new Error(
          `Presigned URL error - Status: ${presignedUrlResponse.status} - ${presignedUrlResponse.statusText}`
        );
      }

      const { presignedUrl } = await presignedUrlResponse.data;

      // No custom headers: UploadPart presigned URLs are signed without them. Adding
      // Content-Type can cause signature mismatch (502) or CORS preflight (Failed to fetch).
      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        body: recordingBlob,
      });

      if (!uploadResponse.ok) {
        throw new Error(
          `Blob upload error - Status: ${uploadResponse.status} - ${uploadResponse.statusText}`
        );
      }

      const etag = uploadResponse.headers?.get("etag")?.replace(/"/g, "");
      if (etag) {
        uploadPartsRef.current.push({ partNumber: partNumber, etag });
        currentPartNumberRef.current = partNumber;

        // Update interview details with the new part number
        const updateResponse = await api.post("/api/update-recording-details", {
          uid: interviewDetails._id,
          partNumber: partNumber,
          etag: etag,
          uploadId: uploadIdRef.current,
          filename: recordingIdRef.current,
          filetype: actualMimeTypeRef.current,
        });

        if (updateResponse.data?.error) {
          throw new Error(
            `Update recording details failed: ${updateResponse.status} - ${updateResponse.statusText}`
          );
        }
      }
    } catch (error) {
      // Silently fail to proceed with the interview
      console.error("Error uploading recording", error);
      customLog({
        name: "Recording Upload Error",
        errCode: "VA_REC_UPLOAD_001",
        errTrace: safeStringify(errorToSerializable(error)),
        interviewID: interviewID,
      });
    }
  }

  async function completeInterviewUpload() {
    if (finalUploadRef.current) {
      console.log("[INFO] Final upload already completed");
      return;
    }

    if (uploadPartsRef.current.length === 0) {
      console.log("[INFO] No parts to upload");
      customLog({
        name: "No Recording Parts Error",
        errCode: "VA_REC_NO_PARTS_001",
        errTrace: null,
        interviewID: interviewID,
      });
      return;
    }
    try {
      // Finish the upload
      const finishUploadResponse = await api.post("/api/finish-upload", {
        uploadId: uploadIdRef.current,
        parts: uploadPartsRef.current,
        fileName: recordingIdRef.current,
        filetype: actualMimeTypeRef.current,
        uid: interviewDetails._id,
      });

      if (finishUploadResponse.data?.error) {
        throw new Error(
          `Finish upload error - Status: ${finishUploadResponse.status} - ${finishUploadResponse.statusText}`
        );
      }
      finalUploadRef.current = true;
    } catch (error) {
      console.error("[Error] Completing interview upload", error);
      customLog({
        name: "Recording Upload Complete Error",
        errCode: "VA_REC_COMPLETE_001",
        errTrace: safeStringify(error),
        interviewID: interviewID,
      });
    }
  }

  async function finishInterview() {
    let interviewInfo = { ...interviewDetails };
    delete interviewInfo.config;

    interviewInfo.switchTabCount = window.switchTabCount;

    let messageSet = [...message];

    messageSet = messageSet.sort((a, b) => a.time - b.time);
    if (!window.savedMessageIDs) {
      window.savedMessageIDs = [];
    }
    messageSet = messageSet.filter(
      (x) => !window.savedMessageIDs.includes(x.uid)
    );

    Swal.fire({
      icon: "info",
      title: "Completing Interview..",
      text: "Please wait, Don't close this tab yet..",
      allowOutsideClick: false,
      showCancelButton: false,
      showConfirmButton: false,
    });

    Swal.showLoading();

    await api
      .post("/api/finish-interview", {
        data: interviewInfo,
      })
      .then((res) => {
        localStorage.removeItem("interviews");
        setTimeout(() => {
          Swal.close();
          setShowFeedbackModal(true);
        }, 1000);
      })
      .catch((error) => {
        console.error("[Error] Finishing interview =>", error);
        customLog({
          name: "Finish Interview API Error",
          errCode: "VA_FINISH_INT_001",
          errTrace: safeStringify(error),
          interviewID: interviewID,
        });
        Swal.fire({
          icon: "error",
          title: "Error Completing Interview",
          text: "There was an error completing the interview. Please try again.",
          allowOutsideClick: false,
        });
      });
  }

  return (
    <>
      <Offline
        polling={{
          interval: 5000,
          url: "https://httpbin.org/get",
          timeout: 10000,
        }}
      >
        <div className="offline-indicator">
          <i className="la la-wifi la-2x text-danger"></i>
          <span>
            You are offline or have a slow internet connection, please check
            your network.
          </span>
        </div>
      </Offline>

      <InterviewSystemCheck
        candidateName={interviewDetails?.name}
        jobTitle={interviewDetails?.jobTitle}
        onSystemCheckComplete={() => {
          start();
        }}
        isStarted={isStarted}
        videoElement={videoElement}
        cameraDevices={cameraDevices}
        microphoneDevices={microphoneDevices}
        speakerDevices={speakerDevices}
        selectedVideoDevice={selectedVideoDevice}
        selectedMicrophoneDevice={selectedMicrophoneDevice}
        selectedSpeakerDevice={selectedSpeakerDevice}
        onVideoDeviceChange={handleVideoDeviceChange}
        onMicrophoneDeviceChange={handleMicrophoneDeviceChange}
        onSpeakerDeviceChange={handleSpeakerDeviceChange}
      />

      <div
        className={`meeting-interface ${
          currentScreen === "interview" ? "d-flex" : "d-none"
        }`}
      >
        <div className="meeting-container">
          <div className="interview-top-bar">
            <div className="interview-info">
              <MeetingClock />
              <span className="muted-text">|</span>
              <span className="interview-title">
                {interviewDetails && (
                  <>
                    {interviewDetails.jobTitle} : {interviewDetails.name}
                  </>
                )}
              </span>
              <span className="muted-text">|</span>
              <div className="timer">
                <MeetingTimer isStarted={isStarted} />
              </div>
            </div>
            <div className="interview-status">
              <NetworkMonitorTag
                setInternetChecked={(status) => {
                  // console.log("status", status);
                }}
              />
              {isSpeaking && (
                <button
                  className="end-interview-btn"
                  style={{
                    opacity: savingInProgress ? 0.4 : 1,
                    cursor: savingInProgress ? "not-allowed" : "pointer",
                  }}
                  onClick={stop}
                  title={
                    savingInProgress
                      ? "Please wait, JIA is saving processing the interview..."
                      : undefined
                  }
                >
                  <i className="la la-phone-slash"></i>
                  End Interview
                </button>
              )}

              <div className="start-btn-group">
                <button
                  className={`start-interview-btn ${
                    isSpeaking ? "d-none" : ""
                  }`}
                  onClick={() => {
                    // Check if video is required and disabled
                    if (interviewDetails?.requireVideo && streamRef.current) {
                      const videoTracks = streamRef.current.getVideoTracks();
                      const hasEnabledVideo =
                        videoTracks.length > 0 &&
                        videoTracks.some(
                          (t) => t.enabled && t.readyState === "live"
                        );

                      if (!hasEnabledVideo) {
                        const disabledTrack = videoTracks.find(
                          (t) => !t.enabled && t.readyState === "live"
                        );
                        if (disabledTrack) {
                          showDeviceDisabledModal("video", true);
                        } else {
                          Swal.fire({
                            icon: "info",
                            title: "Camera Required",
                            text: "Please open your camera and refresh the page to start the interview.",
                            allowOutsideClick: false,
                            showCancelButton: false,
                            showConfirmButton: true,
                          });
                        }
                        return;
                      }
                    }

                    // Check if microphone is disabled (always required)
                    if (streamRef.current) {
                      const audioTracks = streamRef.current.getAudioTracks();
                      const hasEnabledAudio =
                        audioTracks.length > 0 &&
                        audioTracks.some(
                          (t) => t.enabled && t.readyState === "live"
                        );

                      if (!hasEnabledAudio) {
                        const disabledTrack = audioTracks.find(
                          (t) => !t.enabled && t.readyState === "live"
                        );
                        if (disabledTrack) {
                          showDeviceDisabledModal("audio", false);
                        } else {
                          showDevicePermissionError("audio");
                        }
                        return;
                      }
                    }

                    if (
                      interviewDetails?.requireVideo &&
                      !cameraOpen &&
                      !isSpeaking
                    ) {
                      // Modal to require camera
                      Swal.fire({
                        icon: "info",
                        title: "Camera Required",
                        text: "Please open your camera and refresh the page to start the interview.",
                        allowOutsideClick: false,
                        showCancelButton: false,
                        showConfirmButton: true,
                      });
                    } else {
                      if (isSpeaking) {
                        stop();
                        customLog({
                          name: "User Stop Interview Action",
                          errCode: "VA_USER_STOP_001",
                          errTrace: safeStringify({
                            userEmail: user?.email,
                            timestamp: Date.now(),
                          }),
                          interviewID: interviewID,
                        });
                      } else {
                        start();
                      }
                    }
                  }}
                >
                  <i className="la la-phone"></i>
                  Start Interview
                </button>

                {isReady && !isStarted && (
                  <div className="start-tooltip heartbeat dl-3">
                    <div className="sharp-tip"></div>

                    <div className="box">
                      <span>
                        <i className="la la-microphone text-primary"></i> Click
                        "Start Interview" Begin
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            className="meeting-block"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Participant Video Display */}
            {interviewDetails?.requireVideo && (
              <div className="participant-video-container">
                <div
                  className={`video-preview ${
                    userSpeaking ? "user-speaking" : ""
                  }`}
                >
                  <div className="video-container">
                    <video
                      ref={videoElement2}
                      autoPlay
                      muted
                      playsInline
                      style={{
                        display: cameraOpen ? "block" : "none",
                      }}
                    />
                  </div>
                </div>

                <div className="participant-info">
                  <span className="participant-name">
                    {user && (
                      <AvatarImage
                        src={user.image}
                        className="avatar-xsm rounded"
                      />
                    )}{" "}
                    {interviewDetails?.name || "Applicant"}
                  </span>
                  {userSpeaking && (
                    <div className="speaking-indicator">
                      <div className="wave"></div>
                      <div className="wave"></div>
                      <div className="wave"></div>
                      <div className="wave"></div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div
              className={`avatar-set  ${
                jiaSpeaking ? "heartbeat active" : "inactive"
              }`}
            >
              <div className={`outer-ring ${jiaSpeaking ? "heartbeat" : ""}`}>
                <div className="gap-ring">
                  <JiaOrb />
                </div>
              </div>
            </div>
          </div>
        </div>

      <VoiceTextToSpeech
        text={greetingText}
        voice={interviewDetails?.config?.voice || "coral"}
        autoPlay={false}
          buttonText="Play Audio"
          loadingText="Generating..."
          onPlay={() => {
            setJiaSpeaking(true);
          }}
          onEnd={() => {
            setJiaSpeaking(false);
          }}
          onReady={() => {
            console.log("Greeting Ready");
            setIsReady(true);
          }}
          className="custom-class"
        />
      </div>

      {currentJiaMessage && (
        <div className="live-caption">
          <div className="live-caption-text">
            <span>
              <strong>Jia:</strong> {currentJiaMessage?.content}
            </span>
            {userSpeaking && <UserTranscriptPreview />}
          </div>
        </div>
      )}

      <InterviewSummary
        onFinishInterview={() => {
          finishInterview();
        }}
        interviewData={{
          transcript: message ? [...message] : [],
          candidateName: interviewDetails?.name,
          jobTitle: interviewDetails?.jobTitle,
        }}
        currentScreen={currentScreen}
      />

      {showFeedbackModal && (
        <FeedbackModal
          feedbackData={interviewDetails}
          onClose={() => {
            setShowFeedbackModal(false);

            Swal.fire({
              icon: "success",
              title: "Interview is Complete.",
              text: "You will be redirected in a few moments...",
              allowOutsideClick: false,
              showCancelButton: false,
              showConfirmButton: false,
            });

            setTimeout(() => {
              window.location.href = "/dashboard";
              // const interviewRedirection = sessionStorage.getItem(
              //   "interviewRedirection"
              // );

              // // custom whitecloak redirection
              // if (interviewDetails.orgID === "682d3fc222462d03263b0881") {
              //   window.location.href = "/whitecloak/applicant";
              //   return false;
              // }

              // if (interviewRedirection) {
              //   sessionStorage.removeItem("interviewRedirection");
              //   window.location.href = interviewRedirection;
              // } else {
              //   window.location.href = "/applicant";
              // }
            }, 3000);
          }}
        />
      )}
    </>
  );
}
