"use client";

import { useCallback, useEffect, useState } from "react";
import { SignedInSiteAccount } from "@/app/components/signed-in-site-account";
import { SiteNavigation } from "@/app/components/site-navigation";
import {
  accountSession,
  legacyYoutubeProgressStorageKeys,
  signInHref,
  youtubeProgressStorageKey,
  type AccountSessionUser,
} from "@/lib/client-session";
import {
  readMigratedStorage,
  writeMigratedStorage,
} from "@/lib/browser-storage";
import {
  GUEST_LIBRARY_STORAGE_KEY,
  LEGACY_GUEST_LIBRARY_STORAGE_KEYS,
  normalizeGuestLibrary,
  removeGuestSavedVideo,
  type GuestLibraryState,
  type GuestSavedVideo,
} from "@/lib/guest-library";
import {
  clearYouTubeProgress,
  mergeYouTubeProgress,
  normalizeYouTubeProgress,
  readYouTubeResume,
  type YouTubeProgressEntry,
} from "@/lib/youtube-progress";
import { buildFullVideoTrainerUrl } from "@/lib/youglish-full-video";
import {
  isYouTubeVideoId,
  youtubeThumbnailUrl,
} from "@/lib/youtube-player";

type SavedVideo = GuestSavedVideo & { progress?: YouTubeProgressEntry };
type VideosResponse = { videos?: SavedVideo[]; error?: string };

function readGuestLibrary() {
  try {
    const raw = readMigratedStorage(
      window.localStorage,
      GUEST_LIBRARY_STORAGE_KEY,
      LEGACY_GUEST_LIBRARY_STORAGE_KEYS,
    );
    return normalizeGuestLibrary(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeGuestLibrary(null);
  }
}

function readProgressState(storageKey: string, legacyKeys: readonly string[]) {
  try {
    const raw = readMigratedStorage(
      window.localStorage,
      storageKey,
      legacyKeys,
    );
    return normalizeYouTubeProgress(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeYouTubeProgress(null);
  }
}

function openLegacyDirectLink(progress: Record<string, YouTubeProgressEntry>) {
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
  const resume = readYouTubeResume({ version: 1, videos: progress }, requestedVideo);
  const fullVideoUrl = buildFullVideoTrainerUrl(directOrigin, resume);
  if (fullVideoUrl) window.location.replace(fullVideoUrl);
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
  const [viewer, setViewer] = useState<AccountSessionUser | null>(null);
  const [guestLibrary, setGuestLibrary] = useState<GuestLibraryState>(() => normalizeGuestLibrary(null));
  const [videos, setVideos] = useState<SavedVideo[]>([]);
  const [progress, setProgress] = useState<Record<string, YouTubeProgressEntry>>({});
  const [progressStorageKey, setProgressStorageKey] = useState(() => youtubeProgressStorageKey(null));
  const [progressLegacyStorageKeys, setProgressLegacyStorageKeys] = useState<readonly string[]>(
    () => legacyYoutubeProgressStorageKeys(null),
  );
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadGuest = useCallback(() => {
    const next = readGuestLibrary();
    const storageKey = youtubeProgressStorageKey(null);
    const legacyKeys = legacyYoutubeProgressStorageKeys(null);
    const guestProgress = readProgressState(storageKey, legacyKeys);
    setMode("guest");
    setViewer(null);
    setProgressStorageKey(storageKey);
    setProgressLegacyStorageKeys(legacyKeys);
    setGuestLibrary(next);
    setVideos(next.savedVideos);
    setProgress(guestProgress.videos);
    setLoading(false);
    openLegacyDirectLink(guestProgress.videos);
  }, []);

  const loadAccount = useCallback(async (sessionUser: AccountSessionUser) => {
    const storageKey = youtubeProgressStorageKey(sessionUser.id);
    const legacyKeys = legacyYoutubeProgressStorageKeys(sessionUser.id);
    setMode("account");
    setViewer(sessionUser);
    setProgressStorageKey(storageKey);
    setProgressLegacyStorageKeys(legacyKeys);
    try {
      const response = await fetch("/api/videos", { cache: "no-store" });
      const data = await response.json() as VideosResponse;
      if (!response.ok || !Array.isArray(data.videos)) {
        throw new Error(data.error || "account session unavailable");
      }
      setVideos(data.videos);
      const serverProgress = normalizeYouTubeProgress({
        videos: Object.fromEntries(data.videos
          .filter((video) => video.progress?.updatedAt)
          .map((video) => [video.videoId, video.progress])),
      });
      const mergedProgress = mergeYouTubeProgress(serverProgress, readProgressState(storageKey, legacyKeys));
      setProgress(mergedProgress.videos);
      setLoading(false);
      openLegacyDirectLink(mergedProgress.videos);
    } catch (reason) {
      setMode("account");
      setError(reason instanceof Error ? reason.message : "Could not load account videos.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initializationTimer = window.setTimeout(() => {
      void accountSession().then((sessionUser) => {
        if (sessionUser) void loadAccount(sessionUser);
        else loadGuest();
      });
    }, 0);
    return () => {
      window.clearTimeout(initializationTimer);
    };
  }, [loadAccount, loadGuest]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        [GUEST_LIBRARY_STORAGE_KEY, ...LEGACY_GUEST_LIBRARY_STORAGE_KEYS].includes(event.key || "")
        && mode === "guest"
      ) loadGuest();
      if (
        [progressStorageKey, ...progressLegacyStorageKeys].includes(event.key || "")
      ) setProgress(readProgressState(progressStorageKey, progressLegacyStorageKeys).videos);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [loadGuest, mode, progressLegacyStorageKeys, progressStorageKey]);

  function clearCurrentProgress(videoId: string) {
    const next = clearYouTubeProgress({ version: 1, videos: progress }, videoId);
    setProgress(next.videos);
    try {
      writeMigratedStorage(
        window.localStorage,
        progressStorageKey,
        progressLegacyStorageKeys,
        JSON.stringify(next),
      );
    } catch { /* optional mirror */ }
  }

  function persistGuest(next: GuestLibraryState) {
    const normalized = normalizeGuestLibrary(next);
    setGuestLibrary(normalized);
    setVideos(normalized.savedVideos);
    try {
      writeMigratedStorage(
        window.localStorage,
        GUEST_LIBRARY_STORAGE_KEY,
        LEGACY_GUEST_LIBRARY_STORAGE_KEYS,
        JSON.stringify(normalized),
      );
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
      clearCurrentProgress(video.videoId);
      setNotice("Video removed from Continue watching. Its phrase clips were not changed.");
      setBusyId("");
      return;
    }

    try {
      const response = await fetch(`/api/videos?id=${encodeURIComponent(video.id)}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not remove the video.");
      setVideos((items) => items.filter((item) => item.id !== video.id));
      clearCurrentProgress(video.videoId);
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
        account={mode === "guest" || !viewer ? (
          <a className="site-account-link" href={signInHref("/videos")}>Sign in with Google</a>
        ) : (
          <SignedInSiteAccount user={viewer} />
        )}
      />
      <main className="videos-shell">
      <header className="videos-header">
        <div>
          <p className="eyebrow">Long-form listening</p>
          <h1>Videos</h1>
          <p>Continue a YouGlish video with the trainer&apos;s captions and learning controls. Signed-in resume syncs with your account.</p>
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
