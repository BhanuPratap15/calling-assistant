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
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {empty ? (
            <tr>
              <td
                colSpan={headers.length}
                className="px-4 py-10 text-center text-slate-400"
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
    <td className={`px-4 py-2.5 align-top text-slate-700 ${className}`}>
      {children}
    </td>
  );
}
