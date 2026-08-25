"use client";

import { useEffect, useRef, useState } from "react";
import {
  clearYouTubeProgress,
  normalizeYouTubeProgress,
  readYouTubeProgress,
  updateYouTubeProgress,
  YOUTUBE_PROGRESS_STORAGE_KEY,
  type YouTubeProgressState,
} from "@/lib/youtube-progress";
import { isYouTubeVideoId, youtubePlayerVars } from "@/lib/youtube-player";

type PlayerEvent = { data: number; target: YouTubePlayer };
type YouTubePlayer = {
  cueVideoById(options: { videoId: string; startSeconds: number }): void;
  destroy(): void;
  getCurrentTime(): number;
  getDuration(): number;
};
type YouTubePlayerConstructor = new (
  element: HTMLElement,
  options: {
    videoId: string;
    playerVars: ReturnType<typeof youtubePlayerVars>;
    events: {
      onReady(event: { target: YouTubePlayer }): void;
      onStateChange(event: PlayerEvent): void;
      onError(event: { data: number }): void;
    };
  },
) => YouTubePlayer;

declare global {
  interface Window {
    YT?: { Player: YouTubePlayerConstructor };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<void>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };
    const existing = document.getElementById("listen-to-learn-youtube-iframe-api");
    if (existing) return;
    const script = document.createElement("script");
    script.id = "listen-to-learn-youtube-iframe-api";
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      script.remove();
      youtubeApiPromise = null;
      reject(new Error("YouTube IFrame API failed to load"));
    };
    document.head.appendChild(script);
  });
  return youtubeApiPromise;
}

function readStoredProgress() {
  try {
    const raw = window.localStorage.getItem(YOUTUBE_PROGRESS_STORAGE_KEY);
    return normalizeYouTubeProgress(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeYouTubeProgress(null);
  }
}

function storeProgress(state: YouTubeProgressState) {
  window.localStorage.setItem(YOUTUBE_PROGRESS_STORAGE_KEY, JSON.stringify(state));
}

export function YouTubePlayer({
  videoId,
  onProgressChange,
}: {
  videoId: string;
  onProgressChange?: (seconds: number) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Loading YouTube player…");
  const [storageWarning, setStorageWarning] = useState("");

  useEffect(() => {
    if (!isYouTubeVideoId(videoId) || !hostRef.current) {
      setStatus("This YouTube video ID is invalid.");
      return;
    }

    let disposed = false;
    let player: YouTubePlayer | null = null;
    let saveTimer = 0;

    const stopSaveTimer = () => {
      if (saveTimer) window.clearInterval(saveTimer);
      saveTimer = 0;
    };

    const persistCurrentTime = (clearCompleted = false) => {
      if (!player) return;
      try {
        const currentTime = Number(player.getCurrentTime());
        const duration = Number(player.getDuration());
        const current = readStoredProgress();
        const completed = clearCompleted
          || (Number.isFinite(duration) && duration > 0 && currentTime >= Math.max(0, duration - 10));
        const next = completed
          ? clearYouTubeProgress(current, videoId)
          : updateYouTubeProgress(current, videoId, currentTime);
        storeProgress(next);
        if (!disposed) onProgressChange?.(completed ? 0 : currentTime);
      } catch {
        if (!disposed) setStorageWarning("Playback continues, but this browser could not save your position.");
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") persistCurrentTime();
    };
    const onPageHide = () => persistCurrentTime();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    void loadYouTubeApi().then(() => {
      if (disposed || !hostRef.current || !window.YT?.Player) return;
      const startSeconds = readYouTubeProgress(readStoredProgress(), videoId);
      player = new window.YT.Player(hostRef.current, {
        videoId,
        playerVars: youtubePlayerVars(window.location.origin),
        events: {
          onReady(event) {
            event.target.cueVideoById({ videoId, startSeconds });
            setStatus(startSeconds > 0
              ? `Ready to continue from ${Math.floor(startSeconds)} seconds.`
              : "Ready to play from the beginning.");
          },
          onStateChange(event) {
            if (event.data === 1) {
              setStatus("Playing. Your position is saved in this browser.");
              stopSaveTimer();
              saveTimer = window.setInterval(() => persistCurrentTime(), 5_000);
              return;
            }
            stopSaveTimer();
            if (event.data === 0) {
              persistCurrentTime(true);
              setStatus("Video completed. Resume position reset.");
            } else if (event.data === 2) {
              persistCurrentTime();
              setStatus("Paused. Position saved.");
            }
          },
          onError(event) {
            stopSaveTimer();
            setStatus(`YouTube could not play this video here. Error ${event.data}.`);
          },
        },
      });
    }).catch(() => {
      if (!disposed) setStatus("Could not load the YouTube player. Use the direct YouTube link below.");
    });

    return () => {
      disposed = true;
      stopSaveTimer();
      persistCurrentTime();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      player?.destroy();
    };
  }, [onProgressChange, videoId]);

  return (
    <div className="youtube-player-shell">
      <div className="youtube-player-host" ref={hostRef} />
      <p className="youtube-player-status" role="status">{status}</p>
      {storageWarning && <p className="notice error" role="alert">{storageWarning}</p>}
    </div>
  );
}
