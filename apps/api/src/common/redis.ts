/** REDIS_URL ("redis://:pass@host:6380/0", ya TLS ke liye "rediss://…") → BullMQ connection options */
export function redisConnection(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username || undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: u.pathname.length > 1 ? Number(u.pathname.slice(1)) : 0,
    // rediss:// = TLS (Upstash jaise managed Redis ke liye zaroori)
    ...(u.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}
