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
export const ACCESS_LOGOUT_HREF = "/cdn-cgi/access/logout";
const YOUTUBE_PROGRESS_STORAGE_PREFIX = "listen-to-learn-youtube-progress-v1:";

type SignOutNavigator = (target: string) => void;

export async function completeSignOut(
  fetcher: SessionFetcher = fetch,
  navigate: SignOutNavigator = (target) => window.location.replace(target),
) {
  try {
    const response = await fetcher(ACCESS_LOGOUT_HREF, {
      cache: "no-store",
      credentials: "same-origin",
      redirect: "manual",
    });
    if (!response.ok && response.type !== "opaqueredirect") return false;
    navigate("/");
    return true;
  } catch {
    return false;
  }
}

export function signInHref(returnTo: string) {
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export function youtubeProgressStorageKey(userId: string | null | undefined) {
  return YOUTUBE_PROGRESS_STORAGE_PREFIX + (userId ? encodeURIComponent(userId) : "anonymous");
}

export async function accountSession(fetcher: SessionFetcher = fetch) {
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
  }
}
