import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { requestLogger } from './request-logger.js';

function fake(url: string, headers: Record<string, string> = {}) {
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200,
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) {
      this.headers[k] = v;
    },
  });
  const req = {
    method: 'GET',
    originalUrl: url,
    ip: '1.2.3.4',
    header: (h: string) => headers[h],
    user: { id: 'u1' },
  };
  return {
    req: req as unknown as Request,
    res: res as unknown as Response &
      EventEmitter & { headers: Record<string, string> },
  };
}

describe('requestLogger', () => {
  const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  beforeEach(() => vi.clearAllMocks());

  it('logs method, path WITHOUT query (PII), status, user and a request id', () => {
    const { req, res } = fake('/api/customers?search=Rahul%209876543210');
    const next = vi.fn();
    requestLogger(logger)(req, res, next);
    expect(next).toHaveBeenCalled();
    res.emit('finish');
    const line = logger.log.mock.calls[0][0] as string;
    expect(line).toMatch(
      /^GET \/api\/customers 200 [\d.]+ms user=u1 ip=1\.2\.3\.4 req=[0-9a-f-]{36}$/,
    );
    expect(line).not.toContain('Rahul');
    expect(res.headers['X-Request-Id']).toBe(line.split('req=')[1]);
  });

  it('reuses a safe incoming X-Request-Id, rejects junk; 4xx warn, 5xx error; skips health', () => {
    const a = fake('/api/x', { 'x-request-id': 'abc-123' });
    requestLogger(logger)(a.req, a.res, vi.fn());
    a.res.statusCode = 404;
    a.res.emit('finish');
    expect(logger.warn.mock.calls[0][0]).toContain('req=abc-123');

    const b = fake('/api/x', { 'x-request-id': 'bad id\nINJECT' });
    requestLogger(logger)(b.req, b.res, vi.fn());
    b.res.statusCode = 500;
    b.res.emit('finish');
    expect(logger.error.mock.calls[0][0]).not.toContain('INJECT');

    const h = fake('/api/health');
    requestLogger(logger)(h.req, h.res, vi.fn());
    h.res.emit('finish');
    expect(logger.log).not.toHaveBeenCalled();
  });
});
