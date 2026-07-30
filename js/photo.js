// Optional photo attachment for sightings: client-side downscale/compress
// (keeps the free 1GB Supabase Storage quota going much further and speeds
// up loading for viewers) then upload straight to Supabase Storage from the
// browser, same anon-key-is-public model as storage.js.

const PHOTO_BUCKET = "sighting-photos";
const PHOTO_MAX_SOURCE_BYTES = 8 * 1024 * 1024; // reject absurdly large files before even decoding
const PHOTO_MAX_DIMENSION = 1600;
const PHOTO_JPEG_QUALITY = 0.82;

function compressImage(file, maxDimension, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("canvas toBlob failed"))),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image decode failed"));
    };
    img.src = url;
  });
}

async function uploadSightingPhoto(blob) {
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${PHOTO_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "image/jpeg",
    },
    body: blob,
  });
  if (!res.ok) throw new Error(`Photo upload failed: HTTP ${res.status}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}

// Validates, compresses, and uploads in one step. Throws with an i18n key
// in .messageKey on failure so callers can show a translated message.
async function processAndUploadPhoto(file) {
  if (!file.type.startsWith("image/")) {
    const err = new Error("not an image");
    err.messageKey = "photoInvalidType";
    throw err;
  }
  if (file.size > PHOTO_MAX_SOURCE_BYTES) {
    const err = new Error("file too large");
    err.messageKey = "photoTooBig";
    throw err;
  }
  try {
    const compressed = await compressImage(file, PHOTO_MAX_DIMENSION, PHOTO_JPEG_QUALITY);
    return await uploadSightingPhoto(compressed);
  } catch (err) {
    err.messageKey = err.messageKey || "photoUploadError";
    throw err;
  }
}
