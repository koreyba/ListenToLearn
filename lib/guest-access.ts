const publicAssetPaths = new Set([
  "/caption-navigation.js",
  "/video-progress-sync.js",
  "/favicon.svg",
  "/file.svg",
  "/globe.svg",
  "/og.png",
  "/window.svg",
]);

const publicLoginReturnPaths = new Set([
  "/",
  "/practice",
  "/practice/",
  "/trainer",
  "/trainer/",
  "/trainer.html",
  "/videos",
  "/videos/",
  "/integrations",
  "/integrations/",
]);

export function isPublicGuestRequest(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const pathname = new URL(request.url).pathname;
  if (
    pathname === "/"
    || pathname === "/trainer"
    || pathname === "/trainer/"
    || pathname === "/trainer.html"
    || pathname === "/practice"
    || pathname === "/practice/"
    || pathname === "/videos"
    || pathname === "/videos/"
    || pathname === "/logout"
    || pathname === "/api/session"
    || publicAssetPaths.has(pathname)
  ) return true;
  if (pathname.startsWith("/_next/")) return true;
  return pathname === "/api/tatoeba" || pathname.startsWith("/api/tatoeba/");
}

export function guestLoginRedirect(request: Request) {
  const requestUrl = new URL(request.url);
  const requested = requestUrl.searchParams.get("returnTo") || "/";
  let target = new URL("/", requestUrl);
  const requestedPath = requested.split(/[?#]/, 1)[0];
  const hasDotSegment = requestedPath.split("/").some((segment) => segment === "." || segment === "..");

  if (
    requested.length <= 2_000
    && requested.startsWith("/")
    && !requested.startsWith("//")
    && !hasDotSegment
  ) {
    try {
      const candidate = new URL(requested, requestUrl);
      if (candidate.origin === requestUrl.origin && publicLoginReturnPaths.has(candidate.pathname)) {
        target = candidate;
      }
    } catch {
      // Invalid or hostile return targets use the public home page.
    }
  }

  target.searchParams.set("signedIn", "1");
  return target;
}
