export type AccountSessionUser = {
  id: string;
  email: string;
  name: string;
};

type SessionFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export const SIGN_OUT_HREF = "/logout";
export const APP_LOGOUT_HREF = "/api/logout";
const YOUTUBE_PROGRESS_STORAGE_PREFIX = "unmumble-youtube-progress-v1:";
const LEGACY_YOUTUBE_PROGRESS_STORAGE_PREFIX = "listen-to-learn-youtube-progress-v1:";
const LEGACY_YOUTUBE_PROGRESS_STORAGE_KEY = "listen-to-learn-youtube-progress-v1";

type SignOutNavigator = (target: string) => void;

export async function completeSignOut(
  fetcher: SessionFetcher = fetch,
  navigate: SignOutNavigator = (target) => window.location.replace(target),
) {
  try {
    const response = await fetcher(APP_LOGOUT_HREF, {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) return false;
  } catch {
    return false;
  }

  navigate("/");
  return true;
}

export function signInHref(returnTo: string) {
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export function youtubeProgressStorageKey(userId: string | null | undefined) {
  return YOUTUBE_PROGRESS_STORAGE_PREFIX + (userId ? encodeURIComponent(userId) : "anonymous");
}

export function legacyYoutubeProgressStorageKeys(userId: string | null | undefined) {
  const identity = userId ? encodeURIComponent(userId) : "anonymous";
  return [
    LEGACY_YOUTUBE_PROGRESS_STORAGE_PREFIX + identity,
    LEGACY_YOUTUBE_PROGRESS_STORAGE_KEY,
  ];
}

let inFlightSessionPromise: Promise<AccountSessionUser | null> | null = null;

export async function accountSession(fetcher: SessionFetcher = fetch) {
  if (fetcher === fetch && inFlightSessionPromise) {
    return inFlightSessionPromise;
  }

  const promise = (async () => {
    try {
      const response = await fetcher("/api/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) return null;
      const data = await response.json() as { user?: Partial<AccountSessionUser> | null };
      if (!data.user || typeof data.user.id !== "string" || !data.user.id) return null;
      return {
        id: data.user.id,
        email: typeof data.user.email === "string" ? data.user.email : "",
        name: typeof data.user.name === "string" ? data.user.name : "",
      };
    } catch {
      return null;
    } finally {
      if (fetcher === fetch) {
        inFlightSessionPromise = null;
      }
    }
  })();

  if (fetcher === fetch) {
    inFlightSessionPromise = promise;
  }

  return promise;
}
