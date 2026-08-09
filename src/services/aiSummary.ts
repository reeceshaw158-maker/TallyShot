/**
 * Background AI product summary generation.
 *
 * Calls the Cloudflare Worker /chat endpoint with a fixed summary prompt,
 * then caches the result in SQLite via saveAiSummary(). Fire-and-forget
 * from the result screen — never blocks the UI.
 */
import { ProductRecord, saveAiSummary } from './productCache';

const WORKER_URL = process.env.EXPO_PUBLIC_WORKER_URL ?? '';
const TIMEOUT_MS = 12_000;

export async function generateAiSummary(record: ProductRecord): Promise<string | null> {
  if (!WORKER_URL) return null;
  if (!record.name && !record.brand) return null;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(`${WORKER_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ac.signal,
      body: JSON.stringify({
        product: {
          name: record.name,
          brand: record.brand,
          quantity: record.quantity,
          nutriscore: record.nutriscore,
          novaGroup: record.novaGroup,
          ecoscore: record.ecoscore,
          allergens: record.allergens,
          ingredients: record.ingredients,
          nutriments: record.nutriments,
          categories: record.categories,
        },
        question:
          'Give me a 2-3 sentence honest plain-English verdict on this product as a smart shopper. ' +
          'Be direct and specific — mention the best and worst things about it. ' +
          'Do not use bullet points. Do not repeat the product name in the first word.',
      }),
    });

    if (!resp.ok) return null;
    const data = await resp.json() as { answer?: string };
    const summary = (data.answer ?? '').trim();
    if (!summary) return null;

    await saveAiSummary(record.barcode, summary);
    return summary;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
