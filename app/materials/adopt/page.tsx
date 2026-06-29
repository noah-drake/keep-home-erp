'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useOrganization } from '../../context/OrganizationContext'
import { ArrowLeft, Globe, Search, Check, X, Settings2, ToggleLeft, ToggleRight, PackagePlus } from 'lucide-react'
import { supabase } from '@/utils/supabase'
import { adoptCatalogItem, type KeepPolicy } from '@/lib/catalog'
import type { Tables } from '@/types/database.types'

type GlobalCatalogItem = Pick<
  Tables<'catalog_items'>,
  'id' | 'name' | 'description' | 'barcode' | 'category' | 'category_id' | 'unit_id'
>
type LocationRow = Pick<Tables<'locations'>, 'id' | 'name'>

function AdoptCatalogContent() {
  const router = useRouter()
  const { organization } = useOrganization()

  const [loading, setLoading] = useState(true)
  const [catalog, setCatalog] = useState<GlobalCatalogItem[]>([])
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  // The catalog item currently being adopted (drives the policy form).
  const [selected, setSelected] = useState<GlobalCatalogItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Policy form state
  const [defaultLocationId, setDefaultLocationId] = useState('')
  const [isMrpEnabled, setIsMrpEnabled] = useState(false)
  const [reorderPoint, setReorderPoint] = useState('')
  const [lotQuantity, setLotQuantity] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      if (!organization) return
      setLoading(true)

      const [catRes, locRes, ownedRes] = await Promise.all([
        supabase
          .from('catalog_items')
          .select('id, name, description, barcode, category, category_id, unit_id')
          .eq('visibility', 'global')
          .order('name'),
        supabase.from('locations').select('id, name').eq('organization_id', organization.id).order('name'),
        // What the org already adopted, so we can exclude those catalog items from the list.
        supabase.from('org_materials').select('catalog_item_id').eq('organization_id', organization.id),
      ])

      const adopted = new Set((ownedRes.data ?? []).map((r) => r.catalog_item_id))
      if (catRes.data) setCatalog(catRes.data.filter((c) => !adopted.has(c.id)))
      if (locRes.data) setLocations(locRes.data)
      setLoading(false)
    }
    fetchData()
  }, [organization])

  const filtered = useMemo(
    () => catalog.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [catalog, searchTerm]
  )

  const openAdoptForm = (item: GlobalCatalogItem) => {
    setSelected(item)
    setDefaultLocationId('')
    setIsMrpEnabled(false)
    setReorderPoint('')
    setLotQuantity('')
    setError('')
  }

  const handleAdopt = async () => {
    if (!organization || !selected) return
    if (!defaultLocationId) {
      setError('Choose a default store before adopting.')
      return
    }
    setSaving(true)
    setError('')
    const policy: KeepPolicy = {
      default_location_id: defaultLocationId,
      is_mrp_enabled: isMrpEnabled,
      reorder_point: isMrpEnabled && reorderPoint !== '' ? parseFloat(reorderPoint) : null,
      lot_quantity: isMrpEnabled && lotQuantity !== '' ? parseFloat(lotQuantity) : null,
    }
    try {
      await adoptCatalogItem(organization.id, selected.id, policy)
      router.push('/materials')
    } catch (err) {
      setSaving(false)
      setError(err instanceof Error ? err.message : 'Failed to adopt item.')
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-purple-500 font-black uppercase tracking-widest">Loading Catalog...</div>
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans pb-32">
      <div className="max-w-3xl mx-auto space-y-8">

        <div className="flex items-center gap-4 border-b border-gray-800 pb-6">
          <button onClick={() => router.back()} className="p-3 bg-gray-900 border border-gray-800 rounded-xl text-gray-400 hover:text-white transition-all"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic text-gray-100">Adopt from Catalog</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2"><Globe size={12} className="text-blue-500" /> Shared Global Catalog</p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-3 border bg-red-950/20 border-red-900/50 text-red-400">
            <X size={16} /> {error}
          </div>
        )}

        {/* SEARCH */}
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors" size={18} />
          <input
            placeholder="Search the global catalog..."
            className="w-full bg-gray-900 border border-gray-800 p-4 pl-12 rounded-2xl outline-none focus:border-purple-500 transition-all font-bold text-sm text-gray-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* CATALOG LIST */}
        <div className="bg-[#0f0f0f] border border-gray-800 rounded-[2.5rem] overflow-hidden shadow-2xl divide-y divide-gray-800/50">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm font-bold text-gray-500 italic">No global catalog items available to adopt.</p>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => openAdoptForm(item)}
                className={`w-full text-left p-5 flex items-center justify-between gap-4 transition-colors hover:bg-gray-800/30 ${selected?.id === item.id ? 'bg-purple-900/10' : ''}`}
              >
                <div className="min-w-0">
                  <p className="font-black text-sm text-gray-200 truncate">{item.name}</p>
                  <p className="text-[9px] uppercase tracking-widest text-gray-600 mt-1 truncate">
                    {item.category || 'Uncategorized'}{item.barcode ? ` · ${item.barcode}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-purple-400 bg-purple-900/20 border border-purple-500/30 px-3 py-2 rounded-xl flex items-center gap-2">
                  <PackagePlus size={12} /> Adopt
                </span>
              </button>
            ))
          )}
        </div>

        {/* ADOPT POLICY FORM */}
        {selected && (
          <div className="bg-[#0f0f0f] border border-purple-500/40 p-8 rounded-[2.5rem] space-y-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between border-b border-gray-800/50 pb-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-purple-500">Adopting</p>
                <h2 className="text-lg font-black uppercase tracking-tight text-gray-100">{selected.name}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="p-3 bg-gray-900 border border-gray-800 hover:text-red-400 rounded-xl text-gray-500 transition-colors"><X size={16} /></button>
            </div>

            <div>
              <label className={lbl}>Default Store (required)</label>
              <select value={defaultLocationId} onChange={(e) => setDefaultLocationId(e.target.value)} className={`${inpt} appearance-none`}>
                <option value="">-- Choose a store --</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>

            {/* MRP TOGGLE */}
            <div className="border-t border-gray-800/50 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2"><Settings2 size={16} className="text-blue-500" /> MRP Rules</h3>
                  <p className="text-[10px] font-bold text-gray-600 mt-1">Optional reorder thresholds and lot sizes.</p>
                </div>
                <button type="button" onClick={() => setIsMrpEnabled(!isMrpEnabled)} className="focus:outline-none">
                  {isMrpEnabled ? <ToggleRight size={36} className="text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" /> : <ToggleLeft size={36} className="text-gray-600" />}
                </button>
              </div>
            </div>

            {isMrpEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2">
                <div>
                  <label className={lbl}>Reorder Point (Min Stock)</label>
                  <input type="number" step="any" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} className={`${inpt} focus:border-blue-500`} placeholder="e.g. 5" />
                </div>
                <div>
                  <label className={lbl}>Standard Procurement Lot</label>
                  <input type="number" step="any" value={lotQuantity} onChange={(e) => setLotQuantity(e.target.value)} className={`${inpt} focus:border-blue-500`} placeholder="e.g. 12" />
                </div>
              </div>
            )}

            <button onClick={handleAdopt} disabled={saving} className="w-full bg-purple-600 hover:bg-purple-500 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/20 active:scale-95 text-white disabled:opacity-50">
              {saving ? 'Adopting...' : <><Check size={16} /> Add to my Keep</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const lbl = "block text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2"
const inpt = "w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none focus:border-purple-500 transition-colors font-bold text-sm text-gray-200"

export default function AdoptCatalogPage() { return <Suspense fallback={<div className="min-h-screen bg-black" />}><AdoptCatalogContent /></Suspense> }
