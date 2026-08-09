interface Env {
  ANTHROPIC_API_KEY: string;
}

interface ScanBody {
  image_base64: string;
  media_type: string;
  system_prompt: string;
}

interface ChatBody {
  product: {
    name: string | null;
    brand: string | null;
    quantity: string | null;
    nutriscore: string | null;
    novaGroup: number | null;
    ecoscore: string | null;
    allergens: string | null;
    ingredients: string | null;
    nutriments: {
      energyKcal100g: number | null;
      fat100g: number | null;
      saturatedFat100g: number | null;
      carbohydrates100g: number | null;
      sugars100g: number | null;
      fiber100g: number | null;
      proteins100g: number | null;
      salt100g: number | null;
    } | null;
    countries: string | null;
  };
  question: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    if (url.pathname === '/chat') {
      return handleChat(request, env);
    }
    return handleScan(request, env);
  },
};

async function handleChat(request: Request, env: Env): Promise<Response> {
  let body: ChatBody;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: CORS_HEADERS });
  }

  if (!body.question?.trim()) {
    return new Response('Missing question', { status: 400, headers: CORS_HEADERS });
  }

  const p = body.product;
  const novaLabel = p.novaGroup
    ? { 1: 'unprocessed', 2: 'culinary ingredient', 3: 'processed', 4: 'ultra-processed' }[p.novaGroup] ?? ''
    : '';

  const nutriLine = p.nutriments
    ? [
        p.nutriments.energyKcal100g != null ? `${Math.round(p.nutriments.energyKcal100g)} kcal` : null,
        p.nutriments.fat100g != null ? `fat ${p.nutriments.fat100g}g` : null,
        p.nutriments.sugars100g != null ? `sugar ${p.nutriments.sugars100g}g` : null,
        p.nutriments.proteins100g != null ? `protein ${p.nutriments.proteins100g}g` : null,
        p.nutriments.salt100g != null ? `salt ${p.nutriments.salt100g}g` : null,
      ].filter(Boolean).join(', ')
    : null;

  const productInfo = [
    p.name   ? `Product: ${p.name}` : null,
    p.brand  ? `Brand: ${p.brand}` : null,
    p.quantity ? `Size: ${p.quantity}` : null,
    p.nutriscore ? `Nutri-Score: ${p.nutriscore.toUpperCase()} (A=healthiest, E=least healthy)` : null,
    p.novaGroup  ? `NOVA group: ${p.novaGroup}/4 (${novaLabel})` : null,
    p.allergens  ? `Allergens: ${p.allergens}` : null,
    nutriLine    ? `Per 100g: ${nutriLine}` : null,
    p.ingredients ? `Ingredients: ${p.ingredients.slice(0, 500)}` : null,
    p.countries  ? `Country of origin: ${p.countries}` : null,
  ].filter(Boolean).join('\n');

  const system = `You are a friendly AI shopping assistant inside the TallyShot app. The user has just scanned a product barcode and is standing in a store. They want a quick, helpful answer about this product.

Product data:
${productInfo || 'No product data available'}

Rules:
- Answer in plain, conversational English — no markdown, no bullet points.
- Be concise: aim for 1–3 sentences. The user is standing in a shop aisle.
- If asked about health or diet, be honest but constructive.
- If asked about allergens, be clear and precise — this could affect someone's safety.
- If the product data is missing a field you need, say so briefly rather than guessing.`;

  const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 300,
      temperature: 0.4,
      system,
      messages: [{ role: 'user', content: body.question.trim() }],
    }),
  });

  if (!anthropicResp.ok) {
    const err = await anthropicResp.text();
    console.error('Anthropic error:', err);
    return new Response(`Anthropic API error: ${anthropicResp.status}`, { status: 502, headers: CORS_HEADERS });
  }

  const data = await anthropicResp.json() as any;
  const answer = data.content?.[0]?.text ?? '';

  return new Response(JSON.stringify({ answer }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function handleScan(request: Request, env: Env): Promise<Response> {
  let body: ScanBody;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: CORS_HEADERS });
  }

  if (!body.image_base64 || !body.media_type || !body.system_prompt) {
    return new Response('Missing required fields', { status: 400, headers: CORS_HEADERS });
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(body.media_type)) {
    return new Response('Invalid media type', { status: 400, headers: CORS_HEADERS });
  }

  const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      temperature: 0,
      system: body.system_prompt,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: body.media_type, data: body.image_base64 } },
            { type: 'text', text: 'Extract the receipt data and return as JSON.' },
          ],
        },
      ],
    }),
  });

  if (!anthropicResp.ok) {
    const err = await anthropicResp.text();
    console.error('Anthropic error:', err);
    return new Response(`Anthropic API error: ${anthropicResp.status}`, { status: 502, headers: CORS_HEADERS });
  }

  const data = await anthropicResp.json() as any;
  const content = data.content?.[0]?.text ?? '';
  const cleaned = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  return new Response(JSON.stringify({ content: cleaned }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
