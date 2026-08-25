export const APP_SIGNED_OUT_COOKIE = "__Host-listen_to_learn_signed_out";

const COOKIE_ATTRIBUTES = "Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax";
const CLEAR_COOKIE_ATTRIBUTES = "Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax";

export function hasAppSignedOutMarker(request: Request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  return cookieHeader.split(";").some((entry) => {
    const separator = entry.indexOf("=");
    if (separator < 0) return false;
    const name = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    return name === APP_SIGNED_OUT_COOKIE && value === "1";
  });
}

export function clearAppSignedOutCookie() {
  return `${APP_SIGNED_OUT_COOKIE}=; ${CLEAR_COOKIE_ATTRIBUTES}`;
}

export function appLogoutResponse() {
  return Response.json(
    { signedOut: true },
    {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": `${APP_SIGNED_OUT_COOKIE}=1; ${COOKIE_ATTRIBUTES}`,
      },
    },
  );
}
