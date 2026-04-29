'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, Database, Package, Plus, Store, Warehouse } from 'lucide-react'

import { supabase } from '@/utils/supabase'
import { useOrganization } from '@/app/context/OrganizationContext'
import type { Tables, TablesInsert } from '@/types/database.types'

type WizardStep = 1 | 2 | 3

type StoreBucket = {
  label: string
  stores: string[]
}

type SuggestedGroup = {
  label: string
  goods: string[]
}

type GoodSource = 'suggested' | 'custom'

type WizardGood = {
  id: string
  name: string
  source: GoodSource
  categoryLabel: string
  description: string | null
  shareToGlobal: boolean
  storeName: string | null
  quantity: number
}

type OrganizationCtx = {
  organization: { id: string; name?: string } | null
}

type LocationInsert = TablesInsert<'locations'>
type GlobalGoodInsert = TablesInsert<'global_goods'>
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

const SUGGESTED_GOODS: SuggestedGroup[] = [
  { label: 'Food/Perishables', goods: ['Eggs', 'Milk', 'Bread', 'Ground Beef', 'Chicken Breast', 'Butter', 'Cheese'] },
  {
    label: 'Pantry/Dry Goods',
    goods: ['Coffee', 'Pasta', 'Rice', 'Canned Beans', 'Olive Oil', 'Flour', 'Sugar', 'Cereal'],
  },
  {
    label: 'Consumables',
    goods: ['AA Batteries', 'AAA Batteries', 'Trash Bags (13 Gal)', 'Paper Towels', 'Toilet Paper', 'Ziploc Bags'],
  },
  { label: 'Cleaning', goods: ['Glass Cleaner', 'Dish Soap', 'Laundry Detergent', 'Bleach', 'Sponges', 'Multi-Surface Cleaner'] },
  { label: 'Maintenance', goods: ['WD-40', 'HVAC Air Filters', 'Lightbulbs (LED 60W)', 'Duct Tape', 'Zip Ties'] },
]

function normalizeKey(v: string): string {
  return v.trim().toLowerCase()
}

export default function OnboardingPage() {
  const router = useRouter()
  const { organization } = useOrganization() as OrganizationCtx

  const [step, setStep] = useState<WizardStep>(1)
  const [selectedStores, setSelectedStores] = useState<string[]>([])
  const [customStoreInput, setCustomStoreInput] = useState('')

  const [selectedGoods, setSelectedGoods] = useState<WizardGood[]>([])

  const [customGoodName, setCustomGoodName] = useState('')
  const [customGoodDescription, setCustomGoodDescription] = useState('')
  const [customGoodStore, setCustomGoodStore] = useState<string>('')
  const [customGoodShareGlobal, setCustomGoodShareGlobal] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const storesSorted = useMemo(() => [...selectedStores].sort((a, b) => a.localeCompare(b)), [selectedStores])

  const selectedGoodKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const g of selectedGoods) {
      if (g.source === 'suggested') keys.add(normalizeKey(g.name))
    }
    return keys
  }, [selectedGoods])

  function toggleStore(name: string) {
    setSelectedStores((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    )
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

  function toggleSuggestedGood(name: string, categoryLabel: string) {
    const key = normalizeKey(name)
    setSelectedGoods((prev) => {
      const exists = prev.find((g) => g.source === 'suggested' && normalizeKey(g.name) === key)
      if (exists) return prev.filter((g) => !(g.source === 'suggested' && normalizeKey(g.name) === key))

      return [
        ...prev,
        {
          id: `suggested-${key}`,
          name,
          source: 'suggested',
          categoryLabel,
          description: null,
          shareToGlobal: false,
          storeName: null,
          quantity: 0,
        },
      ]
    })
  }

  function updateGoodStore(goodId: string, storeName: string) {
    setSelectedGoods((prev) =>
      prev.map((g) => (g.id === goodId ? { ...g, storeName: storeName || null } : g))
    )
  }

  function addCustomGood() {
    const name = customGoodName.trim()
    if (!name) return

    setSelectedGoods((prev) => [
      ...prev,
      {
        id: `custom-${crypto.randomUUID()}`,
        name,
        source: 'custom',
        categoryLabel: 'Custom',
        description: customGoodDescription.trim() || null,
        shareToGlobal: customGoodShareGlobal,
        storeName: customGoodStore || null,
        quantity: 0,
      },
    ])

    setCustomGoodName('')
    setCustomGoodDescription('')
    setCustomGoodStore('')
    setCustomGoodShareGlobal(false)
  }

  function setQuantity(goodId: string, value: string) {
    const parsed = Number(value)
    const quantity = Number.isFinite(parsed) && parsed > 0 ? parsed : 0
    setSelectedGoods((prev) => prev.map((g) => (g.id === goodId ? { ...g, quantity } : g)))
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
    if (selectedGoods.length === 0) {
      setError('Select or create at least one good before initializing.')
      return
    }

    setSaving(true)
    try {
      // Step A: Insert stores (locations)
      const locationPayload: LocationInsert[] = storesSorted.map((name) => ({
        name,
        organization_id: organization.id,
      }))

      const { data: insertedLocations, error: locationErr } = await supabase
        .from('locations')
        .insert(locationPayload)
        .select('id, name')

      if (locationErr) throw locationErr
      if (!insertedLocations || insertedLocations.length === 0) {
        throw new Error('Failed to create stores.')
      }

      const locationMap = new Map<string, string>(
        (insertedLocations as InsertedLocation[]).map((loc) => [loc.name, loc.id])
      )

      // Resolve user for global catalog attribution
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // Step B: Insert goods into materials (and global_goods for opted-in custom)
      const materialByGoodId = new Map<string, Pick<Tables<'materials'>, 'id' | 'name' | 'default_location_id'>>()

      for (const good of selectedGoods) {
        let globalGoodId: string | null = null

        if (good.source === 'custom' && good.shareToGlobal) {
          const globalPayload: GlobalGoodInsert = {
            name: good.name,
            description: good.description,
            created_by: user?.id ?? null,
          }
          const { data: globalRow, error: globalErr } = await supabase
            .from('global_goods')
            .insert(globalPayload)
            .select('id')
            .single()
          if (globalErr) throw globalErr
          globalGoodId = globalRow.id
        }

        const mappedLocationId = good.storeName ? locationMap.get(good.storeName) ?? null : null
        const materialPayload: MaterialInsert = {
          name: good.name,
          description: good.description,
          organization_id: organization.id,
          default_location_id: mappedLocationId,
          is_opted_into_global: good.source === 'custom' ? good.shareToGlobal : false,
          global_good_id: globalGoodId,
        }

        const { data: materialRow, error: materialErr } = await supabase
          .from('materials')
          .insert(materialPayload)
          .select('id, name, default_location_id')
          .single()

        if (materialErr) throw materialErr
        materialByGoodId.set(good.id, materialRow)
      }

      // Step C: Insert initial movement logs for positive quantities
      const movementPayload: MovementInsert[] = selectedGoods
        .filter((g) => g.quantity > 0)
        .map((g) => {
          const material = materialByGoodId.get(g.id)
          if (!material) throw new Error(`Missing material insert for ${g.name}`)

          return {
            movement_type: 'INBOUND',
            material_id: material.id,
            location_id: material.default_location_id,
            quantity: g.quantity,
            organization_id: organization.id,
            material_name: material.name,
          }
        })

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

  const card = 'bg-[#0f0f0f] border border-gray-800/80 rounded-[2rem] shadow-xl'
  const pillBase =
    'px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all active:scale-95'

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans pb-32">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="border-b border-gray-800 pb-5">
          <h1 className="text-4xl font-black uppercase tracking-tighter italic text-gray-100">Day 0 Initialization</h1>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mt-1 flex items-center gap-2">
            <Warehouse size={12} className="text-purple-500" />
            Establish Stores, Goods, then run Initial Audit
          </p>
          <div className="mt-4 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
            <span className={step >= 1 ? 'text-purple-400' : 'text-gray-600'}>1. Stores</span>
            <span className="text-gray-700">/</span>
            <span className={step >= 2 ? 'text-purple-400' : 'text-gray-600'}>2. Goods</span>
            <span className="text-gray-700">/</span>
            <span className={step >= 3 ? 'text-purple-400' : 'text-gray-600'}>3. Audit & Commit</span>
          </div>
        </header>

        {error && (
          <div className="p-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-3 border bg-red-950/20 border-red-900/50 text-red-400">
            <CheckCircle2 size={16} />
            {error}
          </div>
        )}

        {step === 1 && (
          <section className={`${card} p-6 md:p-8`}>
            <div className="flex items-center justify-between gap-4 border-b border-gray-800/50 pb-5 mb-6">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Step 1</p>
                <h2 className="text-2xl font-black uppercase tracking-tight text-gray-100">Establish Stores</h2>
              </div>
              <Store size={20} className="text-purple-500" />
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2">
              {STORE_BUCKETS.map((bucket) => (
                <div
                  key={bucket.label}
                  className="min-w-[320px] bg-black border border-gray-800 rounded-2xl p-4 shrink-0"
                >
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">{bucket.label}</h3>
                  <div className="flex flex-wrap gap-2">
                    {bucket.stores.map((storeName) => {
                      const selected = selectedStores.includes(storeName)
                      return (
                        <button
                          key={`${bucket.label}-${storeName}`}
                          onClick={() => toggleStore(storeName)}
                          className={`${pillBase} ${
                            selected
                              ? 'bg-purple-900/30 border-purple-500/50 text-purple-300 shadow-md shadow-purple-900/20'
                              : 'bg-[#0f0f0f] border-gray-800 text-gray-400 hover:border-gray-600'
                          }`}
                        >
                          {storeName}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-2">
                Missing a store? Type it here and hit Enter
              </label>
              <input
                value={customStoreInput}
                onChange={(e) => setCustomStoreInput(e.target.value)}
                onKeyDown={onCustomStoreEnter}
                placeholder="e.g. Guest Room Closet"
                className="w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none focus:border-purple-500 transition-colors font-bold text-sm text-gray-200"
              />
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                {selectedStores.length} stores selected
              </p>
              <button
                disabled={selectedStores.length === 0}
                onClick={() => setStep(2)}
                className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all ${
                  selectedStores.length === 0
                    ? 'bg-gray-900 border border-gray-800 text-gray-600 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20'
                }`}
              >
                Next: Stock your Stores <ArrowRight size={14} />
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className={`${card} p-6 md:p-8`}>
            <div className="flex items-center justify-between gap-4 border-b border-gray-800/50 pb-5 mb-6">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Step 2</p>
                <h2 className="text-2xl font-black uppercase tracking-tight text-gray-100">Establish Goods</h2>
              </div>
              <Package size={20} className="text-purple-500" />
            </div>

            <div className="space-y-6">
              {SUGGESTED_GOODS.map((group) => (
                <div key={group.label}>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">{group.label}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {group.goods.map((goodName) => {
                      const selected = selectedGoodKeys.has(normalizeKey(goodName))
                      const selectedRecord = selectedGoods.find(
                        (g) => g.source === 'suggested' && normalizeKey(g.name) === normalizeKey(goodName)
                      )
                      return (
                        <div
                          key={`${group.label}-${goodName}`}
                          className={`border rounded-2xl p-4 transition-colors ${
                            selected
                              ? 'bg-purple-900/20 border-purple-500/40'
                              : 'bg-black border-gray-800 hover:border-gray-600'
                          }`}
                        >
                          <button
                            onClick={() => toggleSuggestedGood(goodName, group.label)}
                            className="w-full flex items-center justify-between"
                          >
                            <span className="text-sm font-black text-left">{goodName}</span>
                            <span
                              className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md border ${
                                selected
                                  ? 'text-purple-300 border-purple-500/50 bg-purple-900/20'
                                  : 'text-gray-500 border-gray-800 bg-[#0f0f0f]'
                              }`}
                            >
                              {selected ? 'Selected' : 'Select'}
                            </span>
                          </button>

                          {selected && selectedRecord && (
                            <div className="mt-3 border-t border-gray-800/60 pt-3">
                              <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-2">
                                Where do you keep this?
                              </label>
                              <select
                                value={selectedRecord.storeName ?? ''}
                                onChange={(e) => updateGoodStore(selectedRecord.id, e.target.value)}
                                className="w-full bg-[#0f0f0f] border border-gray-800 rounded-xl p-3 text-xs font-bold outline-none focus:border-purple-500"
                              >
                                <option value="">-- Unassigned --</option>
                                {storesSorted.map((storeName) => (
                                  <option key={storeName} value={storeName}>
                                    {storeName}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              <div className="bg-black border border-gray-800 rounded-2xl p-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Create Custom Good</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={customGoodName}
                    onChange={(e) => setCustomGoodName(e.target.value)}
                    placeholder="Good name"
                    className="bg-[#0f0f0f] border border-gray-800 p-3 rounded-xl outline-none focus:border-purple-500 text-sm font-bold"
                  />
                  <select
                    value={customGoodStore}
                    onChange={(e) => setCustomGoodStore(e.target.value)}
                    className="bg-[#0f0f0f] border border-gray-800 p-3 rounded-xl outline-none focus:border-purple-500 text-sm font-bold"
                  >
                    <option value="">Where do you keep this? (optional)</option>
                    {storesSorted.map((storeName) => (
                      <option key={storeName} value={storeName}>
                        {storeName}
                      </option>
                    ))}
                  </select>
                  <input
                    value={customGoodDescription}
                    onChange={(e) => setCustomGoodDescription(e.target.value)}
                    placeholder="Description (optional)"
                    className="md:col-span-2 bg-[#0f0f0f] border border-gray-800 p-3 rounded-xl outline-none focus:border-purple-500 text-sm font-bold"
                  />
                </div>
                <label className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <input
                    type="checkbox"
                    checked={customGoodShareGlobal}
                    onChange={(e) => setCustomGoodShareGlobal(e.target.checked)}
                    className="accent-purple-500"
                  />
                  Share this to the Global Catalog
                </label>
                <button
                  onClick={addCustomGood}
                  disabled={!customGoodName.trim()}
                  className={`mt-4 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
                    customGoodName.trim()
                      ? 'bg-purple-600 hover:bg-purple-500 text-white'
                      : 'bg-gray-900 border border-gray-800 text-gray-600 cursor-not-allowed'
                  }`}
                >
                  <Plus size={12} />
                  Add Custom Good
                </button>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 text-[10px] font-black uppercase tracking-widest"
              >
                Back
              </button>
              <button
                disabled={selectedGoods.length === 0}
                onClick={() => setStep(3)}
                className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all ${
                  selectedGoods.length === 0
                    ? 'bg-gray-900 border border-gray-800 text-gray-600 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20'
                }`}
              >
                Next: Initial Audit <ArrowRight size={14} />
              </button>
            </div>
          </section>
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
              {selectedGoods.map((good) => (
                <div
                  key={good.id}
                  className="bg-black border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-black text-gray-100 truncate">{good.name}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mt-1">
                      {good.categoryLabel} {good.storeName ? `• ${good.storeName}` : '• Unassigned'}
                      {good.source === 'custom' && good.shareToGlobal ? ' • Global' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Current Quantity</label>
                    <input
                      type="number"
                      min={0}
                      value={good.quantity}
                      onChange={(e) => setQuantity(good.id, e.target.value)}
                      className="w-24 bg-[#0f0f0f] border border-gray-800 rounded-lg p-2 text-right font-black text-sm outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-xl border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 text-[10px] font-black uppercase tracking-widest"
              >
                Back
              </button>

              <button
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

