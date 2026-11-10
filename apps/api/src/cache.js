// KV is only a cache. A KV error (read, or write limit reached) never fails the request: answer without cache.
export const TTL = { profile: 3600, mojang: 86400 };

export async function cached(env, key, ttl, produce) {
  let hit = null;
  try {
    if (env.CACHE) hit = await env.CACHE.get(key);
  } catch {
    console.error('kv get failed');
  }
  if (hit !== null && hit !== undefined) return { value: hit, hit: true };
  const value = await produce();
  try {
    if (env.CACHE) await env.CACHE.put(key, value, { expirationTtl: ttl });
  } catch {
    console.error('kv put failed');
  }
  return { value, hit: false };
}

// Keys: lowercase, no spaces. Only the id parts that the lookup needs.
export const keys = {
  mojang: (name) => `mojang:${name.toLowerCase()}`,
  profiles: (uuid) => `profiles:${uuid}`,
  profile: (uuid, profileId) => `profile:${uuid}:${profileId}`,
};
