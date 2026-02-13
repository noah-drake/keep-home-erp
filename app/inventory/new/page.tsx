'use client'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'
import { useOrganization } from '../../context/OrganizationContext'
import { ArrowLeft, Save, Package, MapPin, Shield, ArrowDownLeft, ArrowUpRight, AlignLeft } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function TransactionFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlMaterialId = searchParams.get('material_id')
  const { organization } = useOrganization()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Master Data State
  const [materials, setMaterials] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])

  // Form State
  const [transactionType, setTransactionType] = useState<'IN' | 'OUT'>('OUT')
  const [materialId, setMaterialId] = useState(urlMaterialId || '')
  const [locationId, setLocationId] = useState('')
  const [quantity, setQuantity] = useState<number | ''>('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      
      const [matRes, locRes] = await Promise.all([
        // Only fetch ACTIVE materials for transactions
        supabase.from('materials').select('*').eq('organization_id', organization.id).eq('is_active', true).order('name'),
        supabase.from('locations').select('*').eq('organization_id', organization.id).order('name')
      ])

      if (matRes.data) {
        setMaterials(matRes.data)
        // Auto-select location if a material was passed via URL
        if (urlMaterialId) {
          const matchedMat = matRes.data.find(m => m.id === urlMaterialId)
          if (matchedMat && matchedMat.default_location_id) {
            setLocationId(matchedMat.default_location_id)
          }
        }
      }
      if (locRes.data) setLocations(locRes.data)
      
      setLoading(false)
    }

    if (organization) fetchData()
  }, [organization, urlMaterialId])

  // Handle manual material change to auto-update the location
  const handleMaterialChange = (newMatId: string) => {
    setMaterialId(newMatId)
    const matchedMat = materials.find(m => m.id === newMatId)
    if (matchedMat && matchedMat.default_location_id) {
      setLocationId(matchedMat.default_location_id)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!materialId || !locationId || !quantity || quantity <= 0) {
      alert("Please fill out the material, chamber, and a valid quantity.")
      return
    }

    setSaving(true)

    // ERP Ledger Logic: OUT is negative, IN is positive
    const finalQuantity = transactionType === 'OUT' ? -Math.abs(Number(quantity)) : Math.abs(Number(quantity))

    const payload = {
      organization_id: organization.id,
      material_id: materialId,
      location_id: locationId,
      quantity: finalQuantity,
      transaction_type: transactionType,
      notes: notes || null,
      transaction_date: new Date().toISOString()
    }

    const { error } = await supabase.from('inventory_transactions').insert([payload])

    setSaving(false)
    if (error) {
      alert(error.message)
    } else {
      // If they came from a specific item, send them back there. Otherwise, Dashboard.
      if (urlMaterialId) router.push(`/materials/${urlMaterialId}`)
      else router.push('/')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-purple-500">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Shield size={40} />
          <p className="text-xs font-black uppercase tracking-widest text-gray-500">Preparing Ledger...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans pb-32">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex items-center gap-4 border-b border-gray-800 pb-6">
          <button onClick={() => router.back()} className="p-3 bg-gray-900 border border-gray-800 rounded-xl text-gray-400 hover:text-white hover:border-purple-500 transition-all">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic text-gray-100">Transact</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Update Ledger</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* DIRECTION TOGGLE */}
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setTransactionType('IN')}
              className={`p-6 rounded-[2rem] border transition-all flex flex-col items-center justify-center gap-2 ${
                transactionType === 'IN' 
                ? 'bg-purple-900/20 border-purple-500 text-purple-400 shadow-lg shadow-purple-900/20 scale-[1.02]' 
                : 'bg-[#0f0f0f] border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-400'
              }`}
            >
              <ArrowDownLeft size={32} />
              <span className="text-[10px] font-black uppercase tracking-widest">Add Stock (In)</span>
            </button>
            
            <button
              type="button"
              onClick={() => setTransactionType('OUT')}
              className={`p-6 rounded-[2rem] border transition-all flex flex-col items-center justify-center gap-2 ${
                transactionType === 'OUT' 
                ? 'bg-yellow-900/20 border-yellow-500 text-yellow-500 shadow-lg shadow-yellow-900/20 scale-[1.02]' 
                : 'bg-[#0f0f0f] border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-400'
              }`}
            >
              <ArrowUpRight size={32} />
              <span className="text-[10px] font-black uppercase tracking-widest">Remove Stock (Out)</span>
            </button>
          </div>

          <div className="bg-[#0f0f0f] border border-gray-800 p-6 md:p-8 rounded-[2.5rem] space-y-8 shadow-2xl">
            
            {/* QUANTITY INPUT */}
            <div className="flex flex-col items-center justify-center py-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">Quantity</label>
              <input 
                type="number" 
                value={quantity}
                onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                min="0.01"
                step="any"
                required
                placeholder="0"
                className={`w-48 bg-transparent text-center text-8xl font-black tracking-tighter outline-none placeholder:text-gray-800 transition-colors ${transactionType === 'IN' ? 'text-purple-400 focus:text-purple-300' : 'text-yellow-500 focus:text-yellow-400'}`}
              />
            </div>

            <div className="border-t border-gray-800/50"></div>

            {/* SELECTION DROPDOWNS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div>
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                  <Package size={12} className="text-purple-500" /> Item
                </label>
                <select 
                  value={materialId} 
                  onChange={(e) => handleMaterialChange(e.target.value)}
                  required
                  className="w-full bg-black border border-gray-800 p-4 rounded-xl outline-none focus:border-purple-500 transition-colors font-bold text-sm text-gray-200 appearance-none"
                >
                  <option value="" disabled>Select Item...</option>
                  {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                  <MapPin size={12} className="text-blue-500" /> Chamber
                </label>
                <select 
                  value={locationId} 
                  onChange={(e) => setLocationId(e.target.value)}
                  required
                  className="w-full bg-black border border-gray-800 p-4 rounded-xl outline-none focus:border-blue-500 transition-colors font-bold text-sm text-gray-200 appearance-none"
                >
                  <option value="" disabled>Select Chamber...</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>

            {/* NOTES / REASON */}
            <div>
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                <AlignLeft size={12} /> Notes / Reason (Optional)
              </label>
              <textarea 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Used for dinner, Restocked from Costco..."
                className="w-full bg-black border border-gray-800 p-4 rounded-xl outline-none focus:border-purple-500 transition-colors font-bold text-sm text-gray-200 resize-none h-24"
              />
            </div>

          </div>

          {/* SUBMIT BUTTON */}
          <button 
            type="submit"
            disabled={saving}
            className={`w-full py-5 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl ${
              transactionType === 'IN' 
                ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/20' 
                : 'bg-yellow-600 hover:bg-yellow-500 shadow-yellow-900/20 text-black'
            }`}
          >
            <Save size={18} /> {saving ? 'Recording Ledger...' : 'Commit Transaction'}
          </button>
        </form>

      </div>
    </div>
  )
}

// Next 13+ requires useSearchParams to be wrapped in a Suspense boundary
export default function TransactionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <TransactionFormContent />
    </Suspense>
  )
}