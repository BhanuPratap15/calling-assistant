import type { ImportRowStatus, ImportStatus } from './types';

/** Badge colors */
export const IMPORT_STATUS_TONE = {
  PREVIEW: 'yellow',
  QUEUED: 'blue',
  PROCESSING: 'blue',
  COMPLETED: 'green',
  FAILED: 'red',
  CANCELLED: 'gray',
} as const satisfies Record<ImportStatus, string>;

export const ROW_STATUS_TONE = {
  VALID: 'green',
  INVALID: 'red',
  DUPLICATE: 'yellow',
  IMPORTED: 'green',
  SKIPPED: 'gray',
} as const satisfies Record<ImportRowStatus, string>;

/**
 * File ke columns — backend apps/api/src/imports/import-rules.ts (ALIASES) se match.
 * Header naam case / space / "_" se fark nahi padta ("Mobile No" = "mobile_no").
 */
export const IMPORT_COLUMNS = [
  {
    column: 'name',
    required: true,
    also: 'Full Name, Customer Name',
    example: 'Rahul Sharma',
  },
  {
    column: 'phone',
    required: true,
    also: 'Mobile, Phone Number, Contact',
    example: '9876543210',
  },
  {
    column: 'alternate_phone',
    required: false,
    also: 'Alt Phone, Mobile 2',
    example: '',
  },
  {
    column: 'email',
    required: false,
    also: 'Email ID, E-mail',
    example: 'rahul@example.com',
  },
  {
    column: 'external_id',
    required: false,
    also: 'User ID, Player ID, Platform ID',
    example: 'U10234',
  },
  {
    column: 'priority',
    required: false,
    also: 'LOW / NORMAL / HIGH / URGENT',
    example: 'HIGH',
  },
  {
    column: 'notes',
    required: false,
    also: 'Remarks, Comments',
    example: 'Plays daily',
  },
] as const;

/** Khaali template + ek example line (browser me hi banta hai, server call nahi) */
export function downloadTemplate() {
  const header = IMPORT_COLUMNS.map((c) => c.column).join(',');
  const example = IMPORT_COLUMNS.map((c) => c.example).join(',');
  // \uFEFF (BOM) → Excel me UTF-8 sahi khulega
  const blob = new Blob([`\uFEFF${header}\r\n${example}\r\n`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'customers-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export const MAX_FILE_MB = 10;
