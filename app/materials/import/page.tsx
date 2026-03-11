'use client'

import { useMemo, useState } from 'react'
import Papa from 'papaparse'
import { useRouter } from 'next/navigation'
import { UploadCloud, ArrowLeft, CheckCircle2, AlertTriangle, Database, ArrowRight } from 'lucide-react'

import { supabase } from '@/utils/supabase'
import { useOrganization } from '@/app/context/OrganizationContext'
import type { TablesInsert } from '@/types/database.types'

type RawRow = Record<string, string>
type TargetField = 'name' | 'description' | 'category_id' | 'reorder_point'
type FieldMapping = Partial<Record<TargetField, string>>

type ImportMaterial = TablesInsert<'materials'>

function parseNumber(value: string | undefined): number | null {
  if (!value) return null
  const cleaned = value.trim()
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function getCell(row: RawRow, header: string | undefined): string {
  if (!header) return ''
  const v = row[header]
  return typeof v === 'string' ? v : ''
}

export default function MaterialsImportPage() {
  const router = useRouter()
  const { organization } = useOrganization() as { organization: { id: string } | null }

  const [fileName, setFileName] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<RawRow[]>([])
  const [mapping, setMapping] = useState<FieldMapping>({ name: '' })
  const [error, setError] = useState<string>('')
  const [message, setMessage] = useState<string>('')
  const [committing, setCommitting] = useState(false)

  const canReview = headers.length > 0 && rows.length > 0

  const mappedPreview = useMemo(() => {
    const preview = rows.slice(0, 8).map((r) => {
      const name = getCell(r, mapping.name).trim()
      const description = getCell(r, mapping.description).trim()
      const categoryId = parseNumber(getCell(r, mapping.category_id))
      const reorderPoint = parseNumber(getCell(r, mapping.reorder_point))
      return { name, description, category_id: categoryId, reorder_point: reorderPoint }
    })
    return preview
  }, [rows, mapping])

  const missingNameMapping = !mapping.name

  function setFieldMapping(field: TargetField, csvHeader: string) {
    setMapping((prev) => ({
      ...prev,
      [field]: csvHeader === '__none__' ? '' : csvHeader,
    }))
  }

  async function onFileSelected(file: File) {
    setError('')
    setMessage('')
    setFileName(file.name)
    setHeaders([])
    setRows([])
    setMapping({ name: '' })

    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => (typeof h === 'string' ? h.trim() : ''),
      complete: (results) => {
        const parsedRows = results.data.filter((r) => r && Object.keys(r).length > 0)
        const foundHeaders = results.meta.fields?.filter(Boolean) ?? []

        if (results.errors.length > 0) {
          setError(results.errors[0]?.message || 'CSV parse error.')
          return
        }

        if (foundHeaders.length === 0 || parsedRows.length === 0) {
          setError('No rows detected. Ensure your CSV has a header row and at least 1 data row.')
          return
        }

        setHeaders(foundHeaders)
        setRows(parsedRows)

        // Best-effort auto-mapping by common header names
        const normalized = new Map(foundHeaders.map((h) => [h.toLowerCase(), h]))
        const pick = (...candidates: string[]) => {
          for (const c of candidates) {
            const hit = normalized.get(c)
            if (hit) return hit
          }
          return ''
        }

        setMapping({
          name: pick('name', 'material', 'material_name', 'item', 'item_name'),
          description: pick('description', 'desc', 'details', 'notes'),
          category_id: pick('category_id', 'categoryid', 'category'),
          reorder_point: pick('reorder_point', 'reorderpoint', 'reorder', 'min', 'min_stock'),
        })
      },
      error: (err) => {
        setError(err.message || 'CSV parse error.')
      },
    })
  }

  async function reviewAndCommit() {
    setError('')
    setMessage('')

    if (!organization?.id) {
      setError('No active organization found. Select a chamber first.')
      return
    }
    if (missingNameMapping) {
      setError('Map a CSV column to required field: name.')
      return
    }

    const inserts: ImportMaterial[] = []

    for (const r of rows) {
      const name = getCell(r, mapping.name).trim()
      if (!name) continue

      const description = getCell(r, mapping.description).trim()
      const categoryId = parseNumber(getCell(r, mapping.category_id))
      const reorderPoint = parseNumber(getCell(r, mapping.reorder_point))

      const row: ImportMaterial = {
        name,
        organization_id: organization.id,
        description: description || null,
        category_id: categoryId,
        reorder_point: reorderPoint,
      }

      inserts.push(row)
    }

    if (inserts.length === 0) {
      setError('No valid rows found after mapping. Make sure the mapped name column has values.')
      return
    }

    setCommitting(true)
    try {
      const { error: insertError } = await supabase.from('materials').insert(inserts)
      if (insertError) throw insertError

      setMessage(`Committed ${inserts.length} materials to your registry.`)
      router.push('/materials')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed.')
    } finally {
      setCommitting(false)
    }
  }

  const card = 'bg-[#0f0f0f] border border-gray-800/80 rounded-[2rem] shadow-xl'
  const label = 'text-[9px] font-black uppercase tracking-widest text-gray-500'
  const input =
    'w-full bg-black border border-gray-800 focus:border-purple-500 p-4 rounded-2xl outline-none transition-colors font-bold text-sm text-gray-200'
  const select =
    'w-full bg-black border border-gray-800 focus:border-purple-500 p-4 rounded-2xl outline-none transition-colors font-black uppercase text-[10px] tracking-widest text-gray-300'

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans pb-32">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-end justify-between gap-4 border-b border-gray-800 pb-5">
          <div>
            <button
              onClick={() => router.push('/materials')}
              className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-purple-400 transition-colors flex items-center gap-2"
            >
              <ArrowLeft size={12} /> Back to Materials
            </button>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic text-gray-100 mt-2">Bulk CSV Import</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1 flex items-center gap-2">
              <Database size={12} className="text-purple-500" />
              Map external headers to Keep registry columns
            </p>
          </div>
          {organization?.id && (
            <div className="text-right">
              <p className={label}>Active Chamber</p>
              <p className="text-xs font-black text-gray-300">{organization.id}</p>
            </div>
          )}
        </header>

        {(error || message) && (
          <div
            className={`p-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-3 border ${
              error ? 'bg-red-950/20 border-red-900/50 text-red-400' : 'bg-green-950/20 border-green-900/50 text-green-400'
            }`}
          >
            {error ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            {error || message}
          </div>
        )}

        <section className={`${card} p-6 md:p-8`}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-800/50 pb-5 mb-6">
            <div>
              <p className={label}>Upload CSV</p>
              <p className="text-xs text-gray-500 font-bold mt-2">
                We parse in-browser. No file leaves your machine—only the mapped rows are committed.
              </p>
            </div>
            <label className="cursor-pointer bg-purple-600 hover:bg-purple-500 text-white px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-purple-900/20 flex items-center gap-2 w-fit">
              <UploadCloud size={14} />
              Choose File
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void onFileSelected(f)
                }}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <p className={label}>Detected File</p>
              <div className="mt-2 bg-black border border-gray-800 rounded-2xl p-4">
                <p className="text-xs font-bold text-gray-300 truncate">{fileName || 'No file selected.'}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mt-2">
                  {rows.length} rows • {headers.length} headers
                </p>
              </div>
            </div>

            <div className="md:col-span-2">
              <p className={label}>Headers Found</p>
              <div className="mt-2 bg-black border border-gray-800 rounded-2xl p-4">
                {headers.length === 0 ? (
                  <p className="text-xs font-bold text-gray-600 italic">Upload a CSV to detect headers.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {headers.slice(0, 24).map((h) => (
                      <span
                        key={h}
                        className="text-[9px] font-black uppercase tracking-widest text-gray-400 bg-[#0f0f0f] border border-gray-800 px-2 py-1 rounded-lg"
                      >
                        {h}
                      </span>
                    ))}
                    {headers.length > 24 && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">+{headers.length - 24} more</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className={`${card} p-6 md:p-8`}>
          <div className="flex items-end justify-between gap-4 border-b border-gray-800/50 pb-5 mb-6">
            <div>
              <p className={label}>Mapping</p>
              <p className="text-xs text-gray-500 font-bold mt-2">Map your CSV columns into Keep fields.</p>
            </div>
            <button
              disabled={!canReview || committing || missingNameMapping}
              onClick={() => void reviewAndCommit()}
              className={`px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center gap-2 shadow-lg ${
                !canReview || committing || missingNameMapping
                  ? 'bg-gray-900 border border-gray-800 text-gray-600 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-500 text-white shadow-green-900/20'
              }`}
            >
              Review &amp; Commit <ArrowRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className={label}>name (required)</p>
                <select
                  className={select}
                  value={mapping.name || '__none__'}
                  onChange={(e) => setFieldMapping('name', e.target.value)}
                  disabled={headers.length === 0}
                >
                  <option value="__none__">-- choose header --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className={label}>description</p>
                <select
                  className={select}
                  value={mapping.description || '__none__'}
                  onChange={(e) => setFieldMapping('description', e.target.value)}
                  disabled={headers.length === 0}
                >
                  <option value="__none__">-- none --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className={label}>category_id</p>
                <select
                  className={select}
                  value={mapping.category_id || '__none__'}
                  onChange={(e) => setFieldMapping('category_id', e.target.value)}
                  disabled={headers.length === 0}
                >
                  <option value="__none__">-- none --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-600 font-bold mt-2">
                  Expecting numeric IDs. If your CSV contains category names, we can add a name-to-id resolver next.
                </p>
              </div>

              <div>
                <p className={label}>reorder_point</p>
                <select
                  className={select}
                  value={mapping.reorder_point || '__none__'}
                  onChange={(e) => setFieldMapping('reorder_point', e.target.value)}
                  disabled={headers.length === 0}
                >
                  <option value="__none__">-- none --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className={label}>Preview (first 8 rows)</p>
                <div className="mt-2 bg-black border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="grid grid-cols-12 gap-0 border-b border-gray-800/60 bg-[#0f0f0f] px-4 py-2">
                    <div className="col-span-5 text-[9px] font-black uppercase tracking-widest text-gray-500">name</div>
                    <div className="col-span-4 text-[9px] font-black uppercase tracking-widest text-gray-500">description</div>
                    <div className="col-span-1 text-[9px] font-black uppercase tracking-widest text-gray-500 text-right">cat</div>
                    <div className="col-span-2 text-[9px] font-black uppercase tracking-widest text-gray-500 text-right">reorder</div>
                  </div>
                  {mappedPreview.length === 0 ? (
                    <div className="p-4">
                      <p className="text-xs font-bold text-gray-600 italic">Upload + map columns to preview.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-800/40">
                      {mappedPreview.map((r, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-0 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                          <div className="col-span-5 text-xs font-bold text-gray-300 truncate">{r.name || '—'}</div>
                          <div className="col-span-4 text-xs font-bold text-gray-500 truncate">{r.description || '—'}</div>
                          <div className="col-span-1 text-xs font-black text-gray-400 text-right">{r.category_id ?? '—'}</div>
                          <div className="col-span-2 text-xs font-black text-purple-400 text-right">{r.reorder_point ?? '—'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {missingNameMapping && (
                <div className="bg-yellow-950/20 border border-yellow-900/50 rounded-2xl p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500">Action Required</p>
                  <p className="text-xs font-bold text-yellow-200/80 mt-2">Map a CSV column to `name` before committing.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

