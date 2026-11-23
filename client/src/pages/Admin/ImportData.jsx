import { useEffect, useRef, useState } from 'react';
import {
  Loader2,
  AlertCircle,
  Upload,
  Download,
  CheckCircle2,
  FileWarning,
  Copy,
} from 'lucide-react';
import { adminAPI } from '../../lib/api';

/**
 * CSV import.
 *
 * Two phases on purpose: preview validates and writes nothing, apply commits in
 * one transaction. The apply button stays disabled until a preview has been run,
 * because "import 300 rows and find out" is not a workflow.
 */
export default function ImportData() {
  const [options, setOptions] = useState([]);
  const [resource, setResource] = useState('');
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState(null);
  const [allowPartial, setAllowPartial] = useState(false);

  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const fileRef = useRef(null);

  useEffect(() => {
    adminAPI
      .getImportOptions()
      .then((res) => {
        const list = res.data?.data || [];
        setOptions(list);
        if (list.length) setResource(list[0].resource);
      })
      .catch(() => setError('Could not load import options.'));
  }, []);

  // A new file or a different target invalidates the preview — applying a
  // preview that describes different input is the one truly dangerous bug here.
  const resetPreview = () => {
    setPreview(null);
    setResult(null);
  };

  const active = options.find((o) => o.resource === resource);

  const readFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsv(String(reader.result || ''));
      resetPreview();
    };
    reader.readAsText(file);
  };

  const runPreview = async () => {
    setBusy('preview');
    setError(null);
    setResult(null);
    try {
      const res = await adminAPI.previewImport(resource, csv);
      setPreview(res.data?.data || null);
    } catch (err) {
      setError(err?.response?.data?.error || 'Preview failed.');
      setPreview(null);
    } finally {
      setBusy(null);
    }
  };

  const runApply = async () => {
    setBusy('apply');
    setError(null);
    try {
      const res = await adminAPI.applyImport(resource, csv, allowPartial);
      setResult(res.data?.data || { message: 'Import complete.' });
      setPreview(null);
    } catch (err) {
      setError(err?.response?.data?.error || 'Import failed. Nothing was written.');
    } finally {
      setBusy(null);
    }
  };

  const downloadTemplate = async () => {
    // The template endpoint needs the auth header, so it cannot be a plain
    // <a download> — fetch it through the API client and save the blob.
    try {
      const res = await adminAPI.downloadImportTemplate(resource);
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${resource}-template.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not download the template.');
    }
  };

  const hasErrors = (preview?.rowsWithErrors || 0) > 0;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Import from CSV</h1>
        <p className="mt-1 text-sm text-gray-600">
          Preview first — it validates every row and writes nothing. Applying runs
          in a single transaction, so a file with errors is rejected whole rather
          than half-imported.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">{result.message || 'Import complete.'}</p>
            <p className="mt-0.5">
              {result.inserted ?? 0} created
              {result.skipped != null ? `, ${result.skipped} skipped as duplicates` : ''}.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <label htmlFor="i-resource" className="mb-1 block text-xs font-medium text-gray-600">
              What are you importing?
            </label>
            <select
              id="i-resource"
              value={resource}
              onChange={(e) => {
                setResource(e.target.value);
                resetPreview();
              }}
              className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
            >
              {options.map((o) => (
                <option key={o.resource} value={o.resource}>
                  {o.resource}
                </option>
              ))}
            </select>

            {active && (
              <div className="mt-3 space-y-2 text-xs text-gray-600">
                <p>
                  <span className="font-medium text-gray-800">Required:</span>{' '}
                  {active.required.join(', ')}
                </p>
                <p>
                  <span className="font-medium text-gray-800">Duplicates matched on:</span>{' '}
                  <code className="rounded bg-gray-100 px-1 py-0.5">{active.uniqueBy}</code>
                </p>
                <details>
                  <summary className="cursor-pointer font-medium text-gray-800">
                    All {active.fields.length} columns
                  </summary>
                  <p className="mt-1 leading-5">{active.fields.join(', ')}</p>
                </details>
              </div>
            )}

            <button
              type="button"
              onClick={downloadTemplate}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-400"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download template
            </button>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-400 px-3 py-6 text-sm font-medium text-gray-700 hover:border-gray-500 hover:bg-gray-50"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Choose a .csv file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={readFile}
              className="sr-only"
            />
            <p className="mt-2 text-xs text-gray-500">
              Export from Excel or Sheets as <strong>CSV UTF-8</strong>. Max 1000 rows.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <label htmlFor="i-csv" className="mb-1 block text-xs font-medium text-gray-600">
              CSV content
              <span className="ml-1 font-normal text-gray-500">(or paste it directly)</span>
            </label>
            <textarea
              id="i-csv"
              rows={10}
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                resetPreview();
              }}
              spellCheck={false}
              placeholder={'name,role,phone,email,location\nA. Example,Professor,0141…,a@lnmiit.ac.in,Block A'}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
            />

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={runPreview}
                disabled={!csv.trim() || !resource || busy === 'preview'}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40"
              >
                {busy === 'preview' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                Preview
              </button>

              <button
                type="button"
                onClick={runApply}
                disabled={!preview || busy === 'apply' || (hasErrors && !allowPartial)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#A6192E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#8B0000] disabled:opacity-40"
              >
                {busy === 'apply' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" aria-hidden="true" />
                )}
                Import {preview ? `${preview.willInsert} row${preview.willInsert === 1 ? '' : 's'}` : ''}
              </button>

              {hasErrors && (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={allowPartial}
                    onChange={(e) => setAllowPartial(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Import the valid rows only
                </label>
              )}
            </div>

            {!preview && csv.trim() && (
              <p className="mt-2 text-xs text-gray-500">
                Run a preview before importing.
              </p>
            )}
          </div>

          {preview && (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="flex flex-wrap gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                <span>
                  <strong className="text-gray-900">{preview.totalRows}</strong>{' '}
                  <span className="text-gray-600">rows read</span>
                </span>
                <span className="text-green-800">
                  <strong>{preview.willInsert}</strong> will be created
                </span>
                <span className="text-amber-800">
                  <strong>{preview.willSkipDuplicates}</strong> duplicates skipped
                </span>
                <span className="text-red-800">
                  <strong>{preview.rowsWithErrors}</strong> with errors
                </span>
              </div>

              {preview.unknownColumns?.length > 0 && (
                <p className="border-b border-gray-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
                  Ignored unknown columns: {preview.unknownColumns.join(', ')}
                </p>
              )}

              {preview.errors?.length > 0 && (
                <div className="border-b border-gray-200 p-4">
                  <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-red-800">
                    <FileWarning className="h-4 w-4" aria-hidden="true" />
                    Rows that cannot be imported
                  </h3>
                  <ul className="space-y-1.5">
                    {preview.errors.map((e) => (
                      <li key={e.line} className="text-sm">
                        <span className="font-mono text-xs text-gray-500">line {e.line}</span>{' '}
                        <span className="text-gray-900">
                          {e.data?.name || e.data?.title || '(no name)'}
                        </span>{' '}
                        — <span className="text-red-700">{e.problems.join('; ')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.duplicates?.length > 0 && (
                <div className="border-b border-gray-200 p-4">
                  <h3 className="mb-2 text-sm font-semibold text-amber-800">
                    Duplicates
                  </h3>
                  <ul className="space-y-1.5">
                    {preview.duplicates.map((d) => (
                      <li key={d.line} className="text-sm">
                        <span className="font-mono text-xs text-gray-500">line {d.line}</span>{' '}
                        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">{d.key}</code>{' '}
                        — <span className="text-gray-700">{d.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.preview?.length > 0 && (
                <div className="p-4">
                  <h3 className="mb-2 text-sm font-semibold text-gray-900">
                    First {preview.preview.length} rows that will be created
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-600">
                        <tr>
                          <th className="px-2 py-1.5 font-medium">Line</th>
                          {Object.keys(preview.preview[0].data).map((k) => (
                            <th key={k} className="px-2 py-1.5 font-medium">
                              {k}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {preview.preview.map((row) => (
                          <tr key={row.line}>
                            <td className="px-2 py-1.5 font-mono text-xs text-gray-500">
                              {row.line}
                            </td>
                            {Object.keys(preview.preview[0].data).map((k) => (
                              <td
                                key={k}
                                className="max-w-48 truncate whitespace-pre-wrap px-2 py-1.5 text-gray-900"
                              >
                                {row.data[k] ?? <span className="text-gray-400">—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* The API's own note names the endpoint to POST to, which is
                  meaningless to an editor. Say the same thing in their terms. */}
              <p className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600">
                Nothing has been written yet.{' '}
                {hasErrors
                  ? 'Fix the rows above and preview again, or tick “Import the valid rows only”.'
                  : 'Press Import to commit these rows.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
