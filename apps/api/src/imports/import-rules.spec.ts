import ExcelJS from 'exceljs';
import { ImportFileError, parseImportFile } from './import-parser.js';
import {
  checkRows,
  csvCell,
  mapHeaders,
  validateRow,
  type ExistingLookup,
} from './import-rules.js';

const none: ExistingLookup = { byPhone: new Map(), byExternalId: new Map() };

describe('mapHeaders', () => {
  it('matches aliases case/space-insensitively', () => {
    const m = mapHeaders([
      'Full Name',
      'Mobile No',
      'E-mail',
      'User ID',
      'Remarks',
      'City',
    ]);
    expect([...m.columns.entries()]).toEqual([
      [0, 'name'],
      [1, 'phone'],
      [2, 'email'],
      [3, 'externalId'],
      [4, 'notes'],
    ]);
    expect(m.missing).toEqual([]);
    expect(m.ignored).toEqual(['City']);
  });

  it('reports missing required columns and duplicate columns', () => {
    const m = mapHeaders(['email', 'phone', 'mobile']);
    expect(m.missing).toEqual(['name']);
    expect(m.duplicates).toEqual(['mobile']);
  });
});

describe('validateRow', () => {
  it('normalizes a valid row', () => {
    const r = validateRow({
      name: ' Rahul ',
      phone: '98765 43210',
      email: 'RAHUL@X.COM',
      priority: 'high',
      externalId: '',
    });
    expect(r.errors).toEqual([]);
    expect(r.data).toEqual({
      name: 'Rahul',
      phone: '+919876543210',
      email: 'rahul@x.com',
      priority: 'HIGH',
      alternatePhone: undefined,
      externalId: undefined,
      notes: undefined,
    });
  });

  it('collects every problem', () => {
    const r = validateRow({
      name: '',
      phone: '123',
      alternatePhone: 'abc',
      email: 'nope',
      priority: 'VIP',
    });
    expect(r.data).toBeNull();
    expect(r.errors).toEqual([
      'name is required',
      'phone "123" is not a valid number',
      'alternatePhone "abc" is not a valid number',
      'email "nope" is not valid',
      'priority must be one of LOW, NORMAL, HIGH, URGENT',
    ]);
  });

  it('enforces max lengths', () => {
    const r = validateRow({ name: 'x'.repeat(201), phone: '9876543210' });
    expect(r.errors).toEqual(['name is too long (max 200)']);
  });
});

describe('checkRows', () => {
  it('marks duplicates inside the file (same number written differently)', () => {
    const rows = checkRows(
      [
        {
          rowNumber: 2,
          raw: { name: 'A', phone: '9876543210', externalId: 'U1' },
        },
        { rowNumber: 3, raw: { name: 'B', phone: '+91-98765-43210' } },
        {
          rowNumber: 4,
          raw: { name: 'C', phone: '9876543211', externalId: 'U1' },
        },
        { rowNumber: 5, raw: { name: '', phone: '9876543212' } },
      ],
      none,
    );
    expect(rows.map((r) => r.status)).toEqual([
      'VALID',
      'DUPLICATE',
      'DUPLICATE',
      'INVALID',
    ]);
    expect(rows[1].errors).toEqual(['Same phone as row 2']);
    expect(rows[2].errors).toEqual(['Same externalId as row 2']);
  });

  it('marks customers that already exist in the database', () => {
    const existing: ExistingLookup = {
      byPhone: new Map([['+919876543210', { id: 'c1', name: 'Old Rahul' }]]),
      byExternalId: new Map([['U9', { id: 'c2', name: 'Old Priya' }]]),
    };
    const rows = checkRows(
      [
        { rowNumber: 2, raw: { name: 'A', phone: '9876543210' } },
        {
          rowNumber: 3,
          raw: { name: 'B', phone: '9876543299', externalId: 'U9' },
        },
      ],
      existing,
    );
    expect(rows[0]).toMatchObject({
      status: 'DUPLICATE',
      customerId: 'c1',
      errors: ['Phone already exists (Old Rahul)'],
    });
    expect(rows[1]).toMatchObject({ status: 'DUPLICATE', customerId: 'c2' });
  });
});

describe('csvCell', () => {
  it('quotes and neutralizes formulas but keeps phone numbers', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+919876543210')).toBe('+919876543210');
    expect(csvCell(null)).toBe('');
  });
});

describe('parseImportFile', () => {
  it('reads CSV with BOM, quotes and blank lines', async () => {
    const csv =
      '\uFEFFname,phone,notes\n"Sharma, Rahul",9876543210,"line ""one"""\n\n,,\n';
    const f = await parseImportFile(Buffer.from(csv), 'users.CSV');
    expect(f.headers).toEqual(['name', 'phone', 'notes']);
    expect(f.rows).toEqual([
      { rowNumber: 2, cells: ['Sharma, Rahul', '9876543210', 'line "one"'] },
    ]);
  });

  it('reads the first Excel sheet, numbers as full digits', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Users');
    ws.addRow(['Name', 'Mobile']);
    ws.addRow(['Priya', 9876543210]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const f = await parseImportFile(buffer, 'users.xlsx');
    expect(f.headers).toEqual(['Name', 'Mobile']);
    expect(f.rows).toEqual([{ rowNumber: 2, cells: ['Priya', '9876543210'] }]);
  });

  it('rejects unsupported / empty / broken files', async () => {
    await expect(parseImportFile(Buffer.from('x'), 'a.xls')).rejects.toThrow(
      ImportFileError,
    );
    await expect(
      parseImportFile(Buffer.from('name,phone\n'), 'a.csv'),
    ).rejects.toThrow('no data rows');
    await expect(
      parseImportFile(Buffer.from('not a zip'), 'a.xlsx'),
    ).rejects.toThrow('Could not read Excel');
  });
});
