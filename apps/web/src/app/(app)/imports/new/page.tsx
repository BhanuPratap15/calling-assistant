'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { Table, Td } from '@/components/ui/table';
import { api } from '@/lib/api';
import { downloadTemplate, IMPORT_COLUMNS, MAX_FILE_MB } from '@/lib/import';
import type { ImportBatch } from '@/lib/types';

/**
 * Step 1: file chuno → upload. Server check karke PREVIEW banata hai (abhi customers NAHI bante).
 * Step 2-3 (/imports/<id>): preview → confirm → progress → result.
 */
export default function NewImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File ${MAX_FILE_MB} MB se badi hai — chhote hisson me baanto`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const batch = await api<ImportBatch>('/imports', {
        method: 'POST',
        body: form,
      });
      router.push(`/imports/${batch.id}`);
    } catch (err) {
      setError((err as Error).message);
      setUploading(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <Link href="/imports" className="text-sm text-indigo-600 hover:underline">
        ← Import history
      </Link>
      <div className="mt-3" />
      <PageHeader
        title="New import"
        description="Step 1 of 3 — file upload → preview → import"
      />

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
      >
        <label
          htmlFor="import-file"
          className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-6 py-10 text-center hover:border-indigo-400 hover:bg-indigo-50/40"
        >
          <span className="text-3xl">📄</span>
          <span className="text-sm font-medium text-slate-800">
            {file ? file.name : 'CSV ya Excel (.xlsx) file chuniye'}
          </span>
          <span className="text-xs text-slate-500">
            {file
              ? `${(file.size / 1024).toFixed(0)} KB`
              : `Max ${MAX_FILE_MB} MB · 50,000 rows · pehli sheet padhi jaati hai`}
          </span>
          <input
            id="import-file"
            type="file"
            accept=".csv,.xlsx"
            className="sr-only"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
            }}
          />
        </label>
        <ErrorMessage message={error} />
        <div className="flex items-center justify-between">
          <Button variant="secondary" onClick={downloadTemplate}>
            ⬇ Download template
          </Button>
          <Button type="submit" disabled={!file || uploading}>
            {uploading ? 'Checking file…' : 'Upload & preview →'}
          </Button>
        </div>
      </form>

      <h2 className="mb-2 mt-6 font-semibold text-slate-900">Columns</h2>
      <p className="mb-3 text-sm text-slate-600">
        Pehli line = headers. Order kuch bhi ho; extra columns (e.g. City)
        ignore hote hain. Same phone (file me ya pehle se CRM me) = duplicate,
        import nahi hoga.
      </p>
      <Table headers={['Column', 'Required', 'Ye naam bhi chalenge']}>
        {IMPORT_COLUMNS.map((c) => (
          <tr key={c.column}>
            <Td className="font-mono text-xs">{c.column}</Td>
            <Td>{c.required ? 'Yes' : '—'}</Td>
            <Td className="text-xs text-slate-500">{c.also}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
