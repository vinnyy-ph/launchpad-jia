"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import styles from "@/lib/styles/commonV2/videoPlayer.module.scss";

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

type VideoPlayerProps = {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  active?: boolean;
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VideoPlayer({
  src,
  poster,
  autoPlay = false,
  active = true,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const volumeSliderRef = useRef<HTMLDivElement>(null);
  const isDraggingVolumeRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [progressHover, setProgressHover] = useState<{
    time: number;
    x: number;
    percent: number;
  } | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeBeforeMuteRef = useRef(1);
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const playPauseHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isMouseOverContainerRef = useRef(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  useEffect(() => {
    if (!active && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [active]);

  const video = videoRef.current;

  // Sync volume to video only when the video element is first available
  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [video]);

  const toggleMute = useCallback(() => {
    if (volume > 0) {
      volumeBeforeMuteRef.current = volume;
      setVolume(0);
      if (videoRef.current) videoRef.current.volume = 0;
    } else {
      const restore = volumeBeforeMuteRef.current || 1;
      setVolume(restore);
      if (videoRef.current) videoRef.current.volume = restore;
    }
  }, [volume]);

  const getVolumeFromPosition = useCallback((clientX: number) => {
    const track = volumeSliderRef.current;
    if (!track) return null;
    const rect = track.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    return pct;
  }, []);

  const applyVolumeFromPosition = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0]?.clientX : e.clientX;
      if (clientX == null) return;
      const pct = getVolumeFromPosition(clientX);
      if (pct == null) return;
      setVolume(pct);
      if (videoRef.current) videoRef.current.volume = pct;
    },
    [getVolumeFromPosition],
  );

  const getVolumeFromPointer = useCallback(
    (e: MouseEvent | Touch) => {
      const clientX = "clientX" in e ? e.clientX : (e as Touch).clientX;
      return getVolumeFromPosition(clientX);
    },
    [getVolumeFromPosition],
  );

  const handleVolumeTrackMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDraggingVolumeRef.current = true;
      applyVolumeFromPosition(e);
      const onMove = (e2: MouseEvent) => {
        if (!isDraggingVolumeRef.current) return;
        const pct = getVolumeFromPointer(e2);
        if (pct != null) {
          setVolume(pct);
          if (videoRef.current) videoRef.current.volume = pct;
        }
      };
      const onUp = () => {
        isDraggingVolumeRef.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [getVolumeFromPointer, applyVolumeFromPosition],
  );

  const handleVolumeTrackTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.stopPropagation();
      isDraggingVolumeRef.current = true;
      applyVolumeFromPosition(e);
      const onMove = (e2: TouchEvent) => {
        if (!isDraggingVolumeRef.current || !e2.touches[0]) return;
        const pct = getVolumeFromPointer(e2.touches[0]);
        if (pct != null) {
          setVolume(pct);
          if (videoRef.current) videoRef.current.volume = pct;
        }
      };
      const onEnd = () => {
        isDraggingVolumeRef.current = false;
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onEnd);
      };
      window.addEventListener("touchmove", onMove, { passive: true });
      window.addEventListener("touchend", onEnd);
    },
    [getVolumeFromPointer, applyVolumeFromPosition],
  );

  useEffect(() => {
    if (!video) return;
    video.playbackRate = playbackRate;
  }, [video, playbackRate]);

  useEffect(() => {
    if (!video) return;
    const syncDuration = () => {
      const d = video.duration;
      setDuration(Number.isFinite(d) && d >= 0 ? d : 0);
    };
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = syncDuration;
    const onLoadedMetadata = syncDuration;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    syncDuration();
    setCurrentTime(video.currentTime);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [video]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    // Hide controls after 1s if cursor is not on the video
    if (playPauseHideTimeoutRef.current) {
      clearTimeout(playPauseHideTimeoutRef.current);
    }
    playPauseHideTimeoutRef.current = setTimeout(() => {
      if (!isMouseOverContainerRef.current) setControlsVisible(false);
      playPauseHideTimeoutRef.current = null;
    }, 1000);
  }, []);

  const cycleSpeed = useCallback(() => {
    const i = SPEEDS.indexOf(playbackRate as (typeof SPEEDS)[number]);
    const next = SPEEDS[(i + 1) % SPEEDS.length];
    setPlaybackRate(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  }, [playbackRate]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const handleProgressSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressBarRef.current || !videoRef.current || duration <= 0) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      const time = percent * duration;
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    },
    [duration],
  );

  const handleProgressHover = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressBarRef.current || duration <= 0) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      const time = percent * duration;
      setProgressHover({ time, x: e.clientX - rect.left, percent });
    },
    [duration],
  );

  const handleProgressLeave = useCallback(() => {
    setProgressHover(null);
    setPreviewImageUrl(null);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (previewVideoRef.current) {
      previewVideoRef.current.pause();
      previewVideoRef.current.removeAttribute("src");
      previewVideoRef.current.load();
    }
  }, []);

  useEffect(() => {
    if (!progressHover || !previewVideoRef.current || !previewCanvasRef.current)
      return;
    const pv = previewVideoRef.current;
    const canvas = previewCanvasRef.current;
    const targetTime = progressHover.time;
    if (!pv.src || pv.src !== src) {
      pv.src = src;
    }
    if (Math.abs(pv.currentTime - targetTime) > 0.5) {
      pv.currentTime = targetTime;
    }
    const draw = () => {
      if (pv.readyState >= 2 && canvas && pv.videoWidth) {
        const w = pv.videoWidth;
        const h = pv.videoHeight;
        canvas.width = 160;
        canvas.height = (160 / w) * h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(pv, 0, 0, canvas.width, canvas.height);
          setPreviewImageUrl(canvas.toDataURL());
        }
      }
    };
    pv.onseeked = draw;
    if (pv.readyState >= 2) draw();
    return () => {
      pv.onseeked = null;
    };
  }, [src, progressHover?.time]);

  const handleContainerMouseEnter = useCallback(() => {
    isMouseOverContainerRef.current = true;
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
      hideControlsTimeoutRef.current = null;
    }
    setControlsVisible(true);
  }, []);

  const handleContainerMouseLeave = useCallback(() => {
    isMouseOverContainerRef.current = false;
    hideControlsTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
      hideControlsTimeoutRef.current = null;
    }, 1500);
  }, []);

  useEffect(() => {
    return () => {
      if (hideControlsTimeoutRef.current)
        clearTimeout(hideControlsTimeoutRef.current);
      if (playPauseHideTimeoutRef.current)
        clearTimeout(playPauseHideTimeoutRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={styles.videoPlayerContainer}
      onMouseEnter={handleContainerMouseEnter}
      onMouseLeave={handleContainerMouseLeave}
    >
      <video
        ref={videoRef}
        className={styles.videoPlayer}
        src={src}
        poster={poster}
        onClick={togglePlay}
      />

      {/* Hidden video for progress hover preview */}
      <video
        ref={previewVideoRef}
        muted
        preload="metadata"
        className={styles.videoPreview}
        aria-hidden
      />
      <canvas
        ref={previewCanvasRef}
        className={styles.videoPreviewCanvas}
        aria-hidden
      />

      {/* Gradient overlay above video, behind controls - only when controls visible */}
      <div
        className={`${styles.videoControlsOverlay} ${controlsVisible ? styles.videoControlsOverlayVisible : ""}`}
        aria-hidden
      />

      {/* Center play button - visible on mobile only when controls are shown */}
      <div
        className={`${styles.videoCenterPlay} ${controlsVisible ? styles.videoCenterPlayVisible : ""}`}
        aria-hidden
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className={styles.videoCenterPlayButton}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <img src="/icons/pause.svg" alt="" />
          ) : (
            <img src="/icons/play.svg" alt="" />
          )}
        </button>
      </div>

      {/* Controls bar - stop propagation so video doesn't receive clicks */}
      <div
        role="group"
        aria-label="Video controls"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className={`${styles.videoControls} ${controlsVisible ? styles.videoControlsVisible : ""}`}
      >
        {/* 1. Play / Pause (hidden on mobile; center play used instead) */}
        <button
          type="button"
          onClick={togglePlay}
          className={styles.playPauseButton}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <img src="/icons/pause.svg" alt="Pause" />
          ) : (
            <img src="/icons/play.svg" alt="Play" />
          )}
        </button>

        {/* 2. Volume */}
        <div className={styles.volumeGroup}>
          <button
            type="button"
            onClick={toggleMute}
            className={styles.volumeButton}
            aria-label={volume === 0 ? "Unmute" : "Mute"}
          >
            {volume === 0 ? (
              <img src="/icons/volume-mute.svg" alt="Volume Off" />
            ) : volume < 0.5 ? (
              <img src="/icons/volume-min.svg" alt="Volume Min" />
            ) : (
              <img src="/icons/volume-max.svg" alt="Volume Max" />
            )}
          </button>
          <div
            ref={volumeSliderRef}
            role="slider"
            tabIndex={0}
            aria-valuemin={0}
            aria-valuemax={1}
            aria-valuenow={volume}
            aria-label="Volume"
            onMouseDown={handleVolumeTrackMouseDown}
            onTouchStart={handleVolumeTrackTouchStart}
            onClick={(e) => e.stopPropagation()}
            className={styles.volumeSlider}
          >
            <div
              style={{ width: `${volume * 100}%` }}
              className={styles.volumeSliderTrack}
            />
          </div>
        </div>

        <span
          className={styles.currentTimestamp}
          style={{ marginLeft: "8px", paddingRight: "8px" }}
        >
          {formatTime(currentTime)}
        </span>

        {/* 3. Progress + hover preview */}
        <div ref={progressBarRef} className={styles.progressBarGroup}>
          <div
            role="slider"
            tabIndex={0}
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
            aria-label="Video progress"
            onMouseMove={handleProgressHover}
            onMouseLeave={handleProgressLeave}
            onClick={handleProgressSeek}
            className={styles.progressBar}
            onKeyDown={(e) => {
              if (!videoRef.current) return;
              const step = e.shiftKey ? 10 : 5;
              if (e.key === "ArrowLeft") {
                videoRef.current.currentTime = Math.max(
                  0,
                  videoRef.current.currentTime - step,
                );
              } else if (e.key === "ArrowRight") {
                videoRef.current.currentTime = Math.min(
                  videoRef.current.duration,
                  videoRef.current.currentTime + step,
                );
              }
            }}
          >
            <div
              className={styles.progressBarFill}
              style={{
                width: `${duration > 0 && Number.isFinite(currentTime) ? Math.min(100, (currentTime / duration) * 100) : 0}%`,
              }}
            />
          </div>
          {progressHover !== null && (
            <div
              className={styles.progressBarHoverPreview}
              style={{
                left: `${progressHover.percent * 100}%`,
              }}
            >
              {previewImageUrl && (
                <div className={styles.progressBarHoverPreviewImage}>
                  <img
                    className={styles.progressBarHoverPreviewImageImg}
                    src={previewImageUrl}
                  />
                </div>
              )}
              <div className={styles.progressBarHoverPreviewTime}>
                {formatTime(progressHover.time)}
              </div>
            </div>
          )}
        </div>

        <span
          className={styles.currentTimestamp}
          style={{ marginRight: "8px", paddingLeft: "8px" }}
        >
          {formatTime(duration)}
        </span>

        {/* 4. Speed */}
        <button
          type="button"
          onClick={cycleSpeed}
          className={styles.speedButton}
        >
          {playbackRate}
          <img src="/icons/playback-x.svg" alt="Speed" />
        </button>

        {/* 5. Fullscreen */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className={styles.fullscreenButton}
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <img src="/icons/minimize-white.svg" alt="Minimize" />
          ) : (
            <img src="/icons/maximize-white.svg" alt="Maximize" />
          )}
        </button>
      </div>
    </div>
  );
}
