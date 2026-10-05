import type { CallSessionStatus } from './types';

/** Backend telephony-rules.ts jaisa: ye status = call abhi chal rahi hai */
export const LIVE_STATUSES: CallSessionStatus[] = [
  'INITIATED',
  'RINGING',
  'ANSWERED',
];

export const SESSION_LABEL: Record<CallSessionStatus, string> = {
  DIALED: 'Dialed (phone)',
  INITIATED: 'Connecting…',
  RINGING: 'Ringing…',
  ANSWERED: 'Connected',
  COMPLETED: 'Completed',
  NO_ANSWER: 'No answer',
  BUSY: 'Busy',
  FAILED: 'Failed',
  CANCELED: 'Canceled',
};

export const SESSION_TONE = {
  DIALED: 'gray',
  INITIATED: 'blue',
  RINGING: 'blue',
  ANSWERED: 'green',
  COMPLETED: 'green',
  NO_ANSWER: 'yellow',
  BUSY: 'yellow',
  FAILED: 'red',
  CANCELED: 'gray',
} as const satisfies Record<CallSessionStatus, string>;

/** 125 → "2:05" */
export function formatDuration(sec: number | null | undefined): string {
  if (sec === null || sec === undefined) return '—';
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, '0')}`;
}
