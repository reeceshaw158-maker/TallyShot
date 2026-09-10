import { Image } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { z } from 'zod';
import { CATEGORIES } from '../types';

const WORKER_URL =
  process.env.EXPO_PUBLIC_WORKER_URL ?? 'https://your-worker.your-subdomain.workers.dev';

/**
 * AI document detection.
 *
 * The camera sends a small, cheap frame to the Worker and gets back a
 * normalised bounding box for the receipt (or barcode) in shot. Two uses:
 *
 *  1. Draw a live lock-on box in the viewfinder so the user can see the app
 *     has actually found the paper — the thing that makes a scanner feel
 *     accurate rather than hopeful.
 *  2. Crop the captured photo to the paper before extraction. Cropping away
 *     the desk/tablecloth is the single cheapest OCR accuracy win available:
 *     the same 1024px upload is spent entirely on receipt pixels instead of
 *     half on background.
 */

export const DetectionBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const DetectionSchema = z.object({
  found: z.boolean(),
  kind: z.enum(['receipt', 'invoice', 'barcode', 'card', 'none']),
  box: DetectionBoxSchema,
  rotation: z.number(),
  confidence: z.number(),
  quality: z.enum(['good', 'blurry', 'dark', 'glare', 'cropped', 'too_far', 'none']),
  hint: z.string(),
});

export const BarcodeLookupSchema = z.object({
  found: z.boolean(),
  product_name: z.string(),
  brand: z.string(),
  country: z.string(),
  suggested_category: z.enum(CATEGORIES as [string, ...string[]]),
  estimated_price: z.number(),
  confidence: z.number(),
  note: z.string(),
});

export type DetectionBox = z.infer<typeof DetectionBoxSchema>;
export type Detection = z.infer<typeof DetectionSchema>;
export type BarcodeLookup = z.infer<typeof BarcodeLookupSchema>;

/** Below this we don't draw a lock-on box or offer to auto-crop. */
export const LOCK_CONFIDENCE = 0.55;

/** Human-readable coaching for the viewfinder, keyed off the AI's verdict. */
export const QUALITY_LABEL: Record<Detection['quality'], string> = {
  good: 'Looks good',
  blurry: 'Hold steady',
  dark: 'Needs more light',
  glare: 'Tilt to kill the glare',
  cropped: 'Fit the whole receipt in',
  too_far: 'Move closer',
  none: '',
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

async function post(payload: Record<string, unknown>, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      let message = `Worker error ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) message = body.error;
      } catch {
        // Non-JSON error body — keep the status-code message.
      }
      throw new Error(message);
    }
    const { content } = (await res.json()) as { content: string };
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Find the receipt in a viewfinder frame.
 *
 * Deliberately aggressive about size: 640px wide at 0.4 quality is ~40KB, so
 * the round trip stays under a second on a decent connection. The model only
 * needs to see where the paper is, not read it.
 */
export async function detectDocument(imageUri: string): Promise<Detection> {
  const small = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 640 } }],
    { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG }
  );

  const base64 = await FileSystem.readAsStringAsync(small.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  // The downscaled copy has served its purpose; don't leave one per poll
  // sitting in the cache directory for the OS to clean up whenever.
  FileSystem.deleteAsync(small.uri, { idempotent: true }).catch(() => {});

  const content = await post(
    { mode: 'detect', image_base64: base64, media_type: 'image/jpeg' },
    12_000
  );

  const parsed = DetectionSchema.parse(JSON.parse(content));

  // Trust the model's judgement, not its arithmetic: clamp the box into frame
  // so a slightly-out-of-range corner can't produce a negative crop later.
  const x = clamp01(parsed.box.x);
  const y = clamp01(parsed.box.y);
  return {
    ...parsed,
    box: {
      x,
      y,
      width: clamp01(parsed.box.width) > 1 - x ? 1 - x : clamp01(parsed.box.width),
      height: clamp01(parsed.box.height) > 1 - y ? 1 - y : clamp01(parsed.box.height),
    },
  };
}

export const IngredientsReadSchema = z.object({
  found: z.boolean(),
  kind: z.enum(['food', 'cosmetic', 'unknown']),
  ingredients_text: z.string(),
  allergen_emphasis: z.array(z.string()),
  unreadable_parts: z.boolean(),
  note: z.string(),
});

export type IngredientsRead = z.infer<typeof IngredientsReadSchema>;

/**
 * Read an ingredient list off a photo of the pack.
 *
 * This exists because Open Beauty Facts has names and photos for most
 * cosmetics but hardly any INCI lists — of four real Nivea/L'Oréal products
 * sampled during development, none had one. Rather than show an empty
 * ingredients section on every cream, the user photographs the back of the
 * pack and we transcribe it.
 *
 * Sent at 1280px rather than the 640px used for `detect`: ingredient panels
 * are small print, and a misread allergen is the worst error this app can
 * make. The extra bytes are worth it on a one-shot, user-initiated call.
 */
export async function readIngredientsFromPhoto(imageUri: string): Promise<IngredientsRead> {
  const resized = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 1280 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );

  const base64 = await FileSystem.readAsStringAsync(resized.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  FileSystem.deleteAsync(resized.uri, { idempotent: true }).catch(() => {});

  const content = await post(
    { mode: 'ingredients', image_base64: base64, media_type: 'image/jpeg' },
    30_000
  );
  return IngredientsReadSchema.parse(JSON.parse(content));
}

/** Identify a scanned barcode. Best-effort — the UI must present it as a guess. */
export async function lookupBarcode(
  barcode: string,
  barcodeType: string,
  currency: string
): Promise<BarcodeLookup> {
  const content = await post(
    { mode: 'lookup', barcode, barcode_type: barcodeType, currency },
    20_000
  );
  return BarcodeLookupSchema.parse(JSON.parse(content));
}

async function imageSize(uri: string): Promise<{ width: number; height: number }> {
  try {
    return await new Promise((resolve, reject) => {
      Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
    });
  } catch {
    // Image.getSize can fail on some content:// URIs. Re-encoding is slower
    // but always reports dimensions.
    const info = await ImageManipulator.manipulateAsync(uri, [], {
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return { width: info.width, height: info.height };
  }
}

/**
 * Crop a captured photo to a detected box, with a little padding so we never
 * shave the edge of the paper off.
 *
 * Returns the original URI unchanged if the crop would be implausible (tiny,
 * or nearly the whole frame anyway) — a bad crop is far worse than no crop,
 * because the user can't tell why the extraction went wrong.
 */
export async function cropToBox(
  uri: string,
  box: DetectionBox,
  padding = 0.035
): Promise<string> {
  const { width: W, height: H } = await imageSize(uri);
  if (!W || !H) return uri;

  const left = clamp01(box.x - padding);
  const top = clamp01(box.y - padding);
  const right = clamp01(box.x + box.width + padding);
  const bottom = clamp01(box.y + box.height + padding);

  const originX = Math.round(left * W);
  const originY = Math.round(top * H);
  const width = Math.round((right - left) * W);
  const height = Math.round((bottom - top) * H);

  const area = ((right - left) * (bottom - top));
  if (width < 64 || height < 64 || area < 0.04 || area > 0.94) return uri;

  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ crop: { originX, originY, width, height } }],
      { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch {
    return uri;
  }
}
