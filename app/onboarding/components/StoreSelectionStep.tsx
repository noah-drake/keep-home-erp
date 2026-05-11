'use client'

import { ArrowRight, Store } from 'lucide-react'

export type StoreBucket = {
  label: string
  stores: string[]
}

interface StoreSelectionStepProps {
  selectedStores: string[]
  setSelectedStores: React.Dispatch<React.SetStateAction<string[]>>
  customStoreInput: string
  setCustomStoreInput: React.Dispatch<React.SetStateAction<string>>
  toggleStore: (name: string) => void
  addCustomStore: () => void
  onCustomStoreEnter: (e: React.KeyboardEvent<HTMLInputElement>) => void
  STORE_BUCKETS: StoreBucket[]
  pillBase: string
  card: string
  onNextStep: () => void
}

export default function StoreSelectionStep({
  selectedStores,
  setSelectedStores,
  customStoreInput,
  setCustomStoreInput,
  toggleStore,
  addCustomStore,
  onCustomStoreEnter,
  STORE_BUCKETS,
  pillBase,
  card,
  onNextStep,
}: StoreSelectionStepProps) {
  return (
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
          onClick={onNextStep}
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
  )
}
