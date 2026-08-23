/** Cloudflare Worker entry point for the Listen to Learn application. */
import handler from "vinext/server/app-router-entry";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
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

function claimString(payload: JWTPayload, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

async function verifyAccessIdentity(request: Request, env: AccessEnv) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  const config = accessConfiguration(env);
  if (!token || !config) return null;

  try {
    const { payload } = await jwtVerify(token, jwksFor(config.teamDomain), {
      issuer: config.issuer,
      audience: config.audiences,
    });
    const subject = claimString(payload, "sub");
    if (!subject) return null;
    return {
      subject,
      email: claimString(payload, "email").toLowerCase(),
      name: claimString(payload, "name") || claimString(payload, "preferred_username"),
    };
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

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: AccessEnv, ctx: ExecutionContext): Promise<Response> {
    const identity = await verifyAccessIdentity(request, env);
    if (!identity) return unauthorizedResponse();

    const headers = new Headers(request.headers);
    headers.delete("Cf-Access-Jwt-Assertion");
    headers.delete("Cf-Access-Authenticated-User-Email");
    headers.delete(AUTHENTICATED_USER_HEADER);
    headers.set(AUTHENTICATED_USER_HEADER, encodeUserContext(identity));
    return handler.fetch(new Request(request, { headers }), env, ctx);
  },
};

export default worker;
