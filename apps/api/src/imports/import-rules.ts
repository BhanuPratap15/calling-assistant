import { normalizePhone } from '../common/phone.js';
import type { Priority } from '../generated/prisma/enums.js';

/**
 * Bulk import rules — PURE functions (unit tests: import-rules.spec.ts)
 * File ka koi bhi header naam chalega jo yahan alias me hai ("Mobile", "Phone Number", "User ID"...).
 */

export const IMPORT_FIELDS = [
  'name',
  'phone',
  'alternatePhone',
  'email',
  'externalId',
  'priority',
  'notes',
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export const REQUIRED_FIELDS: ImportField[] = ['name', 'phone'];

// Header ko normalize karke (lowercase, sirf a-z0-9) in aliases se match
const ALIASES: Record<ImportField, string[]> = {
  name: ['name', 'fullname', 'customername', 'username', 'customer'],
  phone: [
    'phone',
    'phonenumber',
    'mobile',
    'mobilenumber',
    'mobileno',
    'contact',
    'contactnumber',
    'number',
  ],
  alternatePhone: [
    'alternatephone',
    'altphone',
    'alternatemobile',
    'alternatenumber',
    'phone2',
    'mobile2',
    'secondaryphone',
  ],
  email: ['email', 'emailid', 'emailaddress', 'mail'],
  externalId: ['externalid', 'userid', 'platformid', 'playerid', 'customerid'],
  priority: ['priority'],
  notes: ['notes', 'note', 'remarks', 'remark', 'comments', 'comment'],
};

export const MAX_LENGTH: Partial<Record<ImportField, number>> = {
  name: 200,
  externalId: 100,
  email: 200,
  notes: 2000,
};

const PRIORITIES: Priority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeHeader = (h: string) =>
  h.toLowerCase().replace(/[^a-z0-9]/g, '');

export interface HeaderMapping {
  /** column index → field */
  columns: Map<number, ImportField>;
  missing: ImportField[]; // required jo nahi mile
  ignored: string[]; // file ke extra columns (import nahi honge)
  duplicates: string[]; // ek hi field ke do columns
}

export function mapHeaders(headers: string[]): HeaderMapping {
  const columns = new Map<number, ImportField>();
  const used = new Set<ImportField>();
  const ignored: string[] = [];
  const duplicates: string[] = [];
  headers.forEach((header, index) => {
    const key = normalizeHeader(header);
    if (!key) return;
    const field = IMPORT_FIELDS.find((f) => ALIASES[f].includes(key));
    if (!field) ignored.push(header);
    else if (used.has(field)) duplicates.push(header);
    else {
      used.add(field);
      columns.set(index, field);
    }
  });
  return {
    columns,
    missing: REQUIRED_FIELDS.filter((f) => !used.has(f)),
    ignored,
    duplicates,
  };
}

/** Normalized values — inhi se customer banta hai */
export interface ImportData {
  name: string;
  phone: string; // E.164
  alternatePhone?: string;
  email?: string;
  externalId?: string;
  priority?: Priority;
  notes?: string;
}

export type RawRow = Partial<Record<ImportField, string>>;

/** Ek line ko check + normalize. errors khaali = valid. */
export function validateRow(raw: RawRow): {
  data: ImportData | null;
  errors: string[];
} {
  const errors: string[] = [];
  const v = (f: ImportField) => (raw[f] ?? '').trim();

  for (const f of REQUIRED_FIELDS) if (!v(f)) errors.push(`${f} is required`);
  for (const [f, max] of Object.entries(MAX_LENGTH) as [
    ImportField,
    number,
  ][]) {
    if (v(f).length > max) errors.push(`${f} is too long (max ${max})`);
  }

  const phone = v('phone') ? normalizePhone(v('phone')) : null;
  if (v('phone') && !phone)
    errors.push(`phone "${v('phone')}" is not a valid number`);

  const alternatePhone = v('alternatePhone')
    ? normalizePhone(v('alternatePhone'))
    : null;
  if (v('alternatePhone') && !alternatePhone)
    errors.push(
      `alternatePhone "${v('alternatePhone')}" is not a valid number`,
    );

  const email = v('email').toLowerCase();
  if (email && !EMAIL_RULE.test(email))
    errors.push(`email "${v('email')}" is not valid`);

  const priority = v('priority').toUpperCase();
  if (priority && !PRIORITIES.includes(priority as Priority))
    errors.push(`priority must be one of ${PRIORITIES.join(', ')}`);

  if (errors.length) return { data: null, errors };
  return {
    data: {
      name: v('name'),
      phone: phone!,
      alternatePhone: alternatePhone ?? undefined,
      email: email || undefined,
      externalId: v('externalId') || undefined,
      priority: (priority as Priority) || undefined,
      notes: v('notes') || undefined,
    },
    errors: [],
  };
}

export type CheckedStatus = 'VALID' | 'INVALID' | 'DUPLICATE';

export interface CheckedRow {
  rowNumber: number;
  raw: RawRow;
  data: ImportData | null;
  status: CheckedStatus;
  errors: string[];
  customerId?: string; // DUPLICATE (DB se) — kis customer se match hua
}

/** Pehle se DB me kaun hai (phone / externalId → customer) */
export interface ExistingLookup {
  byPhone: Map<string, { id: string; name: string }>;
  byExternalId: Map<string, { id: string; name: string }>;
}

/**
 * Saari lines: validate → file ke andar duplicate → DB me pehle se?
 * Same phone 2 baar file me → pehli VALID, baaki DUPLICATE ("same as row N").
 */
export function checkRows(
  rows: { rowNumber: number; raw: RawRow }[],
  existing: ExistingLookup,
): CheckedRow[] {
  const seenPhone = new Map<string, number>();
  const seenExternal = new Map<string, number>();

  return rows.map(({ rowNumber, raw }) => {
    const { data, errors } = validateRow(raw);
    if (!data) return { rowNumber, raw, data: null, status: 'INVALID', errors };

    const dup = (reason: string, customerId?: string): CheckedRow => ({
      rowNumber,
      raw,
      data: null,
      status: 'DUPLICATE',
      errors: [reason],
      customerId,
    });

    const phoneRow = seenPhone.get(data.phone);
    if (phoneRow) return dup(`Same phone as row ${phoneRow}`);
    const extRow = data.externalId
      ? seenExternal.get(data.externalId)
      : undefined;
    if (extRow) return dup(`Same externalId as row ${extRow}`);

    const inDbPhone = existing.byPhone.get(data.phone);
    if (inDbPhone)
      return dup(`Phone already exists (${inDbPhone.name})`, inDbPhone.id);
    const inDbExt = data.externalId
      ? existing.byExternalId.get(data.externalId)
      : undefined;
    if (inDbExt)
      return dup(`externalId already exists (${inDbExt.name})`, inDbExt.id);

    seenPhone.set(data.phone, rowNumber);
    if (data.externalId) seenExternal.set(data.externalId, rowNumber);
    return { rowNumber, raw, data, status: 'VALID', errors: [] };
  });
}

/** Error report CSV ke liye: ek value ko CSV-safe banao (comma / quote / newline) */
export function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  // Excel formula injection se bachav ("=HYPERLINK(...)") — aage ' laga do.
  // "+91..." / "-5" jaise number safe hain (digit se pehle +/-), unhe nahi chhedte.
  const safe = /^[=@\t\r]|^[+-][^\d\s]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
