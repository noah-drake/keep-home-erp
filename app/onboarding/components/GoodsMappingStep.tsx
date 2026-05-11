'use client'

import { ArrowRight, Package, Plus, Store } from 'lucide-react'

export type GlobalCatalogMaterial = {
  id: string
  name: string
  description: string | null
  category_id: number | null
  unit_id: number | null
  reorder_point: number | null
  lot_quantity: number | null
  is_mrp_enabled: boolean
  category: string | null
  barcode: string | null
  is_active: boolean
}

export type CustomWizardLine = {
  clientId: string
  name: string
  reorder_point: number | null
  lot_quantity: number | null
  shareGlobal: boolean
  storeName: string | null
}

interface GoodsMappingStepProps {
  storesSorted: string[]
  globalCatalog: GlobalCatalogMaterial[]
  assignedStoreByCatalogId: Record<string, string>
  toggleCatalogAssignment: (catalogMaterialId: string, storeName: string) => void
  catalogItemsForStore: (storeName: string) => GlobalCatalogMaterial[]
  catalogLoading: boolean
  customGoodName: string
  setCustomGoodName: React.Dispatch<React.SetStateAction<string>>
  customReorderPoint: string
  setCustomReorderPoint: React.Dispatch<React.SetStateAction<string>>
  customLotQty: string
  setCustomLotQty: React.Dispatch<React.SetStateAction<string>>
  customGoodStore: string
  setCustomGoodStore: React.Dispatch<React.SetStateAction<string>>
  customShareGlobal: boolean
  setCustomShareGlobal: React.Dispatch<React.SetStateAction<boolean>>
  addCustomGood: () => void
  customLines: CustomWizardLine[]
  pillBase: string
  card: string
  onNextStep: () => void
  onBackStep: () => void
}

export default function GoodsMappingStep({
  storesSorted,
  globalCatalog,
  assignedStoreByCatalogId,
  toggleCatalogAssignment,
  catalogItemsForStore,
  catalogLoading,
  customGoodName,
  setCustomGoodName,
  customReorderPoint,
  setCustomReorderPoint,
  customLotQty,
  setCustomLotQty,
  customGoodStore,
  setCustomGoodStore,
  customShareGlobal,
  setCustomShareGlobal,
  addCustomGood,
  customLines,
  pillBase,
  card,
  onNextStep,
  onBackStep,
}: GoodsMappingStepProps) {
  const hasAssignments = Object.keys(assignedStoreByCatalogId).length > 0 || customLines.length > 0

  return (
    <section className={`${card} p-6 md:p-8`}>
      <div className="flex items-center justify-between gap-4 border-b border-gray-800/50 pb-5 mb-6">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Step 2</p>
          <h2 className="text-2xl font-black uppercase tracking-tight text-gray-100">Map Goods per Store</h2>
          <p className="text-xs text-gray-500 font-bold mt-2">
            Tap a catalog pill inside a Store to assign it there. Assigned goods disappear from other Stores.
          </p>
        </div>
        <Package size={20} className="text-purple-500" />
      </div>

      {catalogLoading ? (
        <div className="py-16 text-center text-[10px] font-black uppercase tracking-widest text-purple-400 animate-pulse">
          Loading global catalog...
        </div>
      ) : (
        <div className="space-y-6">
          {storesSorted.map((storeName) => (
            <div key={storeName} className="bg-black border border-gray-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-purple-400 flex items-center gap-2">
                <Store size={14} />
                {storeName}
                <span className="text-[9px] text-gray-500 font-bold normal-case ml-2">
                  {catalogItemsForStore(storeName).filter((m) => assignedStoreByCatalogId[m.id] === storeName).length}{' '}
                  assigned here
                </span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {catalogItemsForStore(storeName).map((item) => {
                  const assignedHere = assignedStoreByCatalogId[item.id] === storeName
                  return (
                    <button
                      key={`${storeName}-${item.id}`}
                      type="button"
                      onClick={() => toggleCatalogAssignment(item.id, storeName)}
                      title={item.description ?? item.name}
                      className={`${pillBase} ${
                        assignedHere
                          ? 'bg-purple-900/35 border-purple-500/70 text-purple-200'
                          : 'bg-[#0f0f0f] border-gray-800 text-gray-400 hover:border-purple-500/40 hover:text-purple-300'
                      }`}
                    >
                      {item.name}
                    </button>
                  )
                })}
              </div>
              {catalogItemsForStore(storeName).length === 0 && (
                <p className="text-[10px] text-gray-600 font-bold italic">No available catalog goods for this store.</p>
              )}
            </div>
          ))}

          <div className="bg-black border border-gray-800 rounded-2xl p-4 mt-8">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
              Create Custom Good
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                value={customGoodName}
                onChange={(e) => setCustomGoodName(e.target.value)}
                placeholder="Name (required)"
                className="bg-[#0f0f0f] border border-gray-800 p-3 rounded-xl outline-none focus:border-purple-500 text-sm font-bold lg:col-span-2"
              />
              <input
                value={customReorderPoint}
                onChange={(e) => setCustomReorderPoint(e.target.value)}
                placeholder="Reorder point"
                inputMode="numeric"
                className="bg-[#0f0f0f] border border-gray-800 p-3 rounded-xl outline-none focus:border-purple-500 text-sm font-bold"
              />
              <input
                value={customLotQty}
                onChange={(e) => setCustomLotQty(e.target.value)}
                placeholder="Lot quantity"
                inputMode="numeric"
                className="bg-[#0f0f0f] border border-gray-800 p-3 rounded-xl outline-none focus:border-purple-500 text-sm font-bold"
              />
              <select
                required
                value={customGoodStore}
                onChange={(e) => setCustomGoodStore(e.target.value)}
                className="bg-[#0f0f0f] border border-gray-800 p-3 rounded-xl outline-none focus:border-purple-500 text-sm font-bold md:col-span-2 lg:col-span-4"
              >
                <option value="">Store (required)</option>
                {storesSorted.map((sn) => (
                  <option key={sn} value={sn}>
                    {sn}
                  </option>
                ))}
              </select>
            </div>
            <label className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <input
                type="checkbox"
                checked={customShareGlobal}
                onChange={(e) => setCustomShareGlobal(e.target.checked)}
                className="accent-purple-500"
              />
              Share to Global Catalog (materials · is_global)
            </label>
            <button
              type="button"
              onClick={addCustomGood}
              disabled={!customGoodName.trim() || !customGoodStore}
              className={`mt-4 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
                customGoodName.trim() && customGoodStore
                  ? 'bg-purple-600 hover:bg-purple-500 text-white'
                  : 'bg-gray-900 border border-gray-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              <Plus size={12} />
              Add Custom Good
            </button>
            {customLines.length > 0 && (
              <ul className="mt-4 space-y-1 text-[10px] font-bold text-gray-500 border-t border-gray-800 pt-4">
                {customLines.map((l) => (
                  <li key={l.clientId}>
                    • {l.name}
                    {l.storeName ? ` → ${l.storeName}` : ''}
                    {l.shareGlobal ? ' · will share globally' : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBackStep}
          className="px-4 py-2 rounded-xl border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 text-[10px] font-black uppercase tracking-widest"
        >
          Back
        </button>
        <button
          type="button"
          disabled={catalogLoading || !hasAssignments}
          onClick={onNextStep}
          className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all ${
            catalogLoading || !hasAssignments
              ? 'bg-gray-900 border border-gray-800 text-gray-600 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20'
          }`}
        >
          Next: Initial Audit <ArrowRight size={14} />
        </button>
      </div>
    </section>
  )
}
