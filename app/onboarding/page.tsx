'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight, Database, Store, Package, Plus, Warehouse } from 'lucide-react'

import { supabase } from '@/utils/supabase'
import { useOrganization } from '@/app/context/OrganizationContext'
import type { Tables, TablesInsert } from '@/types/database.types'
import StoreSelectionStep, { type StoreBucket } from './components/StoreSelectionStep'
import GoodsMappingStep, { type GlobalCatalogMaterial, type CustomWizardLine } from './components/GoodsMappingStep'

type WizardStep = 1 | 2 | 3

type OrganizationCtx = {
  organization: { id: string; name?: string } | null
}

type LocationInsert = TablesInsert<'locations'>
type MaterialInsert = TablesInsert<'materials'>
type MovementInsert = TablesInsert<'inventory_movements'>
type InsertedLocation = Pick<Tables<'locations'>, 'id' | 'name'>

const STORE_BUCKETS: StoreBucket[] = [
  {
    label: 'Most Popular',
    stores: ['Fridge', 'Freezer', 'Kitchen Cabinets', 'Pantry', 'Primary Bath', 'Laundry Room', 'Garage', 'Office'],
  },
  {
    label: 'Apartment',
    stores: ['Fridge', 'Freezer', 'Kitchen Cabinets', 'Bathroom', 'Utility Closet', 'Bedroom', 'Balcony', 'Desk'],
  },
  {
    label: 'Suburban Home',
    stores: [
      'Fridge',
      'Freezer',
      'Kitchen Cabinets',
      'Pantry',
      'Primary Bath',
      'Guest Bath',
      'Garage',
      'Shed',
      'Basement',
      'Attic',
      'Laundry Room',
      'Linen Closet',
    ],
  },
  {
    label: 'Workshop',
    stores: [
      'Main Workbench',
      'Tool Cabinet',
      'Hardware Bin',
      'Wood Storage',
      'Paint Shelf',
      'Power Tool Rack',
      'Fastener Drawer',
      'Scrap Bin',
    ],
  },
  {
    label: 'Office',
    stores: ['Desk Drawers', 'Filing Cabinet', 'Supply Closet', 'Bookshelf', 'Printer Station', 'Cable Management Box'],
  },
]

function parseOptionalInt(value: string): number | null {
  const t = value.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Local clone payload from a global template row */
function buildClonePayload(
  source: GlobalCatalogMaterial,
  organizationId: string,
  defaultLocationId: string | null
): MaterialInsert {
  return {
    name: source.name,
    description: source.description,
    category: (source.category as TablesInsert<'materials'>['category']) ?? null,
    category_id: source.category_id,
    unit_id: source.unit_id,
    reorder_point: source.reorder_point,
    lot_quantity: source.lot_quantity,
    is_mrp_enabled: source.is_mrp_enabled,
    barcode: source.barcode ?? null,
    is_active: source.is_active ?? true,
    organization_id: organizationId,
    default_location_id: defaultLocationId,
    is_global: false,
  }
}

/** DB allows null org on global-shared rows; generated Insert types may lag — assertion at insert site */
type GlobalCatalogSharePayload = Omit<TablesInsert<'materials'>, 'organization_id'> & {
  organization_id?: string | null
}

export default function OnboardingPage() {
  const router = useRouter()
  const { organization } = useOrganization() as OrganizationCtx

  const [step, setStep] = useState<WizardStep>(1)
  const [selectedStores, setSelectedStores] = useState<string[]>([])
  const [customStoreInput, setCustomStoreInput] = useState('')

  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [globalCatalog, setGlobalCatalog] = useState<GlobalCatalogMaterial[]>([])

  /** Global template material id → store name (exclusive assignment) */
  const [assignedStoreByCatalogId, setAssignedStoreByCatalogId] = useState<Record<string, string>>({})

  const [customLines, setCustomLines] = useState<CustomWizardLine[]>([])
  const [customGoodName, setCustomGoodName] = useState('')
  const [customReorderPoint, setCustomReorderPoint] = useState('')
  const [customLotQty, setCustomLotQty] = useState('')
  const [customGoodStore, setCustomGoodStore] = useState<string>('')
  const [customShareGlobal, setCustomShareGlobal] = useState(false)

  /** quantity key: `catalog:${materialId}` or `custom:${clientId}` */
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function fetchGlobalCatalog() {
      setCatalogLoading(true)
      setCatalogError('')
      try {
        const { data, error: qErr } = await supabase
          .from('materials')
          .select(
            'id, name, description, category_id, category, unit_id, reorder_point, lot_quantity, is_mrp_enabled, barcode, is_active'
          )
          .eq('is_global', true)

        if (cancelled) return
        if (qErr) throw qErr
        setGlobalCatalog((data as GlobalCatalogMaterial[]) ?? [])
      } catch (e: unknown) {
        if (!cancelled) setCatalogError(e instanceof Error ? e.message : 'Failed to load catalog.')
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    }

    void fetchGlobalCatalog()
    return () => {
      cancelled = true
    }
  }, [])

  const storesSorted = useMemo(() => [...selectedStores].sort((a, b) => a.localeCompare(b)), [selectedStores])

  const catalogItemsForStore = useMemo(() => {
    return (storeName: string) =>
      globalCatalog.filter((m) => {
        const assigned = assignedStoreByCatalogId[m.id]
        return !assigned || assigned === storeName
      })
  }, [globalCatalog, assignedStoreByCatalogId])

  function toggleCatalogAssignment(catalogMaterialId: string, storeName: string) {
    setAssignedStoreByCatalogId((prev) => {
      const current = prev[catalogMaterialId]
      if (current === storeName) {
        const { [catalogMaterialId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [catalogMaterialId]: storeName }
    })
  }

  const toggleStore = (name: string) => {
    setSelectedStores((prev) => (prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]))
  }

  function addCustomStore() {
    const normalized = customStoreInput.trim()
    if (!normalized) return
    setSelectedStores((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]))
    setCustomStoreInput('')
  }

  function onCustomStoreEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addCustomStore()
    }
  }

  function addCustomGood() {
    const name = customGoodName.trim()
    if (!name || !customGoodStore) return

    const clientId = `custom-${crypto.randomUUID()}`
    const reorderPoint = parseOptionalInt(customReorderPoint)
    const lotQty = parseOptionalInt(customLotQty)

    const line: CustomWizardLine = {
      clientId,
      name,
      reorder_point: reorderPoint,
      lot_quantity: lotQty,
      shareGlobal: customShareGlobal,
      storeName: customGoodStore || null,
    }

    setCustomLines((prev) => [...prev, line])
    setQuantities((q) => ({ ...q, [`custom:${clientId}`]: 0 }))

    setCustomGoodName('')
    setCustomReorderPoint('')
    setCustomLotQty('')
    setCustomGoodStore('')
    setCustomShareGlobal(false)
  }

  const auditCatalogEntries = useMemo(() => {
    return Object.entries(assignedStoreByCatalogId).map(([materialId, storeName]) => {
      const item = globalCatalog.find((m) => m.id === materialId)
      return { materialId, storeName, item }
    }).filter((e): e is { materialId: string; storeName: string; item: GlobalCatalogMaterial } => !!e.item)
  }, [assignedStoreByCatalogId, globalCatalog])

  function setQuantityForKey(lineKey: string, value: string) {
    const parsed = Number(value)
    const q = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
    setQuantities((prev) => ({ ...prev, [lineKey]: q }))
  }

  async function initializeKeep() {
    setError('')
    if (!organization?.id) {
      setError('No active organization found. Create/select a chamber first.')
      return
    }
    if (storesSorted.length === 0) {
      setError('Select at least one store before initializing.')
      return
    }
    if (auditCatalogEntries.length === 0 && customLines.length === 0) {
      setError('Assign at least one catalog good to a store, or add a custom good.')
      return
    }

    setSaving(true)
    try {
      const locationPayload: LocationInsert[] = storesSorted.map((name) => ({
        name,
        organization_id: organization.id,
      }))

      const { data: insertedLocations, error: locationErr } = await supabase
        .from('locations')
        .insert(locationPayload)
        .select('id, name')

      if (locationErr) throw locationErr
      if (!insertedLocations || insertedLocations.length === 0) throw new Error('Failed to create stores.')

      const locationMap = new Map<string, string>(
        (insertedLocations as InsertedLocation[]).map((loc) => [loc.name, loc.id])
      )

      const materialRowsByAuditKey = new Map<string, Pick<Tables<'materials'>, 'id' | 'name' | 'default_location_id'>>()

      // Clone global catalog selections into local materials
      for (const { materialId, storeName, item } of auditCatalogEntries) {
        const defaultLocationId = locationMap.get(storeName) ?? null
        const payload = buildClonePayload(item, organization.id, defaultLocationId)
        const { data: materialRow, error: matErr } = await supabase
          .from('materials')
          .insert(payload)
          .select('id, name, default_location_id')
          .single()
        if (matErr) throw matErr
        materialRowsByAuditKey.set(`catalog:${materialId}`, materialRow)
      }

      // Customs: local row + optional global template row (materials-only, is_global)
      for (const line of customLines) {
        const defaultLocationId = line.storeName ? locationMap.get(line.storeName) ?? null : null

        const localPayload: MaterialInsert = {
          name: line.name,
          description: null,
          organization_id: organization.id,
          default_location_id: defaultLocationId,
          reorder_point: line.reorder_point,
          lot_quantity: line.lot_quantity,
          is_global: false,
          is_active: true,
          is_mrp_enabled: false,
          category_id: null,
          unit_id: null,
          category: null,
          barcode: null,
        }

        const { data: localRow, error: localErr } = await supabase
          .from('materials')
          .insert(localPayload)
          .select('id, name, default_location_id')
          .single()

        if (localErr) throw localErr
        materialRowsByAuditKey.set(`custom:${line.clientId}`, localRow)

        if (line.shareGlobal) {
          const globalShare: GlobalCatalogSharePayload = {
            name: line.name,
            description: null,
            organization_id: null,
            default_location_id: null,
            reorder_point: line.reorder_point,
            lot_quantity: line.lot_quantity,
            is_global: true,
            is_active: true,
            category_id: null,
            category: null as TablesInsert<'materials'>['category'],
            unit_id: null,
            barcode: null,
            is_mrp_enabled: false,
          }
          const { error: gErr } = await supabase
            .from('materials')
            .insert(globalShare as TablesInsert<'materials'>)

          if (gErr) throw gErr
        }
      }

      const movementPayload: MovementInsert[] = []

      for (const { materialId } of auditCatalogEntries) {
        const key = `catalog:${materialId}`
        const qty = quantities[key] ?? 0
        if (qty <= 0) continue
        const row = materialRowsByAuditKey.get(key)
        if (!row) continue
        movementPayload.push({
          movement_type: 'INBOUND',
          material_id: row.id,
          location_id: row.default_location_id,
          quantity: qty,
          organization_id: organization.id,
          material_name: row.name,
        })
      }

      for (const line of customLines) {
        const key = `custom:${line.clientId}`
        const qty = quantities[key] ?? 0
        if (qty <= 0) continue
        const row = materialRowsByAuditKey.get(key)
        if (!row) continue
        movementPayload.push({
          movement_type: 'INBOUND',
          material_id: row.id,
          location_id: row.default_location_id,
          quantity: qty,
          organization_id: organization.id,
          material_name: row.name,
        })
      }

      if (movementPayload.length > 0) {
        const { error: movementErr } = await supabase.from('inventory_movements').insert(movementPayload)
        if (movementErr) throw movementErr
      }

      router.push('/')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Initialization failed.')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    setQuantities((prev) => {
      const managed = new Set<string>([
        ...auditCatalogEntries.map(({ materialId }) => `catalog:${materialId}`),
        ...customLines.map((l) => `custom:${l.clientId}`),
      ])
      const next = { ...prev }
      let changed = false
      for (const k of managed) {
        if (next[k] === undefined) {
          next[k] = 0
          changed = true
        }
      }
      for (const k of Object.keys(next)) {
        if ((k.startsWith('catalog:') || k.startsWith('custom:')) && !managed.has(k)) {
          delete next[k]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [auditCatalogEntries, customLines])

  const pillBase =
    'px-3 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 truncate max-w-[200px]'
  const card = 'bg-[#0f0f0f] border border-gray-800/80 rounded-[2rem] shadow-xl'

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans pb-32">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="border-b border-gray-800 pb-5">
          <h1 className="text-4xl font-black uppercase tracking-tighter italic text-gray-100">Day 0 Initialization</h1>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mt-1 flex items-center gap-2">
            <Warehouse size={12} className="text-purple-500" />
            Establish Stores, map Goods per Store, then run Initial Audit
          </p>
          <div className="mt-4 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
            <span className={step >= 1 ? 'text-purple-400' : 'text-gray-600'}>1. Stores</span>
            <span className="text-gray-700">/</span>
            <span className={step >= 2 ? 'text-purple-400' : 'text-gray-600'}>2. Goods</span>
            <span className="text-gray-700">/</span>
            <span className={step >= 3 ? 'text-purple-400' : 'text-gray-600'}>3. Audit & Commit</span>
          </div>
        </header>

        {(error || catalogError) && (
          <div className="p-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-3 border bg-red-950/20 border-red-900/50 text-red-400">
            <AlertTriangle size={16} />
            {error || catalogError}
          </div>
        )}

        {step === 1 && (
          <StoreSelectionStep
            selectedStores={selectedStores}
            setSelectedStores={setSelectedStores}
            customStoreInput={customStoreInput}
            setCustomStoreInput={setCustomStoreInput}
            toggleStore={toggleStore}
            addCustomStore={addCustomStore}
            onCustomStoreEnter={onCustomStoreEnter}
            STORE_BUCKETS={STORE_BUCKETS}
            pillBase={pillBase}
            card={card}
            onNextStep={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <GoodsMappingStep
            storesSorted={storesSorted}
            globalCatalog={globalCatalog}
            assignedStoreByCatalogId={assignedStoreByCatalogId}
            toggleCatalogAssignment={toggleCatalogAssignment}
            catalogItemsForStore={catalogItemsForStore}
            catalogLoading={catalogLoading}
            customGoodName={customGoodName}
            setCustomGoodName={setCustomGoodName}
            customReorderPoint={customReorderPoint}
            setCustomReorderPoint={setCustomReorderPoint}
            customLotQty={customLotQty}
            setCustomLotQty={setCustomLotQty}
            customGoodStore={customGoodStore}
            setCustomGoodStore={setCustomGoodStore}
            customShareGlobal={customShareGlobal}
            setCustomShareGlobal={setCustomShareGlobal}
            addCustomGood={addCustomGood}
            customLines={customLines}
            pillBase={pillBase}
            card={card}
            onNextStep={() => setStep(3)}
            onBackStep={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <section className={`${card} p-6 md:p-8`}>
            <div className="flex items-center justify-between gap-4 border-b border-gray-800/50 pb-5 mb-6">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Step 3</p>
                <h2 className="text-2xl font-black uppercase tracking-tight text-gray-100">Audit & Commit</h2>
              </div>
              <Database size={20} className="text-purple-500" />
            </div>

            <div className="space-y-2">
              {auditCatalogEntries.map(({ materialId, storeName, item }) => (
                <div
                  key={materialId}
                  className="bg-black border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-black text-gray-100 truncate">{item.name}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mt-1">
                      Catalog clone • {storeName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Qty</label>
                    <input
                      type="number"
                      min={0}
                      value={quantities[`catalog:${materialId}`] ?? 0}
                      onChange={(e) => setQuantityForKey(`catalog:${materialId}`, e.target.value)}
                      className="w-24 bg-[#0f0f0f] border border-gray-800 rounded-lg p-2 text-right font-black text-sm outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              ))}
              {customLines.map((line) => (
                <div
                  key={line.clientId}
                  className="bg-black border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-black text-gray-100 truncate">{line.name}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mt-1">
                      Custom • {line.storeName ?? '?'}
                      {line.shareGlobal ? ' · + global catalog share' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Qty</label>
                    <input
                      type="number"
                      min={0}
                      value={quantities[`custom:${line.clientId}`] ?? 0}
                      onChange={(e) => setQuantityForKey(`custom:${line.clientId}`, e.target.value)}
                      className="w-24 bg-[#0f0f0f] border border-gray-800 rounded-lg p-2 text-right font-black text-sm outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-xl border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 text-[10px] font-black uppercase tracking-widest"
              >
                Back
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => void initializeKeep()}
                className={`px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-2 transition-all ${
                  saving
                    ? 'bg-gray-900 border border-gray-800 text-gray-600 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-xl shadow-purple-900/30 active:scale-95'
                }`}
              >
                {saving ? 'Initializing...' : 'Initialize Keep'}
                {!saving && <ArrowRight size={16} />}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
