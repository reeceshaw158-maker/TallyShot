interface Env {
  ANTHROPIC_API_KEY: string;
}

interface RequestBody {
  image_base64: string;
  media_type: string;
  system_prompt: string;
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

    let body: RequestBody;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400, headers: CORS_HEADERS });
    }

    if (!body.image_base64 || !body.media_type || !body.system_prompt) {
      return new Response('Missing required fields', { status: 400, headers: CORS_HEADERS });
    }

    // Validate media type to prevent abuse
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(body.media_type)) {
      return new Response('Invalid media type', { status: 400, headers: CORS_HEADERS });
    }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
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
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: body.media_type,
                  data: body.image_base64,
                },
              },
              {
                type: 'text',
                text: 'Extract the receipt data and return as JSON.',
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const err = await anthropicResponse.text();
      console.error('Anthropic error:', err);
      return new Response(`Anthropic API error: ${anthropicResponse.status}`, {
        status: 502,
        headers: CORS_HEADERS,
      });
    }

    const data = await anthropicResponse.json() as any;
    const content = data.content?.[0]?.text ?? '';

    // Strip markdown code fences if Claude wraps the JSON
    const cleaned = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    return new Response(JSON.stringify({ content: cleaned }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  },
};
