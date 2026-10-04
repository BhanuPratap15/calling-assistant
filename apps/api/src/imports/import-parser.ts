import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';

/**
 * Upload hui file → header + rows (sab cells string).
 * CSV: csv-parse (quotes, commas, BOM sab handle). Excel (.xlsx): exceljs — pehli sheet.
 */
export interface ParsedFile {
  headers: string[];
  rows: { rowNumber: number; cells: string[] }[]; // rowNumber = file ki line (header = 1)
}

export class ImportFileError extends Error {}

export const MAX_ROWS = 50_000;

export async function parseImportFile(
  buffer: Buffer,
  fileName: string,
): Promise<ParsedFile> {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'csv') return parseCsv(buffer);
  if (ext === 'xlsx') return parseXlsx(buffer);
  throw new ImportFileError('Only .csv and .xlsx files are supported');
}

function finish(lines: { rowNumber: number; cells: string[] }[]): ParsedFile {
  const [header, ...rest] = lines;
  if (!header) throw new ImportFileError('File is empty');
  // Poori khaali lines (Excel me aksar end me hoti hain) hata do
  const rows = rest.filter((r) => r.cells.some((c) => c.trim() !== ''));
  if (!rows.length)
    throw new ImportFileError('File has a header but no data rows');
  if (rows.length > MAX_ROWS)
    throw new ImportFileError(
      `Too many rows (${rows.length}). Max ${MAX_ROWS} per file`,
    );
  return { headers: header.cells.map((c) => c.trim()), rows };
}

function parseCsv(buffer: Buffer): ParsedFile {
  let records: string[][];
  try {
    records = parse(buffer, {
      bom: true, // Excel "CSV UTF-8" file ke shuru me invisible BOM hota hai
      relax_column_count: true, // kisi line me kam/zyada columns → error nahi, hum khud check karte hain
      skip_empty_lines: true,
      trim: false,
    }) as string[][];
  } catch (e) {
    throw new ImportFileError(`Could not read CSV: ${(e as Error).message}`);
  }
  return finish(records.map((cells, i) => ({ rowNumber: i + 1, cells })));
}

async function parseXlsx(buffer: Buffer): Promise<ParsedFile> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new ImportFileError(
      'Could not read Excel file (is it a valid .xlsx?)',
    );
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ImportFileError('Excel file has no sheets');

  const lines: { rowNumber: number; cells: string[] }[] = [];
  const width = sheet.columnCount;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells: string[] = [];
    for (let c = 1; c <= width; c++) cells.push(cellText(row.getCell(c)));
    lines.push({ rowNumber, cells });
  });
  return finish(lines);
}

/** Excel cell → string. Phone number cell me number ho to "9.87E+09" nahi, poora number. */
function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'number')
    return Number.isInteger(value) ? value.toFixed(0) : String(value);
  if (typeof value === 'string') return value;
  return cell.text ?? ''; // rich text, hyperlink, formula result, date
}
