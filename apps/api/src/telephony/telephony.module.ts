import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ManualProvider } from './providers/manual.provider.js';
import { MockProvider } from './providers/mock.provider.js';
import { TelephonyController } from './telephony.controller.js';
import { TelephonyService } from './telephony.service.js';
import {
  TELEPHONY_PROVIDER,
  type TelephonyProvider,
} from './telephony.types.js';

/**
 * Provider env se choose hota hai: TELEPHONY_PROVIDER = manual (default) | mock
 * telecalling.ai ke docs aane pe: providers/telecalling.provider.ts + yahan ek `case` — baaki CRM same.
 */
export function createProvider(config: ConfigService): TelephonyProvider {
  const name = config.get<string>('TELEPHONY_PROVIDER', 'manual');
  switch (name) {
    case 'manual':
      return new ManualProvider(externalDialerUrl(config));
    case 'mock':
      return new MockProvider(config.get<string>('TELEPHONY_WEBHOOK_SECRET'));
    default:
      // Galat config pe app start hi na ho (silently "manual" pe chalna confusing hota)
      throw new Error(
        `Unknown TELEPHONY_PROVIDER "${name}" (use: manual, mock)`,
      );
  }
}

/** TELEPHONY_EXTERNAL_DIALER_URL: sirf https (UI me link banta hai — javascript: / http: nahi) */
function externalDialerUrl(config: ConfigService): string | undefined {
  const raw = config.get<string>('TELEPHONY_EXTERNAL_DIALER_URL')?.trim();
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      `TELEPHONY_EXTERNAL_DIALER_URL is not a valid URL: "${raw}"`,
    );
  }
  if (url.protocol !== 'https:')
    throw new Error('TELEPHONY_EXTERNAL_DIALER_URL must start with https://');
  return url.toString();
}

@Module({
  controllers: [TelephonyController],
  providers: [
    TelephonyService,
    {
      provide: TELEPHONY_PROVIDER,
      inject: [ConfigService],
      useFactory: createProvider,
    },
  ],
  exports: [TelephonyService],
})
export class TelephonyModule {}
