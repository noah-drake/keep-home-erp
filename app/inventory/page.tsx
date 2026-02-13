'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useOrganization } from '../context/OrganizationContext'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function InventoryPage() {
  const { organization } = useOrganization()
  const [type, setType] = useState('INBOUND')
  const [loading, setLoading] = useState(false)

  // Data
  const [materials, setMaterials] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [stockByLoc, setStockByLoc] = useState<any[]>([])

  // Form
  const [matId, setMatId] = useState('')
  const [fromLocId, setFromLocId] = useState('')
  const [toLocId, setToLocId] = useState('')
  const [qty, setQty] = useState(1)

  useEffect(() => {
    async function load() {
      if (!organization) return
      const { data: mats } = await supabase.from('view_current_stock').select('*').eq('organization_id', organization.id).order('name')
      const { data: locs } = await supabase.from('locations').select('*').eq('organization_id', organization.id).order('name')
      const { data: sbl } = await supabase.from('view_stock_by_location').select('*').eq('organization_id', organization.id)
      
      setMaterials(mats || []); setLocations(locs || []); setStockByLoc(sbl || [])
      if (mats?.[0]) setMatId(mats[0].material_id)
    }
    load()
  }, [organization])

  // Logic: Filter locations based on where stock actually exists
  const activeStock = stockByLoc.filter(s => s.material_id === matId && s.quantity > 0)
  const currentItem = materials.find(m => m.material_id === matId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization) return
    setLoading(true)

    const movements = type === 'TRANSFER' ? [
        { material_id: matId, location_id: fromLocId, quantity: -qty, movement_type: 'TRANSFER_OUT', organization_id: organization.id },
        { material_id: matId, location_id: toLocId, quantity: qty, movement_type: 'TRANSFER_IN', organization_id: organization.id }
    ] : [{
        material_id: matId, location_id: fromLocId, 
        quantity: type === 'OUTBOUND' ? -qty : qty, 
        movement_type: type, organization_id: organization.id
    }]

    const { error } = await supabase.from('inventory_movements').insert(movements)
    if (error) alert(error.message)
    else { alert("Success!"); window.location.reload(); }
    setLoading(false)
  }

  return (
    <div className="min-h-screen text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-4xl font-black tracking-tighter uppercase">Transactions</h1>

        <div className="flex bg-gray-900 p-1 rounded-2xl border border-gray-800">
            {['INBOUND', 'OUTBOUND', 'TRANSFER'].map(t => (
                <button key={t} onClick={() => { setType(t); setFromLocId(''); setToLocId(''); }} 
                className={`flex-1 py-3 rounded-xl font-bold text-xs tracking-widest transition-all ${type === t ? 'bg-white text-black shadow-xl' : 'text-gray-500'}`}>
                    {t === 'INBOUND' ? 'RECEIVE' : t === 'OUTBOUND' ? 'ISSUE' : 'TRANSFER'}
                </button>
            ))}
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 p-8 rounded-3xl space-y-6 shadow-2xl">
          {/* MATERIAL SELECT */}
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Select Item</label>
            <select value={matId} onChange={e => setMatId(e.target.value)} className="w-full bg-black border border-gray-700 p-4 rounded-xl mt-1 text-lg font-bold">
                {materials.map(m => <option key={m.material_id} value={m.material_id}>{m.name} (Total: {m.current_stock} {m.unit})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* SOURCE LOCATION */}
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    {type === 'INBOUND' ? 'Receiving Into' : 'Source Location'}
                </label>
                <select required value={fromLocId} onChange={e => setFromLocId(e.target.value)} className="w-full bg-black border border-gray-700 p-4 rounded-xl mt-1">
                    <option value="">-- Choose --</option>
                    {type === 'INBOUND' ? locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>) :
                     activeStock.map(s => <option key={s.location_id} value={s.location_id}>{s.location_name} (Has {s.quantity})</option>)}
                </select>
              </div>

              {/* DESTINATION (ONLY FOR TRANSFER) */}
              {type === 'TRANSFER' && (
                <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Destination Location</label>
                    <select required value={toLocId} onChange={e => setToLocId(e.target.value)} className="w-full bg-black border border-gray-700 p-4 rounded-xl mt-1 border-purple-900">
                        <option value="">-- Choose --</option>
                        {locations.filter(l => l.id !== fromLocId).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                </div>
              )}
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Quantity ({currentItem?.unit})</label>
            <input type="number" min="1" step="any" required value={qty} onChange={e => setQty(parseFloat(e.target.value))} 
            className="w-full bg-black border border-gray-700 p-6 rounded-2xl mt-1 text-4xl font-black text-center text-purple-500 outline-none" />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-white text-black py-6 rounded-3xl font-black text-xl hover:bg-purple-600 hover:text-white transition-all">
            {loading ? 'PROCESSING...' : 'EXECUTE TRANSACTION'}
          </button>
        </form>
      </div>
    </div>
  )
}