const MAX_PROGRESS_SECONDS = 604_800;

export type VideoProgressInput = {
  seconds: number;
  captionId: string;
  captionText: string;
};

type VideoProgressResult =
  | { ok: true; value: VideoProgressInput | null }
  | { ok: false; error: string };

function cleanText(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, limit).trim() : "";
}

export function readVideoProgressInput(value: unknown): VideoProgressResult {
  if (value === undefined) return { ok: true, value: null };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Video progress must be an object." };
  }

  const progress = value as Record<string, unknown>;
  const seconds = Number(progress.seconds);
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > MAX_PROGRESS_SECONDS) {
    return { ok: false, error: "Video progress seconds are invalid." };
  }

  return {
    ok: true,
    value: {
      seconds,
      captionId: cleanText(progress.captionId, 160),
      captionText: cleanText(progress.captionText, 1_000),
    },
  };
}

export function normalizeStoredVideoProgress(value: unknown) {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const normalized = readVideoProgressInput(input);
  const updatedAt = typeof input.updatedAt === "string" && !Number.isNaN(Date.parse(input.updatedAt))
    ? input.updatedAt
    : "";
  if (!normalized.ok || !normalized.value || !updatedAt) {
    return { seconds: 0, captionId: "", captionText: "", updatedAt: "" };
  }
  return { ...normalized.value, updatedAt };
}
