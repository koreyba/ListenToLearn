const publicAssetPaths = new Set([
  "/caption-navigation.js",
  "/favicon.svg",
  "/file.svg",
  "/globe.svg",
  "/og.png",
  "/window.svg",
]);

export function isPublicGuestRequest(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const pathname = new URL(request.url).pathname;
  if (pathname === "/" || pathname === "/trainer.html" || publicAssetPaths.has(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  return pathname === "/api/tatoeba" || pathname.startsWith("/api/tatoeba/");
}

export function guestLoginRedirect(request: Request) {
  return new URL("/?signedIn=1", request.url);
}
