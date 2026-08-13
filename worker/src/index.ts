/**
 * TallyShot AI Worker.
 *
 * One endpoint, three modes:
 *   - `extract` (default) — full receipt → structured JSON. Claude Opus 5.
 *   - `detect`            — find the receipt/barcode in a viewfinder frame and
 *                           return a normalised bounding box. Claude Haiku 4.5
 *                           because it runs every few seconds while the camera
 *                           is open, so it must be fast and cheap.
 *   - `lookup`            — barcode digits → product guess. Claude Opus 5.
 *
 * Every mode uses structured outputs (`output_config.format`), so the model is
 * constrained to valid JSON against a schema. That removes the old
 * markdown-code-fence stripping and the "AI returned an unexpected response"
 * failure class entirely.
 */

interface Env {
  ANTHROPIC_API_KEY: string;
  /**
   * Optional model overrides, set in wrangler.toml [vars]. Kept configurable
   * so extraction quality can be A/B'd against real receipts with a config
   * change instead of a code change.
   *
   * EXTRACT_MODEL must be a model that accepts `output_config.effort` and
   * rejects nothing else this Worker sends — i.e. Opus 5 / Opus 4.8 / Sonnet 5.
   * Older tiers (Sonnet 4.5, Haiku 4.5) will 400 on `effort`.
   */
  EXTRACT_MODEL?: string;
  DETECT_MODEL?: string;
  LOOKUP_MODEL?: string;
}

type Mode = 'extract' | 'detect' | 'lookup';

interface RequestBody {
  mode?: Mode;
  image_base64?: string;
  media_type?: string;
  system_prompt?: string;
  /** lookup mode only */
  barcode?: string;
  barcode_type?: string;
  currency?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Model per mode.
 *
 * `detect` is deliberately on Haiku: it's a "where is the paper in this frame"
 * question that fires on a timer while the camera is open. Opus-tier quality
 * there would multiply the cost of leaving the scanner open with no accuracy
 * benefit on a task this simple.
 */
const DEFAULT_MODEL: Record<Mode, string> = {
  extract: 'claude-opus-5',
  detect: 'claude-haiku-4-5',
  lookup: 'claude-opus-5',
};

function modelFor(mode: Mode, env: Env): string {
  const override =
    mode === 'extract' ? env.EXTRACT_MODEL : mode === 'detect' ? env.DETECT_MODEL : env.LOOKUP_MODEL;
  return override?.trim() || DEFAULT_MODEL[mode];
}

/** ~8MB of base64 ≈ 6MB image. Anything bigger is a bug or abuse. */
const MAX_BASE64_CHARS = 8_000_000;

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const CATEGORIES = [
  'Food & Drink',
  'Travel',
  'Transport',
  'Accommodation',
  'Office & Tech',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Shopping',
  'Other',
];

// ---------------------------------------------------------------------------
// Schemas — structured outputs. Note the constraints the API enforces:
// every object needs `additionalProperties: false` and a full `required` list,
// and numeric bounds (minimum/maximum) are NOT supported — so ranges live in
// the field descriptions instead.
// ---------------------------------------------------------------------------

const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    merchant: { type: 'string', description: 'Shop/business name. Empty string if unreadable.' },
    date: { type: 'string', description: 'Purchase date as YYYY-MM-DD.' },
    currency: { type: 'string', description: 'ISO-4217 3-letter code, e.g. GBP.' },
    line_items: {
      type: 'array',
      description: 'Every line item visible on the receipt.',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          quantity: { type: 'number', description: 'Defaults to 1 when not printed.' },
          unit_price: { type: 'number' },
          total: { type: 'number' },
        },
        required: ['description', 'quantity', 'unit_price', 'total'],
        additionalProperties: false,
      },
    },
    subtotal: { type: 'number' },
    tax: { type: 'number' },
    total: { type: 'number' },
    payment_method: { type: 'string', description: 'e.g. "Visa ...4321", "Cash". Empty string if not shown.' },
    invoice_number: { type: 'string', description: 'Invoice/receipt/order number verbatim. Empty string if none.' },
    suggested_category: { type: 'string', enum: CATEGORIES },
  },
  required: [
    'merchant',
    'date',
    'currency',
    'line_items',
    'subtotal',
    'tax',
    'total',
    'payment_method',
    'invoice_number',
    'suggested_category',
  ],
  additionalProperties: false,
};

const DETECT_SCHEMA = {
  type: 'object',
  properties: {
    found: { type: 'boolean', description: 'True only if a receipt, invoice or barcode is clearly visible.' },
    kind: { type: 'string', enum: ['receipt', 'invoice', 'barcode', 'card', 'none'] },
    box: {
      type: 'object',
      description: 'Tight bounding box around the document, normalised 0-1 relative to the image.',
      properties: {
        x: { type: 'number', description: 'Left edge, 0-1. 0 is the left of the image.' },
        y: { type: 'number', description: 'Top edge, 0-1. 0 is the top of the image.' },
        width: { type: 'number', description: 'Width as a fraction of image width, 0-1.' },
        height: { type: 'number', description: 'Height as a fraction of image height, 0-1.' },
      },
      required: ['x', 'y', 'width', 'height'],
      additionalProperties: false,
    },
    rotation: { type: 'number', description: 'Approximate clockwise tilt in degrees, -45 to 45. 0 if upright.' },
    confidence: { type: 'number', description: 'How sure you are, 0-1.' },
    quality: {
      type: 'string',
      enum: ['good', 'blurry', 'dark', 'glare', 'cropped', 'too_far', 'none'],
      description: 'The single biggest problem with this frame for OCR, or "good".',
    },
    hint: {
      type: 'string',
      description:
        'Max 6 words of direct instruction to the person holding the phone, e.g. "Move closer" or "Hold steady".',
    },
  },
  required: ['found', 'kind', 'box', 'rotation', 'confidence', 'quality', 'hint'],
  additionalProperties: false,
};

const LOOKUP_SCHEMA = {
  type: 'object',
  properties: {
    found: { type: 'boolean', description: 'True only if you actually recognise this barcode or its brand prefix.' },
    source: {
      type: 'string',
      enum: ['ai_guess'],
      description: 'Always "ai_guess" — you are the fallback path when the product databases have no record.',
    },
    product_name: { type: 'string', description: 'Best-guess product name, or empty string.' },
    brand: { type: 'string', description: 'Brand/manufacturer, or empty string.' },
    country: { type: 'string', description: 'Country implied by the GS1 prefix, or empty string.' },
    suggested_category: { type: 'string', enum: CATEGORIES },
    estimated_price: { type: 'number', description: 'Typical retail price in the requested currency. 0 if unknown.' },
    confidence: { type: 'number', description: '0-1. Be honest — a bare number rarely identifies a product.' },
    note: { type: 'string', description: 'One short sentence for the user about how reliable this guess is.' },
  },
  required: [
    'found',
    'source',
    'product_name',
    'brand',
    'country',
    'suggested_category',
    'estimated_price',
    'confidence',
    'note',
  ],
  additionalProperties: false,
};

const DETECT_SYSTEM = `You locate documents in camera frames for a receipt-scanning app.

You are given a single low-resolution viewfinder frame. Find the receipt, invoice or barcode in it and return its bounding box.

Rules:
- The box must be TIGHT around the paper's edges — not the whole frame, and not just the text block.
- Coordinates are normalised: x/y are the top-left corner as a fraction of image width/height, width/height are fractions of the image size. x + width must not exceed 1, y + height must not exceed 1.
- Thermal till receipts are long, narrow and often curled. Include the full strip, including blank paper at the top and bottom.
- If you see only a barcode (no receipt), use kind "barcode" and box the barcode itself.
- If there is no document in the frame, set found=false, kind="none", box to all zeros, confidence 0, quality "none", hint "Point at a receipt".
- confidence below 0.5 means "I think something is there but I'm not sure".
- Judge quality for OCR, not for looking pretty: "blurry" (motion/focus), "dark" (underexposed), "glare" (hotspot over text), "cropped" (paper runs off frame), "too_far" (text will be unreadable), otherwise "good".
- hint is spoken to a person holding a phone. Max 6 words, imperative, no punctuation at the end.`;

function lookupSystem(currency: string): string {
  return `You identify retail products from barcode numbers for an expense-tracking app.

You will be given a barcode's digits and symbology. Return your best identification.

Rules:
- Be honest about uncertainty. A raw EAN/UPC number usually cannot be resolved to an exact product from memory alone. If you don't genuinely recognise it, set found=false and confidence low, but still fill in whatever you CAN infer.
- You can almost always infer country from the GS1 prefix (e.g. 50 = UK, 30-37 = France, 40-44 = Germany, 0/1 = US/Canada, 49 = Japan, 93 = Australia). Put that in "country" even when found=false.
- Prices are in ${currency}. Use 0 if you have no basis for a price.
- suggested_category must be one of the allowed values; use "Shopping" for general retail goods and "Other" when you have no idea.
- note is shown directly to the user. Say plainly whether this is a real identification or an inference from the prefix.`;
}

// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function err(message: string, status: number): Response {
  return json({ error: message }, status);
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system: string;
  messages: unknown[];
  output_config: Record<string, unknown>;
  thinking?: Record<string, unknown>;
  temperature?: number;
  fallbacks?: string;
}

/**
 * Call the Messages API and return the model's text block.
 *
 * `fallbacks: "default"` is sent on the Opus 5 modes so a safety-classifier
 * refusal is retried server-side on Anthropic's recommended fallback model
 * instead of surfacing to the user as a failed scan. It's a beta, so if the
 * account doesn't have it we retry once without it rather than breaking
 * scanning outright.
 */
async function callClaude(
  apiKey: string,
  payload: AnthropicRequest,
  useFallbacks: boolean
): Promise<{ ok: true; text: string } | { ok: false; status: number; message: string }> {
  const headers: Record<string, string> = {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  };
  const body: AnthropicRequest = { ...payload };

  if (useFallbacks) {
    headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    body.fallbacks = 'default';
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(55_000),
  });

  if (!res.ok) {
    const detail = await res.text();
    // Beta not enabled on this account — retry once without it so a receipt
    // scan never fails just because of the refusal-fallback opt-in.
    if (useFallbacks && res.status === 400 && /fallback/i.test(detail)) {
      return callClaude(apiKey, payload, false);
    }
    console.error(`Anthropic ${res.status}:`, detail);
    return { ok: false, status: 502, message: `Anthropic API error ${res.status}` };
  }

  const data = (await res.json()) as any;

  if (data.stop_reason === 'refusal') {
    return {
      ok: false,
      status: 422,
      message: "The AI declined to read this image. If it's a receipt, try a clearer photo.",
    };
  }

  const text = (data.content ?? [])
    .filter((b: any) => b?.type === 'text')
    .map((b: any) => b.text)
    .join('')
    .trim();

  if (!text) {
    return { ok: false, status: 502, message: 'AI returned an empty response' };
  }

  return { ok: true, text };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (request.method !== 'POST') {
      return err('Method not allowed', 405);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return err('Worker is missing ANTHROPIC_API_KEY', 500);
    }

    let body: RequestBody;
    try {
      body = await request.json();
    } catch {
      return err('Invalid JSON', 400);
    }

    const mode: Mode = body.mode ?? 'extract';
    if (!['extract', 'detect', 'lookup'].includes(mode)) {
      return err(`Unknown mode "${mode}"`, 400);
    }

    // ---- lookup: text-only, no image -------------------------------------
    if (mode === 'lookup') {
      const code = (body.barcode ?? '').trim();
      if (!/^[0-9A-Za-z\-. $/+%]{4,64}$/.test(code)) {
        return err('Missing or invalid barcode', 400);
      }
      const result = await callClaude(
        env.ANTHROPIC_API_KEY,
        {
          model: modelFor('lookup', env),
          max_tokens: 1024,
          system: lookupSystem(body.currency ?? 'GBP'),
          messages: [
            {
              role: 'user',
              content: `Barcode: ${code}\nSymbology: ${body.barcode_type ?? 'unknown'}\n\nIdentify this product.`,
            },
          ],
          thinking: { type: 'disabled' },
          output_config: {
            effort: 'medium',
            format: { type: 'json_schema', schema: LOOKUP_SCHEMA },
          },
        },
        true
      );
      return result.ok ? json({ content: result.text }) : err(result.message, result.status);
    }

    // ---- extract / detect: image required --------------------------------
    const image = body.image_base64;
    const mediaType = body.media_type;

    if (!image || !mediaType) {
      return err('Missing image_base64 or media_type', 400);
    }
    if (image.length > MAX_BASE64_CHARS) {
      return err('Image too large', 413);
    }
    if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
      return err('Invalid media type', 400);
    }

    const isDetect = mode === 'detect';
    const system = isDetect ? DETECT_SYSTEM : body.system_prompt;
    if (!system) {
      return err('Missing system_prompt', 400);
    }

    const result = await callClaude(
      env.ANTHROPIC_API_KEY,
      {
        model: modelFor(mode, env),
        max_tokens: isDetect ? 512 : 4096,
        system,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
              {
                type: 'text',
                text: isDetect
                  ? 'Locate the document in this frame.'
                  : 'Extract the receipt data.',
              },
            ],
          },
        ],
        // Haiku 4.5 still accepts sampling params and has no `effort` or
        // adaptive-thinking config — sending either would 400. Opus 5 is the
        // mirror image: no temperature, thinking on by default (turned off
        // here to keep scans fast, which is allowed at effort <= "high";
        // structured outputs already guarantee well-formed JSON, so there is
        // nothing for reasoning to add on a transcription task).
        ...(isDetect
          ? { temperature: 0 }
          : { thinking: { type: 'disabled' } }),
        output_config: {
          ...(isDetect ? {} : { effort: 'medium' }),
          format: {
            type: 'json_schema',
            schema: isDetect ? DETECT_SCHEMA : EXTRACT_SCHEMA,
          },
        },
      },
      !isDetect
    );

    return result.ok ? json({ content: result.text }) : err(result.message, result.status);
  },
};
