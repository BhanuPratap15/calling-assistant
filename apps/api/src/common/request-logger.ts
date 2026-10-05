import { randomUUID } from 'node:crypto';
import type { LoggerService } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const ID_RE = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Har request ki ek log line: method, path, status, kitne ms, kaun (staff id), request id.
 *  - Query string log NAHI hoti (search me customer naam / phone ho sakta hai — PII)
 *  - X-Request-Id: Nginx / client bheje to wahi, warna naya → response header me wapas
 *    (user error ka screenshot bheje to isi ID se log dhoondo)
 *  - /api/health skip (monitoring har 30s bulata hai — log me shor)
 */
export function requestLogger(logger: LoggerService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.header('x-request-id');
    const requestId =
      incoming && ID_RE.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', requestId);
    const path = req.originalUrl.split('?')[0];
    if (path === '/api/health') return next();

    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const user = (req as Request & { user?: { id: string } }).user?.id ?? '-';
      const line = `${req.method} ${path} ${res.statusCode} ${ms.toFixed(1)}ms user=${user} ip=${req.ip} req=${requestId}`;
      // Context ("HTTP") logger instance me hi hai: new Logger('HTTP')
      if (res.statusCode >= 500) logger.error(line);
      else if (res.statusCode >= 400) logger.warn(line);
      else logger.log(line);
    });
    next();
  };
}
