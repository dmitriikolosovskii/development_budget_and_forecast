import { useMemo, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Download, FileUp, XCircle } from 'lucide-react';
import type { DeliveryImportRow, ImportResult } from '@default-project/types';
import { Badge } from '../../ui/badge';
import { Card, SectionTitle } from '../../ui/card';
import { cx, FOCUS, SOFT } from '../../ui/cx';
import type { ProjectCache } from '../project/project-cache';
import { downloadDeliveryTemplate } from './delivery-template';
import { isPayloadTooLarge, parseDeliveriesCsv } from './parse-deliveries-csv';
import { useImportDeliveries } from './use-deliveries';
import { validateDeliveryRow } from './validate-delivery-row';

const PREVIEW_ROWS = 20;
const COLUMNS: Array<{ key: keyof DeliveryImportRow; label: string }> = [
  { key: 'itemCode', label: 'Item code' },
  { key: 'deliveryNoteNo', label: 'Note no.' },
  { key: 'kind', label: 'Kind' },
  { key: 'date', label: 'Date' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'invoiceAmountEur', label: 'Invoice (EUR)' },
];

/** FileReader works in every browser and in jsdom (Blob.text() does not exist there). */
function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () =>
      reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsText(file, 'utf-8');
  });
}

interface Selected {
  fileName: string;
  rows: DeliveryImportRow[];
  fileError: string | null;
}

export interface ImportPanelProps {
  projectId: string;
  cache: ProjectCache | undefined;
}

export function ImportPanel({ projectId, cache }: ImportPanelProps) {
  const [selected, setSelected] = useState<Selected | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const importer = useImportDeliveries(projectId);

  const knownCodes = useMemo(
    () =>
      cache
        ? new Set(
            cache.items.filter((i) => i.kind === 'MATERIAL').map((i) => i.code),
          )
        : undefined,
    [cache],
  );
  const problems = useMemo(
    () =>
      selected
        ? selected.rows.map((r) => validateDeliveryRow(r, knownCodes))
        : [],
    [selected, knownCodes],
  );
  const invalidRows = problems.filter((p) => Object.keys(p).length > 0).length;

  async function readFile(file: File) {
    importer.reset();
    const parsed = parseDeliveriesCsv(await readText(file));
    const tooLarge =
      !parsed.fileError && isPayloadTooLarge(file.name, parsed.rows);
    setSelected({
      fileName: file.name,
      rows: parsed.rows,
      fileError: tooLarge
        ? 'The file is too large: split it into smaller files'
        : parsed.fileError,
    });
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void readFile(file);
  }

  const canImport =
    !!selected &&
    !selected.fileError &&
    !importer.isPending &&
    projectId !== '';

  return (
    <Card>
      <SectionTitle
        subtitle="CSV from a supplier or the site: itemCode, deliveryNoteNo, kind, date, quantity, invoiceAmountEur"
        actions={
          <button
            type="button"
            onClick={downloadDeliveryTemplate}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-subtle',
              SOFT,
              FOCUS,
            )}
          >
            <Download aria-hidden className="h-4 w-4" />
            Download template
          </button>
        }
      >
        Upload deliveries
      </SectionTitle>

      <div
        data-testid="drop-zone"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx(
          'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center',
          SOFT,
          dragging ? 'border-brand-500 bg-brand-50' : 'border-line bg-canvas',
        )}
      >
        <FileUp aria-hidden className="h-7 w-7 text-brand-500" />
        <p className="text-sm text-ink">Drag a CSV file here or</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cx(
            'rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600',
            SOFT,
            FOCUS,
          )}
        >
          Choose file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          aria-label="CSV file"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void readFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {selected && (
        <div className="mt-4 space-y-3 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink">
              <span className="font-medium">{selected.fileName}</span> ·{' '}
              {selected.rows.length} rows
              {invalidRows > 0 && !selected.fileError && (
                <Badge tone="warn" className="ml-2">
                  {invalidRows} with problems
                </Badge>
              )}
            </p>
            <button
              type="button"
              disabled={!canImport}
              onClick={() =>
                importer.mutate({
                  fileName: selected.fileName,
                  rows: selected.rows,
                })
              }
              className={cx(
                'rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50',
                SOFT,
                FOCUS,
              )}
            >
              {importer.isPending ? 'Importing…' : 'Import'}
            </button>
          </div>
          {selected.fileError ? (
            <p
              role="alert"
              className="rounded-lg bg-risk-50 px-3 py-2 text-sm text-risk-600"
            >
              {selected.fileError}
            </p>
          ) : (
            <Preview rows={selected.rows} problems={problems} />
          )}
          {invalidRows > 0 && !selected.fileError && (
            <p className="text-xs text-muted">
              Rows with problems are reported by the server and skipped; the
              other rows are imported.
            </p>
          )}
        </div>
      )}

      {importer.isError && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-risk-50 px-3 py-2 text-sm text-risk-600"
        >
          Import failed: {importer.error.message}
        </p>
      )}
      {importer.data && (
        <ImportResultView
          result={importer.data}
          projectId={projectId}
          cache={cache}
        />
      )}
    </Card>
  );
}

function Preview({
  rows,
  problems,
}: {
  rows: DeliveryImportRow[];
  problems: Array<Partial<Record<keyof DeliveryImportRow, string>>>;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-sm" aria-label="Preview">
        <thead className="bg-subtle text-left text-xs text-muted">
          <tr>
            <th className="px-3 py-2">Row</th>
            {COLUMNS.map((c) => (
              <th key={c.key} className="px-3 py-2">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, PREVIEW_ROWS).map((row, i) => (
            <tr key={i} className="border-t border-line">
              <td className="px-3 py-1.5 text-muted tabular-nums">{i + 1}</td>
              {COLUMNS.map((c) => {
                const problem = problems[i]?.[c.key];
                return (
                  <td
                    key={c.key}
                    aria-invalid={problem ? true : undefined}
                    title={problem}
                    className={cx(
                      'px-3 py-1.5',
                      problem && 'bg-risk-50 text-risk-600',
                    )}
                  >
                    {row[c.key] || (problem ? '—' : '')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > PREVIEW_ROWS && (
        <p className="border-t border-line px-3 py-1.5 text-xs text-muted">
          Showing the first {PREVIEW_ROWS} of {rows.length} rows.
        </p>
      )}
    </div>
  );
}

function ImportResultView({
  result,
  projectId,
  cache,
}: {
  result: ImportResult;
  projectId: string;
  cache: ProjectCache | undefined;
}) {
  return (
    <div className="mt-4 space-y-3 animate-fade-in" data-testid="import-result">
      <div className="flex flex-wrap gap-3">
        <Badge tone="ok">
          <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
          {result.okRows} imported
        </Badge>
        <Badge tone={result.failedRows ? 'risk' : 'muted'}>
          <XCircle aria-hidden className="h-3.5 w-3.5" />
          {result.failedRows} failed
        </Badge>
        <span className="text-xs text-muted">of {result.totalRows} rows</span>
      </div>

      {result.errors.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm" aria-label="Import errors">
            <thead className="bg-subtle text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2">Row</th>
                <th className="px-3 py-2">Field</th>
                <th className="px-3 py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {result.errors.map((e, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="px-3 py-1.5 tabular-nums">{e.row}</td>
                  <td className="px-3 py-1.5 text-muted">{e.field ?? '—'}</td>
                  <td className="px-3 py-1.5 text-risk-600">{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.updatedItemIds.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Changed items</p>
          <ul className="flex flex-wrap gap-2">
            {result.updatedItemIds.map((id) => {
              const item = cache?.itemsById[id];
              const section = item
                ? cache?.linesById[item.budgetLineId]?.section
                : undefined;
              const href = `/projects/${encodeURIComponent(projectId)}/materials${section ? `/${section}` : ''}?highlight=${encodeURIComponent(id)}`;
              return (
                <li key={id}>
                  <Link
                    to={href}
                    className={cx(
                      'rounded-full border border-line px-2.5 py-0.5 text-xs text-brand-600 hover:bg-brand-50',
                      SOFT,
                      FOCUS,
                    )}
                  >
                    {item ? `${item.code} · ${item.name}` : id}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
