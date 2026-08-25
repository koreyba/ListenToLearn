"use client";

import { useCallback, useEffect, useState } from "react";
import { SiteNavigation } from "@/app/components/site-navigation";
import {
  GUEST_LIBRARY_STORAGE_KEY,
  normalizeGuestLibrary,
  removeGuestSavedVideo,
  type GuestLibraryState,
  type GuestSavedVideo,
} from "@/lib/guest-library";
import {
  normalizeYouTubeProgress,
  readYouTubeResume,
  type YouTubeProgressEntry,
  YOUTUBE_PROGRESS_STORAGE_KEY,
} from "@/lib/youtube-progress";
import { buildFullVideoTrainerUrl } from "@/lib/youglish-full-video";
import {
  isYouTubeVideoId,
  youtubeThumbnailUrl,
} from "@/lib/youtube-player";

type SavedVideo = GuestSavedVideo;
type VideosResponse = { videos?: SavedVideo[]; error?: string };

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

export default function VideosPage() {
  const [mode, setMode] = useState<"guest" | "account">("guest");
  const [guestLibrary, setGuestLibrary] = useState<GuestLibraryState>(() => normalizeGuestLibrary(null));
  const [videos, setVideos] = useState<SavedVideo[]>([]);
  const [progress, setProgress] = useState<Record<string, YouTubeProgressEntry>>({});
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
    const openLegacyDirectLink = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const requestedVideo = searchParams.get("video") || "";
      const directOrigin = {
        videoId: requestedVideo,
        originPhraseId: (searchParams.get("phraseId") || "").slice(0, 120),
        originQuery: (searchParams.get("query") || "").slice(0, 240),
        originCaption: (searchParams.get("caption") || "").slice(0, 1_000),
        language: "english",
        accent: (searchParams.get("accent") || "").slice(0, 20),
      };
      if (!isYouTubeVideoId(requestedVideo) || !directOrigin.originQuery) return;
      const resume = readYouTubeResume({ version: 1, videos: readProgressMap() }, requestedVideo);
      const fullVideoUrl = buildFullVideoTrainerUrl(directOrigin, resume);
      if (fullVideoUrl) window.location.replace(fullVideoUrl);
    };
    const initializationTimer = window.setTimeout(() => {
      openLegacyDirectLink();
      setProgress(readProgressMap());
      let authHint = false;
      try { authHint = window.localStorage.getItem(AUTH_HINT_STORAGE_KEY) === "1"; } catch { /* optional hint */ }
      if (authHint) void loadAccount();
      else loadGuest();
    }, 0);
    return () => {
      window.clearTimeout(initializationTimer);
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

  function selectVideo(video: SavedVideo) {
    const resume = readYouTubeResume({ version: 1, videos: progress }, video.videoId);
    const fullVideoUrl = buildFullVideoTrainerUrl(video, resume);
    if (fullVideoUrl) window.location.assign(fullVideoUrl);
  }

  async function removeVideo(video: SavedVideo) {
    if (!window.confirm("Remove this video from Continue watching?")) return;
    setBusyId(video.id);
    setError("");
    setNotice("");
    if (mode === "guest") {
      persistGuest(removeGuestSavedVideo(guestLibrary, video.id));
      setNotice("Video removed from Continue watching. Its phrase clips were not changed.");
      setBusyId("");
      return;
    }

    try {
      const response = await fetch(`/api/videos?id=${encodeURIComponent(video.id)}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not remove the video.");
      setVideos((items) => items.filter((item) => item.id !== video.id));
      setNotice("Video removed from Continue watching. Its phrase clips were not changed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove the video.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <>
      <SiteNavigation
        active="videos"
        account={mode === "guest" ? (
          <a className="site-account-link" href="/login">Sign in with Google</a>
        ) : (
          <a
            className="site-account-link"
            href="/cdn-cgi/access/logout"
            onClick={() => {
              try { window.localStorage.removeItem(AUTH_HINT_STORAGE_KEY); } catch { /* optional hint */ }
            }}
          >Log out</a>
        )}
      />
      <main className="videos-shell">
      <header className="videos-header">
        <div>
          <p className="eyebrow">Long-form listening</p>
          <h1>Videos</h1>
          <p>Continue a YouGlish video with the trainer&apos;s captions and learning controls. Resume stays in this browser.</p>
        </div>
      </header>

      {mode === "guest" && <div className="notice" role="status">Guest mode: viewing history and resume position stay only in this browser.</div>}
      {error && <div className="notice error" role="alert">{error}</div>}
      {notice && <div className="notice success" role="status">{notice}</div>}

      <section className="saved-videos-section" aria-labelledby="continue-watching-heading">
        <div className="section-heading">
          <div>
            <h2 id="continue-watching-heading">Continue watching</h2>
            <p>{videos.length} watched {videos.length === 1 ? "video" : "videos"}</p>
          </div>
        </div>

        {loading ? <div className="notice">Loading videos…</div> : videos.length === 0 ? (
          <div className="empty-state">
            <strong>No videos watched yet</strong>
            <span>Choose Watch full video on a YouGlish result to add the first one.</span>
          </div>
        ) : (
          <div className="video-grid">
            {videos.map((video) => {
              const savedProgress = progress[video.videoId]?.seconds || 0;
              return (
                <article className="video-card" key={video.id}>
                  <button
                    aria-label={`Continue ${video.originQuery || "YouTube video"}`}
                    className="video-thumbnail"
                    onClick={() => selectVideo(video)}
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
                      <span>Last opened {new Date(video.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="video-card-actions">
                      <button onClick={() => selectVideo(video)} type="button">Continue</button>
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
    </>
  );
}
