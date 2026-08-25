/** Cloudflare Worker entry point for the Listen to Learn application. */
import handler from "vinext/server/app-router-entry";
import { createRemoteJWKSet } from "jose";
import { backfillTranslations } from "@/app/api/phrases/route";
import { accessTokenFromRequest, optionalSessionResponse, verifyAccessJwtIdentity } from "@/lib/access-session";
import { guestLoginRedirect, isPublicGuestRequest } from "@/lib/guest-access";
import { AUTHENTICATED_USER_HEADER, encodeUserContext } from "@/lib/user-context";

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type AccessEnv = Env & {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
};

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const backfillInFlight = new Map<string, Promise<void>>();

const PUBLIC_DOCUMENT_PATHS = new Set([
  "/",
  "/trainer",
  "/trainer/",
  "/trainer.html",
  "/practice",
  "/practice/",
]);
const PUBLIC_LONG_CACHE_PATHS = new Set([
  "/caption-navigation.js",
  "/video-progress-sync.js",
  "/favicon.svg",
  "/file.svg",
  "/globe.svg",
  "/og.png",
  "/window.svg",
]);

function accessConfiguration(env: AccessEnv) {
  const teamDomain = (env.ACCESS_TEAM_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const audiences = (env.ACCESS_AUD || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!teamDomain || !audiences.length) return null;
  return {
    teamDomain,
    audiences,
    issuer: "https://" + teamDomain,
  };
}

function jwksFor(teamDomain: string) {
  const existing = jwksCache.get(teamDomain);
  if (existing) return existing;
  const jwks = createRemoteJWKSet(new URL("https://" + teamDomain + "/cdn-cgi/access/certs"));
  jwksCache.set(teamDomain, jwks);
  return jwks;
}

async function verifyAccessIdentity(
  request: Request,
  env: AccessEnv,
  options: { allowCookie?: boolean } = {},
) {
  const token = accessTokenFromRequest(request, options);
  const config = accessConfiguration(env);
  if (!token || !config) return null;

  try {
    return await verifyAccessJwtIdentity(token, {
      issuer: config.issuer,
      audiences: config.audiences,
      getKey: jwksFor(config.teamDomain),
    });
  } catch (error) {
    console.warn("Access identity verification failed:", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}

function unauthorizedResponse() {
  return Response.json(
    { error: "Войди через Google, чтобы использовать приложение." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

function sanitizedHeaders(request: Request) {
  const headers = new Headers(request.headers);
  headers.delete("Cf-Access-Jwt-Assertion");
  headers.delete("Cf-Access-Authenticated-User-Email");
  headers.delete(AUTHENTICATED_USER_HEADER);
  return headers;
}

function publicCacheControl(pathname: string) {
  if (pathname.startsWith("/_next/")) return "public, max-age=31536000, immutable";
  if (PUBLIC_LONG_CACHE_PATHS.has(pathname)) return "public, max-age=86400, stale-while-revalidate=604800";
  if (PUBLIC_DOCUMENT_PATHS.has(pathname)) return "public, max-age=300, stale-while-revalidate=86400";
  return "";
}

function withPublicCache(response: Response, pathname: string) {
  const cacheControl = publicCacheControl(pathname);
  const existingCacheControl = response.headers.get("Cache-Control") || "";
  if (
    !cacheControl
    || !response.ok
    || response.headers.has("Set-Cookie")
    || /(?:^|[, ])(?:private|no-store)(?:[, ]|$)/i.test(existingCacheControl)
    || existingCacheControl === cacheControl
  ) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", cacheControl);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function scheduleBackfill(userId: string, request: Request, ctx: ExecutionContext) {
  if (backfillInFlight.has(userId)) return;
  const task = backfillTranslations(userId, request).finally(() => {
    if (backfillInFlight.get(userId) === task) backfillInFlight.delete(userId);
  });
  backfillInFlight.set(userId, task);
  ctx.waitUntil(task);
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: AccessEnv, ctx: ExecutionContext): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    const headers = sanitizedHeaders(request);

    if (pathname === "/api/session" && (request.method === "GET" || request.method === "HEAD")) {
      const identity = await verifyAccessIdentity(request, env, { allowCookie: true });
      const response = optionalSessionResponse(identity);
      if (request.method === "HEAD") {
        return new Response(null, { status: response.status, headers: response.headers });
      }
      return response;
    }

    // Guest-safe documents, assets, and the public Tatoeba proxy do not consume
    // identity data. Avoid a remote JWKS lookup on every public navigation.
    if (isPublicGuestRequest(request)) {
      const response = await handler.fetch(new Request(request, { headers }), env, ctx);
      return withPublicCache(response, pathname);
    }

    const identity = await verifyAccessIdentity(request, env);

    if (!identity) {
      return unauthorizedResponse();
    }

    if (pathname === "/login") {
      return Response.redirect(guestLoginRedirect(request), 303);
    }

    headers.set(AUTHENTICATED_USER_HEADER, encodeUserContext(identity));
    const forwardedRequest = new Request(request, { headers });
    const response = await handler.fetch(forwardedRequest, env, ctx);
    const searchParams = new URL(request.url).searchParams;
    if (
      response.ok
      && request.method === "GET"
      && pathname === "/api/phrases"
      && !searchParams.has("id")
      && response.headers.get("X-ListenToLearn-Backfill") === "1"
    ) {
      scheduleBackfill(identity.subject, forwardedRequest, ctx);
    }
    return response;
  },
};

export default worker;
