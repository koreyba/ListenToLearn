export const MAX_FEEDBACK_IMAGE_BYTES = 5 * 1024 * 1024;

const SUPPORTED_FEEDBACK_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function matchesDeclaredType(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (type === "image/png") {
    return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (type === "image/webp") {
    return startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
      && bytes[8] === 0x57
      && bytes[9] === 0x45
      && bytes[10] === 0x42
      && bytes[11] === 0x50;
  }
  return false;
}

export async function validateFeedbackImage(image: File) {
  if (!SUPPORTED_FEEDBACK_IMAGE_TYPES.has(image.type)) {
    return { error: "Attach a JPEG, PNG, or WebP image.", status: 400 } as const;
  }
  if (image.size > MAX_FEEDBACK_IMAGE_BYTES) {
    return { error: "Keep the image under 5 MB.", status: 413 } as const;
  }
  const header = new Uint8Array(await image.slice(0, 12).arrayBuffer());
  if (!matchesDeclaredType(image.type, header)) {
    return { error: "The image content does not match its format.", status: 400 } as const;
  }
  return null;
}
