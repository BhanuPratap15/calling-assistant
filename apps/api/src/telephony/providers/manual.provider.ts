import { NotFoundException } from '@nestjs/common';
import type {
  NormalizedCallEvent,
  StartCallInput,
  StartCallResult,
  TelephonyProvider,
} from '../telephony.types.js';

/**
 * Default (koi provider integrate nahi): CRM sirf `tel:` link deta hai — mobile / softphone dial karta hai.
 * Har attempt phir bhi record hota hai (kisne, kab, kis number pe). Webhooks nahi.
 */
export class ManualProvider implements TelephonyProvider {
  readonly name = 'manual';
  readonly mode = 'manual' as const;
  readonly initialStatus = 'DIALED' as const;

  startCall(input: StartCallInput): Promise<StartCallResult> {
    return Promise.resolve({ dialUrl: `tel:${input.to}` });
  }

  parseWebhook(): NormalizedCallEvent[] {
    throw new NotFoundException('Manual provider does not receive webhooks');
  }
}
