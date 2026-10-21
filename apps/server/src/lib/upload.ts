// Image uploads go through the Worker into R2 — no presigned URLs in MVP.
// Everything is validated: type whitelist and a 5 MB cap.

import { AppError } from "../errors";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_BYTES = 5 * 1024 * 1024;

export async function storeImage(
  env: Env,
  file: unknown,
  folder: "photos" | "verification",
): Promise<string> {
  if (!(file instanceof File)) {
    throw new AppError(400, "photo_required", "Attach a photo.");
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    throw new AppError(415, "photo_type", "Use a JPG, PNG or WebP photo.");
  }
  if (file.size > MAX_BYTES) {
    throw new AppError(413, "photo_too_large", "Photos can be up to 5 MB.");
  }
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;
  await env.PHOTOS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  return key;
}
