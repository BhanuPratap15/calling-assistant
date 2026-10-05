/**
 * Login brute-force se bachav: ek (IP + email) pe `maxFailures` galat password `windowMs` me
 * → us combination pe login band (429) jab tak window khatam na ho. Sahi login → counter reset.
 *
 * Email exist kare ya na kare — same behaviour (attacker ko pata na chale kaunsa email asli hai).
 * Memory me (ek API server). Kai servers ho to Redis store chahiye (docs/RUNBOOK.md).
 */
export class LoginLimiter {
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly maxFailures: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
    private readonly maxPerIp = maxFailures * 6, // ek IP se saare emails mila ke (password spraying)
  ) {}

  private limitFor(scope: 'email' | 'ip') {
    return scope === 'ip' ? this.maxPerIp : this.maxFailures;
  }

  private key(ip: string, email: string) {
    return `${ip}|${email.trim().toLowerCase()}`;
  }

  private recent(key: string): number[] {
    const cutoff = this.now() - this.windowMs;
    const list = (this.failures.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length) this.failures.set(key, list);
    else this.failures.delete(key);
    return list;
  }

  /** null = login try kar sakte ho; number = itne ms baad */
  retryAfterMs(
    ip: string,
    email: string,
    scope: 'email' | 'ip' = 'email',
  ): number | null {
    const list = this.recent(this.key(ip, email));
    const limit = this.limitFor(scope);
    if (list.length < limit) return null;
    return list[list.length - limit] + this.windowMs - this.now();
  }

  fail(ip: string, email: string, _scope: 'email' | 'ip' = 'email') {
    const key = this.key(ip, email);
    this.failures.set(key, [...this.recent(key), this.now()]);
    // Memory na bhare: bahut saare keys ho gaye to purane saaf
    if (this.failures.size > 50_000)
      for (const k of [...this.failures.keys()].slice(0, 10_000))
        this.recent(k);
  }

  succeed(ip: string, email: string) {
    this.failures.delete(this.key(ip, email));
  }
}
