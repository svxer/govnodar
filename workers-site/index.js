import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

addEventListener('fetch', event => {
  try {
    event.respondWith(handleEvent(event));
  } catch (e) {
    event.respondWith(new Response('Internal Error', { status: 500 }));
  }
});

async function handleEvent(event) {
  const { request } = event;
  const url = new URL(request.url);

  if (url.pathname === '/slime-click') {
    return handleSlimeClick(request);
  }

  return getAssetFromKV(event);
}

async function handleSlimeClick(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const ip =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('x-forwarded-for') ||
    'unknown';
  const country = request.cf?.country || 'unknown';
  const colo = request.cf?.colo || 'unknown';
  const city = request.cf?.city || 'unknown';
  const time = new Date().toISOString();

  const lines = [
    'slime clicked',
    `time: ${time}`,
    `ip: ${ip}`,
    `country: ${country}`,
    `city: ${city}`,
    `colo: ${colo}`,
    `timezone: ${body.timezone || 'unknown'}`,
    `language: ${body.language || 'unknown'}`,
    `screen: ${body.screen || 'unknown'}`,
    `page: ${body.page || 'unknown'}`,
    `user agent: ${body.userAgent || 'unknown'}`,
  ];

  const webhookUrl = webhook_url;
  if (!webhookUrl) {
    return jsonResponse({ error: 'Webhook secret is missing' }, 500);
  }

  const webhookResponse = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      content: `\`\`\`\n${lines.join('\n')}\n\`\`\``,
    }),
  });

  if (!webhookResponse.ok) {
    return jsonResponse({ error: 'Webhook request failed' }, 502);
  }

  return jsonResponse({ ok: true });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      ...corsHeaders(),
    },
  });
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
