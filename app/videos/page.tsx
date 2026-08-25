"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  GUEST_LIBRARY_STORAGE_KEY,
  normalizeGuestLibrary,
  removeGuestSavedVideo,
  type GuestLibraryState,
  type GuestSavedVideo,
} from "@/lib/guest-library";
import {
  normalizeYouTubeProgress,
  YOUTUBE_PROGRESS_STORAGE_KEY,
} from "@/lib/youtube-progress";
import {
  isYouTubeVideoId,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
} from "@/lib/youtube-player";
import { YouTubePlayer } from "./youtube-player";

type SavedVideo = GuestSavedVideo;
type VideosResponse = { videos?: SavedVideo[]; error?: string };
type DirectOrigin = Pick<SavedVideo, "originPhraseId" | "originQuery" | "originCaption">;

const AUTH_HINT_STORAGE_KEY = "listen-to-learn-authenticated-v1";

function readGuestLibrary() {
  try {
    const raw = window.localStorage.getItem(GUEST_LIBRARY_STORAGE_KEY);
    return normalizeGuestLibrary(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeGuestLibrary(null);
  }
}

function readProgressMap() {
  try {
    const raw = window.localStorage.getItem(YOUTUBE_PROGRESS_STORAGE_KEY);
    return normalizeYouTubeProgress(raw ? JSON.parse(raw) : null).videos;
  } catch {
    return {};
  }
}

function formatProgress(secondsValue: number) {
  const seconds = Math.max(0, Math.floor(Number(secondsValue) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function originPhraseUrl(video: SavedVideo | DirectOrigin) {
  if (!video.originQuery) return "";
  const query = new URLSearchParams({ phrase: video.originQuery });
  if (video.originPhraseId) query.set("phraseId", video.originPhraseId);
  return `/trainer?${query.toString()}`;
}

export default function VideosPage() {
  const [mode, setMode] = useState<"guest" | "account">("guest");
  const [guestLibrary, setGuestLibrary] = useState<GuestLibraryState>(() => normalizeGuestLibrary(null));
  const [videos, setVideos] = useState<SavedVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [directOrigin, setDirectOrigin] = useState<DirectOrigin>({
    originPhraseId: "",
    originQuery: "",
    originCaption: "",
  });
  const [progress, setProgress] = useState<Record<string, { seconds: number; updatedAt: string }>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadGuest = useCallback(() => {
    const next = readGuestLibrary();
    setMode("guest");
    setGuestLibrary(next);
    setVideos(next.savedVideos);
    setLoading(false);
  }, []);

  const loadAccount = useCallback(async () => {
    try {
      const response = await fetch("/api/videos", { cache: "no-store" });
      const data = await response.json() as VideosResponse;
      if (!response.ok || !Array.isArray(data.videos)) {
        throw new Error(data.error || "account session unavailable");
      }
      setMode("account");
      setVideos(data.videos);
      setLoading(false);
    } catch {
      try { window.localStorage.removeItem(AUTH_HINT_STORAGE_KEY); } catch { /* optional hint */ }
      loadGuest();
    }
  }, [loadGuest]);

  useEffect(() => {
    const readLocation = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const requestedVideo = searchParams.get("video") || "";
      setSelectedVideoId(isYouTubeVideoId(requestedVideo) ? requestedVideo : "");
      setDirectOrigin({
        originPhraseId: (searchParams.get("phraseId") || "").slice(0, 120),
        originQuery: (searchParams.get("query") || "").slice(0, 240),
        originCaption: (searchParams.get("caption") || "").slice(0, 1_000),
      });
    };
    window.addEventListener("popstate", readLocation);
    const initializationTimer = window.setTimeout(() => {
      readLocation();
      setProgress(readProgressMap());
      let authHint = false;
      try { authHint = window.localStorage.getItem(AUTH_HINT_STORAGE_KEY) === "1"; } catch { /* optional hint */ }
      if (authHint) void loadAccount();
      else loadGuest();
    }, 0);
    return () => {
      window.clearTimeout(initializationTimer);
      window.removeEventListener("popstate", readLocation);
    };
  }, [loadAccount, loadGuest]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === GUEST_LIBRARY_STORAGE_KEY && mode === "guest") loadGuest();
      if (event.key === YOUTUBE_PROGRESS_STORAGE_KEY) setProgress(readProgressMap());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [loadGuest, mode]);

  const selectedSavedVideo = useMemo(
    () => videos.find((video) => video.videoId === selectedVideoId) || null,
    [selectedVideoId, videos],
  );
  const selectedOrigin = selectedSavedVideo || directOrigin;

  function persistGuest(next: GuestLibraryState) {
    const normalized = normalizeGuestLibrary(next);
    setGuestLibrary(normalized);
    setVideos(normalized.savedVideos);
    try {
      window.localStorage.setItem(GUEST_LIBRARY_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      setError("Could not update the guest video library in this browser.");
    }
  }

  function selectVideo(videoId: string) {
    if (!isYouTubeVideoId(videoId)) return;
    setSelectedVideoId(videoId);
    const url = new URL(window.location.href);
    url.searchParams.set("video", videoId);
    window.history.pushState(null, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeVideo(video: SavedVideo) {
    if (!window.confirm("Remove this video from Watch Later?")) return;
    setBusyId(video.id);
    setError("");
    setNotice("");
    if (mode === "guest") {
      persistGuest(removeGuestSavedVideo(guestLibrary, video.id));
      setNotice("Video removed from Watch Later. Its phrase clips were not changed.");
      setBusyId("");
      return;
    }

    try {
      const response = await fetch(`/api/videos?id=${encodeURIComponent(video.id)}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not remove the saved video.");
      setVideos((items) => items.filter((item) => item.id !== video.id));
      setNotice("Video removed from Watch Later. Its phrase clips were not changed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove the saved video.");
    } finally {
      setBusyId("");
    }
  }

  const handleProgressChange = useCallback((seconds: number) => {
    setProgress(readProgressMap());
    if (seconds === 0) setNotice("Video completed; resume position reset.");
  }, []);

  const watchUrl = youtubeWatchUrl(selectedVideoId);
  const phraseUrl = originPhraseUrl(selectedOrigin);

  return (
    <main className="videos-shell">
      <header className="videos-header">
        <div>
          <p className="eyebrow">Long-form listening</p>
          <h1>Saved videos</h1>
          <p>Watch the full YouTube video without another YouGlish search. Resume stays in this browser.</p>
        </div>
        <nav className="videos-nav" aria-label="Videos navigation">
          <Link className="back-link" href="/">Phrase library</Link>
          {phraseUrl && <Link className="back-link" href={phraseUrl}>Source phrase</Link>}
        </nav>
      </header>

      {mode === "guest" && <div className="notice" role="status">Guest mode: saved videos and resume position stay only in this browser.</div>}
      {error && <div className="notice error" role="alert">{error}</div>}
      {notice && <div className="notice success" role="status">{notice}</div>}

      {selectedVideoId && (
        <section className="video-stage" aria-labelledby="video-stage-heading">
          <div className="video-stage-heading">
            <div>
              <p className="eyebrow">Now watching</p>
              <h2 id="video-stage-heading">{selectedOrigin.originQuery || "YouTube video"}</h2>
              {selectedOrigin.originCaption && <p>{selectedOrigin.originCaption}</p>}
            </div>
            {watchUrl && <a className="video-external-link" href={watchUrl} rel="noopener noreferrer" target="_blank">Open on YouTube</a>}
          </div>
          <YouTubePlayer onProgressChange={handleProgressChange} videoId={selectedVideoId} />
        </section>
      )}

      <section className="saved-videos-section" aria-labelledby="saved-videos-heading">
        <div className="section-heading">
          <div>
            <h2 id="saved-videos-heading">Watch later</h2>
            <p>{videos.length} saved {videos.length === 1 ? "video" : "videos"}</p>
          </div>
        </div>

        {loading ? <div className="notice">Loading saved videos…</div> : videos.length === 0 ? (
          <div className="empty-state">
            <strong>No videos saved yet</strong>
            <span>Choose Watch later on a YouGlish result to add the first one.</span>
          </div>
        ) : (
          <div className="video-grid">
            {videos.map((video) => {
              const savedProgress = progress[video.videoId]?.seconds || 0;
              return (
                <article className="video-card" key={video.id}>
                  <button
                    aria-label={`Watch ${video.originQuery || "saved YouTube video"}`}
                    className="video-thumbnail"
                    onClick={() => selectVideo(video.videoId)}
                    style={{ backgroundImage: `url(${youtubeThumbnailUrl(video.videoId)})` }}
                    type="button"
                  >
                    <span aria-hidden="true">▶</span>
                  </button>
                  <div className="video-card-body">
                    <h3>{video.originQuery || "YouTube video"}</h3>
                    {video.originCaption && <p>{video.originCaption}</p>}
                    <div className="video-card-meta">
                      <span>{savedProgress > 0 ? `Resume at ${formatProgress(savedProgress)}` : "Not started"}</span>
                      <span>Saved {new Date(video.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="video-card-actions">
                      <button onClick={() => selectVideo(video.videoId)} type="button">Watch</button>
                      <button className="secondary" disabled={busyId === video.id} onClick={() => void removeVideo(video)} type="button">Remove</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
