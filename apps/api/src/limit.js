// Per-IP limit through the Rate Limiting binding (10 / 60 s, set in wrangler.toml). The IP is hashed; never stored or logged.
// A limiter error lets the request through: the limit is protection, not a gate.
export async function allowed(env, request) {
  if (!env.LIMITER) return true;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
    const key = [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return (await env.LIMITER.limit({ key })).success;
  } catch {
    console.error('limiter failed');
    return true;
  }
}
