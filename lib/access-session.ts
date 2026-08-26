import { jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";

const ACCESS_ASSERTION_HEADER = "Cf-Access-Jwt-Assertion";
const MAX_ACCESS_TOKEN_LENGTH = 16_384;

export type VerifiedAccessIdentity = {
  subject: string;
  email: string;
  name: string;
};

function claimString(payload: JWTPayload, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

export async function verifyAccessJwtIdentity(
  token: string,
  configuration: {
    issuer: string;
    audiences: string[];
    getKey: JWTVerifyGetKey;
  },
) {
  const { payload } = await jwtVerify(token, configuration.getKey, {
    issuer: configuration.issuer,
    audience: configuration.audiences,
  });
  const subject = claimString(payload, "sub");
  if (!subject) throw new Error("Access token subject is missing.");
  return {
    subject,
    email: claimString(payload, "email").toLowerCase(),
    name: claimString(payload, "name") || claimString(payload, "preferred_username"),
  };
}

function boundedToken(value: string | null | undefined) {
  const token = (value || "").trim();
  return token && token.length <= MAX_ACCESS_TOKEN_LENGTH ? token : "";
}

export function accessTokenFromRequest(request: Request) {
  return boundedToken(request.headers.get(ACCESS_ASSERTION_HEADER));
}

export function optionalSessionResponse(identity: VerifiedAccessIdentity | null) {
  return Response.json(
    {
      user: identity
        ? { id: identity.subject, email: identity.email, name: identity.name }
        : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
