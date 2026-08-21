const memory = new Map();

export async function remember(key, ttlMs, producer) {
  const now = Date.now();
  const current = memory.get(key);

  if (current && current.expiresAt > now) {
    return { value: current.value, cached: true };
  }

  const value = await producer();
  memory.set(key, { value, expiresAt: now + ttlMs });
  return { value, cached: false };
}
