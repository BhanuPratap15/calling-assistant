import { randomUUID } from 'node:crypto';
import type {
  NormalizedCallEvent,
  StartCallInput,
  StartCallResult,
  TelephonyProvider,
  WebhookRequest,
} from '../telephony.types.js';
import { parseSignedJson } from './signed-json.js';

/**
 * Nakli provider — asli jaisa: call ID deta hai, events signed webhook se aate hain.
 * Dev / demo / tests ke liye (telecalling.ai docs aane tak poora flow check ho sake).
 * TELEPHONY_MOCK_AUTOPLAY=true → TelephonyService khud ringing → answered → completed → recording chalata hai.
 */
export class MockProvider implements TelephonyProvider {
  readonly name = 'mock';
  readonly mode = 'api' as const;
  readonly initialStatus = 'INITIATED' as const;

  constructor(private readonly webhookSecret: string | undefined) {}

  startCall(_input: StartCallInput): Promise<StartCallResult> {
    return Promise.resolve({ providerCallId: `mock-${randomUUID()}` });
  }

  parseWebhook(req: WebhookRequest): NormalizedCallEvent[] {
    return parseSignedJson(req, this.webhookSecret);
  }
}
