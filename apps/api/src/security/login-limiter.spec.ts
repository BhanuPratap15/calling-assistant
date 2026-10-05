import { LoginLimiter } from './login-limiter.js';

describe('LoginLimiter', () => {
  const MIN = 60_000;
  let now = 0;
  const limiter = () => new LoginLimiter(3, 15 * MIN, () => now);

  it('blocks after N failures for the same IP + email, until the window passes', () => {
    now = 0;
    const l = limiter();
    for (let i = 0; i < 3; i++) {
      expect(l.retryAfterMs('1.1.1.1', 'a@x.com')).toBeNull();
      l.fail('1.1.1.1', 'A@X.com '); // case / space normalize
      now += MIN;
    }
    expect(l.retryAfterMs('1.1.1.1', 'a@x.com')).toBe(12 * MIN); // pehli failure + 15 min
    // doosra email / doosra IP — alag counter
    expect(l.retryAfterMs('1.1.1.1', 'b@x.com')).toBeNull();
    expect(l.retryAfterMs('2.2.2.2', 'a@x.com')).toBeNull();
    now = 15 * MIN + 1; // pehli failure window se bahar → 2 hi bachi
    expect(l.retryAfterMs('1.1.1.1', 'a@x.com')).toBeNull();
  });

  it('successful login resets the counter', () => {
    now = 0;
    const l = limiter();
    l.fail('ip', 'a@x.com');
    l.fail('ip', 'a@x.com');
    l.succeed('ip', 'a@x.com');
    l.fail('ip', 'a@x.com');
    l.fail('ip', 'a@x.com');
    expect(l.retryAfterMs('ip', 'a@x.com')).toBeNull();
  });

  it('IP-level limit catches password spraying across many emails', () => {
    now = 0;
    const l = new LoginLimiter(5, 15 * MIN, () => now, 3);
    for (const e of ['a@x', 'b@x', 'c@x']) {
      l.fail('ip', e);
      l.fail('ip', '*', 'ip');
    }
    expect(l.retryAfterMs('ip', 'd@x')).toBeNull(); // naya email apne aap me theek
    expect(l.retryAfterMs('ip', '*', 'ip')).toBe(15 * MIN); // par IP band
  });
});
