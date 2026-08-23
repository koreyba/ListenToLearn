import { getCurrentUser, unauthorizedResponse, LEGACY_OWNER_EMAIL } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();

  return Response.json(
    {
      user: {
        id: user.subject,
        email: user.email,
        name: user.name,
        legacyStateAvailable: user.email === LEGACY_OWNER_EMAIL,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
