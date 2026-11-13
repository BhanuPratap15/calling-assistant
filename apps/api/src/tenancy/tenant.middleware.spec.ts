import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { tenantMiddleware } from './tenant.middleware.js';
import type { TenantResolver } from './tenant-resolver.service.js';

function run(path: string, host: string, platformHosts: string[]) {
  const resolver = { resolve: vi.fn() } as unknown as TenantResolver;
  const req = { path, headers: { host } } as unknown as Request;
  const status = vi.fn().mockReturnValue({ json: vi.fn() });
  const res = { status } as unknown as Response;
  const next = vi.fn() as NextFunction;
  tenantMiddleware(resolver, platformHosts)(req, res, next);
  return { status, next };
}

describe('tenantMiddleware — PLATFORM_HOSTS', () => {
  const hosts = ['crm.example.com'];

  it('platform panel API only on allowed hosts', () => {
    expect(
      run('/api/platform/organizations', 'other.com', hosts).status,
    ).toHaveBeenCalledWith(404);
    expect(
      run('/api/platform/organizations', 'crm.example.com', hosts).next,
    ).toHaveBeenCalled();
  });

  it('domain-sync (host cron via 127.0.0.1) is not host-restricted', () => {
    const { status, next } = run(
      '/api/platform/domain-sync/domains',
      '127.0.0.1:4000',
      hosts,
    );
    expect(status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
