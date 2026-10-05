/** CSV ka ek cell — comma / quote / newline safe + Excel formula injection se bachav */
export function csvCell(value: unknown): string {
  const s =
    value === null || value === undefined
      ? ''
      : value instanceof Date
        ? value.toISOString()
        : String(value);
  // "=HYPERLINK(...)" jaisa cell Excel formula chala deta hai — aage ' laga do.
  // "+91..." / "-5" jaise number safe hain (digit se pehle +/-), unhe nahi chhedte.
  const safe = /^[=@\t\r]|^[+-][^\d\s]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** rows → CSV text (Excel ke liye BOM ke saath, CRLF lines) */
export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}
