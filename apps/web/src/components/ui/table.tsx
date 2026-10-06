import type { ReactNode } from 'react';

/**
 * Simple table:
 *   <Table headers={['Name', 'Email']}>
 *     {rows.map(r => <tr key={r.id}><Td>{r.name}</Td><Td>{r.email}</Td></tr>)}
 *   </Table>
 */
export function Table({
  headers,
  children,
  empty,
}: {
  headers: string[];
  children: ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50/80">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 [&>tr]:transition-colors [&>tr:hover]:bg-slate-50/70">
          {empty ? (
            <tr>
              <td
                colSpan={headers.length}
                className="px-4 py-14 text-center text-sm text-slate-400"
              >
                No records found
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Td({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 align-top text-slate-700 ${className}`}>
      {children}
    </td>
  );
}
