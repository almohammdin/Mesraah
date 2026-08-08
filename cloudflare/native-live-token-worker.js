const ALLOWED_ORIGIN = 'https://almohammdin.github.io';
const PROJECT_NUMBER = '986043593957';
const APP_ID = '1:986043593957:web:b848313ef8cf83a5f3500c';
const MODEL = 'gemini-3.1-flash-live-preview';
const JWKS_URL = 'https://firebaseappcheck.googleapis.com/v1/jwks';
const TOKEN_URL = 'https://generativelanguage.googleapis.com/v1alpha/auth_tokens';

let jwksCache = null;
let jwksCachedAt = 0;

function cors(origin = ALLOWED_ORIGIN) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Firebase-AppCheck',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(body, status = 200, origin = ALLOWED_ORIGIN) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin) }
  });
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlToJson(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
}

async function getJwks() {
  const now = Date.now();
  if (jwksCache && now - jwksCachedAt < 6 * 60 * 60 * 1000) return jwksCache;
  const response = await fetch(JWKS_URL, { cf: { cacheTtl: 21600, cacheEverything: true } });
  if (!response.ok) throw new Error(`jwks-${response.status}`);
  jwksCache = await response.json();
  jwksCachedAt = now;
  return jwksCache;
}

async function verifyAppCheck(token) {
  if (!token) throw new Error('missing-app-check');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('invalid-app-check-format');

  const header = base64UrlToJson(parts[0]);
  const payload = base64UrlToJson(parts[1]);
  if (header.alg !== 'RS256' || header.typ !== 'JWT' || !header.kid) throw new Error('invalid-app-check-header');

  const jwks = await getJwks();
  const jwk = (jwks.keys || []).find(key => key.kid === header.kid);
  if (!jwk) throw new Error('unknown-app-check-key');

  const publicKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlToBytes(parts[2]);
  const validSignature = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, signed);
  if (!validSignature) throw new Error('invalid-app-check-signature');

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://firebaseappcheck.googleapis.com/${PROJECT_NUMBER}`;
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.iss !== expectedIssuer) throw new Error('invalid-app-check-issuer');
  if (!audiences.includes(`projects/${PROJECT_NUMBER}`)) throw new Error('invalid-app-check-audience');
  if (!payload.exp || payload.exp <= nowSeconds) throw new Error('expired-app-check');
  if (payload.sub !== APP_ID) throw new Error('invalid-app-check-app');
  return payload;
}

async function createEphemeralToken(apiKey) {
  const now = Date.now();
  const authToken = {
    uses: 1,
    expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
    newSessionExpireTime: new Date(now + 60 * 1000).toISOString()
  };

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ authToken })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.name) {
    const error = new Error(data?.error?.message || `gemini-token-${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      if (origin !== ALLOWED_ORIGIN) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    if (origin !== ALLOWED_ORIGIN) return json({ error: 'origin-not-allowed' }, 403, ALLOWED_ORIGIN);

    const url = new URL(request.url);
    if (url.pathname !== '/token' || request.method !== 'POST') return json({ error: 'not-found' }, 404, origin);
    if (!env.GEMINI_API_KEY) return json({ error: 'server-not-configured' }, 503, origin);

    try {
      await verifyAppCheck(request.headers.get('X-Firebase-AppCheck') || '');
      const token = await createEphemeralToken(env.GEMINI_API_KEY);
      return json({ token: token.name, model: MODEL, apiVersion: 'v1alpha' }, 200, origin);
    } catch (error) {
      console.error('Mesraah native live token:', error);
      const message = String(error?.message || 'token-error');
      const authFailure = /app-check|issuer|audience|signature|expired|unknown-app/.test(message);
      return json({
        error: authFailure ? 'app-check-rejected' : 'token-creation-failed',
        detail: message.slice(0, 240)
      }, authFailure ? 401 : 502, origin);
    }
  }
};
