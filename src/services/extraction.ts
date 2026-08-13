import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { ExtractionSchema, ExtractionResult } from '../schemas/extraction';
import { TaxMode } from '../types';
import { DetectionBox, cropToBox } from './detection';

const WORKER_URL = process.env.EXPO_PUBLIC_WORKER_URL ?? 'https://your-worker.your-subdomain.workers.dev';

/**
 * Build the system prompt with the user's region/tax mode embedded.
 *
 * Telling Claude the expected mode prevents the most common AI extraction
 * failure: misreading a £25 inclusive-VAT receipt as a £25 + £5 VAT line
 * (which adds up to £30, not £25). UK / EU / AU / NZ receipts have tax
 * already in the total. US / CA receipts add tax on top.
 */
function buildSystemPrompt(taxMode: TaxMode, taxLabel: string): string {
  const taxNote = taxMode === 'inclusive'
    ? `IMPORTANT: This user's region uses ${taxLabel}-INCLUSIVE pricing. The receipt's "total" already includes ${taxLabel}. Do NOT add tax to the total. The relationship is: subtotal + ${taxLabel} = total.`
    : `IMPORTANT: This user's region uses ${taxLabel}-EXCLUSIVE pricing. The receipt may show ${taxLabel} added on top of the subtotal. The relationship is: subtotal + ${taxLabel} = total.`;

  return `You are a receipt data extraction engine. Analyse the receipt image and return ONLY valid JSON — no markdown, no explanation, just the JSON object.

Required schema:
{
  "merchant": string,
  "date": "YYYY-MM-DD",
  "currency": "ISO-4217 3-letter code",
  "line_items": [{ "description": string, "quantity": number, "unit_price": number, "total": number }],
  "subtotal": number,
  "tax": number,
  "total": number,
  "payment_method": string | null,
  "invoice_number": string | null,
  "suggested_category": one of ["Food & Drink","Travel","Transport","Accommodation","Office & Tech","Utilities","Healthcare","Entertainment","Shopping","Other"]
}

${taxNote}

Rules:
- All monetary values must be numbers (not strings).
- If a field cannot be determined, use sensible defaults: empty string, 0, or null.
- date must be ISO 8601 (YYYY-MM-DD). If only month/year visible, use the 1st of the month.
- suggested_category must exactly match one of the enum values.
- Extract every line item visible on the receipt. Quantity defaults to 1 if not shown.
- invoice_number: copy any "Invoice #", "Receipt #", "Order #", "Transaction ID" or similar identifier verbatim. Use an empty string when nothing like that appears (most paper till receipts won't have one).
- payment_method: copy what's printed (e.g. "VISA ****4321", "CASH", "Contactless"). Empty string if not shown.
- If the image is cropped tightly to the receipt, the paper edges may be missing — that's expected, read what's there.`;
}

/**
 * Resize and compress receipt images for fast upload.
 *
 * 1280px at 0.72 quality: the earlier 1024/0.6 pairing was chosen for upload
 * speed, but small print on thermal paper (the tax line, the card digits) is
 * exactly what gets lost first. This is still well under 400KB.
 */
export async function resizeImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1280 } }],
    { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

/**
 * Pre-warm the Worker. Cloudflare Workers can have a 1–2s cold start;
 * sending a tiny ping when the user opens the camera screen masks that
 * latency so the actual scan feels faster.
 */
export async function prewarmWorker(): Promise<void> {
  try {
    await fetch(WORKER_URL, {
      method: 'OPTIONS',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // Best-effort. Don't surface errors here.
  }
}

export async function extractReceiptData(
  imageUri: string,
  taxMode: TaxMode,
  taxLabel: string,
  /**
   * Optional AI-detected box for the receipt within the photo. When present the
   * image is cropped to it first, so the whole upload budget is spent on
   * receipt pixels instead of the table it's lying on.
   */
  cropBox?: DetectionBox | null
): Promise<ExtractionResult> {
  const sourceUri = cropBox ? await cropToBox(imageUri, cropBox) : imageUri;
  const resizedUri = await resizeImage(sourceUri);
  const base64 = await FileSystem.readAsStringAsync(resizedUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'extract',
      image_base64: base64,
      media_type: 'image/jpeg',
      system_prompt: buildSystemPrompt(taxMode, taxLabel),
    }),
  });

  if (!response.ok) {
    let message = `Worker error ${response.status}`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // Non-JSON error body — the status-code message is all we have.
    }
    throw new Error(message);
  }

  const { content } = await response.json();
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('AI returned an unexpected response. Please try again.');
  }
  let result: ExtractionResult;
  try {
    result = ExtractionSchema.parse(parsed);
  } catch {
    throw new Error('AI response did not match the expected format. Please try again.');
  }

  // The schema constrains these to plain strings so the model always has a
  // valid value to emit; "not present" is null everywhere else in the app.
  return {
    ...result,
    payment_method: result.payment_method?.trim() ? result.payment_method.trim() : null,
    invoice_number: result.invoice_number?.trim() ? result.invoice_number.trim() : null,
  };
}

/**
 * Decide whether an extraction result is good enough to skip the Review screen.
 * Used by Quick Scan mode.
 */
export function isExtractionConfident(r: ExtractionResult): boolean {
  if (!r.merchant?.trim()) return false;
  if (!r.total || r.total <= 0) return false;

  // Numeric integrity (works for both inclusive and exclusive — same maths)
  const expected = (r.subtotal ?? 0) + (r.tax ?? 0);
  if (expected > 0) {
    const diff = Math.abs(expected - r.total);
    if (diff / r.total > 0.02 && diff > 0.05) return false;
  }

  // Date sanity
  const ts = Date.parse(r.date);
  if (Number.isNaN(ts)) return false;
  const fiveYearsAgo = Date.now() - 5 * 365 * 24 * 60 * 60 * 1000;
  const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
  if (ts < fiveYearsAgo || ts > tomorrow) return false;

  return true;
}
