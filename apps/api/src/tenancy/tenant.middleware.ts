import type { NextFunction, Request, Response } from 'express';
import { enterOrg, enterUnscoped } from './tenant-context.js';
import type { TenantResolver } from './tenant-resolver.service.js';
import { requestHost, type TenantRequest } from './tenant.types.js';

/** Inn routes pe client (tenant) nahi hota */
const isPlatformPath = (p: string) =>
  p === '/api/platform' || p.startsWith('/api/platform/');
/** Host pe chalne wali sync script (127.0.0.1 se) — apna X-Sync-Token guard; PLATFORM_HOSTS nahi lagta */
const isDomainSyncPath = (p: string) =>
  p.startsWith('/api/platform/domain-sync/');
const isUnscopedPath = (p: string) =>
  p === '/api/health' || p.startsWith('/api/telephony/webhooks/');

/**
 * Har /api request: Host → client. Phir poori request us client ke context me chalti hai
 * (tenant extension har query me organizationId lagata hai).
 *
 *   /api/platform/*            → platform panel (saare clients) — PLATFORM_HOSTS se limit
 *   /api/health, webhooks      → bina client (webhook khud session ka client dhoondhta hai)
 *   baaki                      → client nahi mila = 404, suspended = 403 (branding chhod ke)
 */
export function tenantMiddleware(
  resolver: TenantResolver,
  platformHosts: string[],
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path;
    if (!path.startsWith('/api/') && path !== '/api') return next();

    const host = requestHost(req);
    if (isPlatformPath(path)) {
      if (
        platformHosts.length &&
        !platformHosts.includes(host) &&
        !isDomainSyncPath(path)
      ) {
        res.status(404).json({ statusCode: 404, message: 'Not Found' });
        return;
      }
      return enterUnscoped(next);
    }
    if (isUnscopedPath(path)) return enterUnscoped(next);

    resolver.resolve(host).then((tenant) => {
      if (!tenant) {
        res.status(404).json({
          statusCode: 404,
          code: 'WORKSPACE_NOT_FOUND',
          message: 'No workspace is set up for this web address',
        });
        return;
      }
      (req as TenantRequest).tenant = tenant;
      if (tenant.status !== 'ACTIVE' && path !== '/api/branding') {
        res.status(403).json({
          statusCode: 403,
          code: 'WORKSPACE_SUSPENDED',
          message: 'This workspace is suspended — please contact support',
        });
        return;
      }
      enterOrg(tenant.id, next);
    }, next);
  };
}
