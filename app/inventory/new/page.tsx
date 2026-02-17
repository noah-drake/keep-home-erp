'use client'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'
import { useOrganization } from '../../context/OrganizationContext'
import { ArrowLeft, Plus, Trash2, Save, Shield, Package, MapPin, ArrowRightLeft, Info, AlertCircle } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function TransactionEngine() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlMaterialId = searchParams.get('material_id')
  const { organization } = useOrganization()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Master Data
  const [materials, setMaterials] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [stockByLoc, setStockByLoc] = useState<any[]>([])
  const [primaryMaterial, setPrimaryMaterial] = useState<any>(null)

  // Batch Lines
  const [lines, setLines] = useState<any[]>([
    { id: Date.now(), material_id: urlMaterialId || '', location_id: '', to_location_id: '', quantity: '', type: 'OUTBOUND', notes: '', showNotes: false }
  ])

  useEffect(() => {
    const fetchData = async () => {
      if (!organization) return
      setLoading(true)
      
      const [matRes, locRes, sblRes] = await Promise.all([
        supabase.from('view_current_stock').select('*').eq('organization_id', organization.id).order('name'),
        supabase.from('locations').select('*').eq('organization_id', organization.id).order('name'),
        supabase.from('view_stock_by_location').select('*').eq('organization_id', organization.id)
      ])

      if (matRes.data) {
        setMaterials(matRes.data)
        if (urlMaterialId) {
          const found = matRes.data.find(m => m.material_id === urlMaterialId)
          setPrimaryMaterial(found)
          // Pre-fill the first line with the item's default location if stock exists there
          setLines(prev => prev.map((line, i) => i === 0 ? { ...line, material_id: urlMaterialId } : line))
        }
      }
      if (locRes.data) setLocations(locRes.data)
      if (sblRes.data) setStockByLoc(sblRes.data)
      
      setLoading(false)
    }
    fetchData()
  }, [organization, urlMaterialId])

  const addLine = () => {
    setLines([...lines, { id: Date.now(), material_id: '', location_id: '', to_location_id: '', quantity: '', type: 'OUTBOUND', notes: '', showNotes: false }])
  }

  const updateLine = (id: number, field: string, value: any) => {
    setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  const handleSubmit = async () => {
    setSaving(true)
    const movements: any[] = []

    lines.forEach(line => {
      const qty = parseFloat(line.quantity)
      if (line.type === 'TRANSFER') {
        movements.push(
          { organization_id: organization.id, material_id: line.material_id, location_id: line.location_id, quantity: -qty, movement_type: 'TRANSFER_OUT', notes: line.notes },
          { organization_id: organization.id, material_id: line.material_id, location_id: line.to_location_id, quantity: qty, movement_type: 'TRANSFER_IN', notes: line.notes }
        )
      } else {
        movements.push({
          organization_id: organization.id,
          material_id: line.material_id,
          location_id: line.location_id,
          quantity: line.type === 'OUTBOUND' ? -qty : qty,
          movement_type: line.type,
          notes: line.notes
        })
      }
    })

    const { error } = await supabase.from('inventory_movements').insert(movements)
    if (error) alert(error.message)
    else router.push('/history')
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-purple-500 font-black tracking-widest uppercase">Syncing Keep...</div>

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans pb-32">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-black uppercase tracking-tighter italic">Ledger Entry</h1>
          </div>
          <button onClick={handleSubmit} disabled={saving} className="bg-purple-600 hover:bg-purple-500 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-lg transition-all active:scale-95">
            <Save size={16}/> {saving ? 'Recording...' : 'Commit Batch'}
          </button>
        </div>

        {/* PRIMARY ITEM FOCUS (From Button) */}
        {primaryMaterial && (
          <div className="bg-purple-900/10 border border-purple-500/30 p-6 rounded-[2.5rem] flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-black border border-purple-500/50 rounded-2xl flex items-center justify-center text-purple-400">
                <Package size={32} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">Quick Transact Focus</p>
                <h2 className="text-3xl font-black uppercase tracking-tight leading-none">{primaryMaterial.name}</h2>
                <p className="text-xs font-bold text-gray-500 mt-1">Current Keep Total: <span className="text-white">{primaryMaterial.current_stock} {primaryMaterial.unit}</span></p>
              </div>
            </div>
            {primaryMaterial.current_stock <= (primaryMaterial.reorder_point || 0) && (
              <div className="flex items-center gap-2 text-yellow-500 bg-yellow-900/20 px-4 py-2 rounded-xl border border-yellow-500/30 font-black text-[10px] uppercase tracking-widest">
                <AlertCircle size={14} /> Low Stock Alert
              </div>
            )}
          </div>
        )}

        {/* BATCH LINES */}
        <div className="space-y-4">
          {lines.map((line) => {
            const currentItem = materials.find(m => m.material_id === line.material_id)
            // Smart Location Logic: Filter if OUT or TRANSFER
            const activeStock = stockByLoc.filter(s => s.material_id === line.material_id && s.quantity > 0)

            return (
              <div key={line.id} className="bg-[#0f0f0f] border border-gray-800 p-6 rounded-[2.5rem] relative group shadow-xl">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  
                  {/* Type */}
                  <div className="md:col-span-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2 block">Direction</label>
                    <select value={line.type} onChange={e => updateLine(line.id, 'type', e.target.value)} className={`w-full bg-black border p-3 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none transition-colors ${line.type === 'INBOUND' ? 'border-purple-500 text-purple-400' : line.type === 'OUTBOUND' ? 'border-yellow-500 text-yellow-500' : 'border-blue-500 text-blue-400'}`}>
                      <option value="OUTBOUND">Goods Issue (-)</option>
                      <option value="INBOUND">Goods Receipt (+)</option>
                      <option value="TRANSFER">Transfer (A → B)</option>
                    </select>
                  </div>

                  {/* Good */}
                  <div className="md:col-span-3">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2 block">Item Name</label>
                    <select value={line.material_id} onChange={e => updateLine(line.id, 'material_id', e.target.value)} className="w-full bg-black border border-gray-800 p-3 rounded-xl text-xs font-bold outline-none focus:border-purple-500">
                      <option value="">-- Choose Item --</option>
                      {materials.map(m => <option key={m.material_id} value={m.material_id}>{m.name} ({m.current_stock})</option>)}
                    </select>
                  </div>

                  {/* Source */}
                  <div className={line.type === 'TRANSFER' ? 'md:col-span-2' : 'md:col-span-3'}>
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2 block">{line.type === 'INBOUND' ? 'Destination Chamber' : 'Source Chamber'}</label>
                    <select required value={line.location_id} onChange={e => updateLine(line.id, 'location_id', e.target.value)} className="w-full bg-black border border-gray-800 p-3 rounded-xl text-xs font-bold outline-none focus:border-purple-500">
                      <option value="">-- Select --</option>
                      {line.type === 'INBOUND' ? locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>) :
                       activeStock.map(s => <option key={s.location_id} value={s.location_id}>{s.location_name} (Stock: {s.quantity})</option>)}
                    </select>
                  </div>

                  {/* Dest (Transfer Only) */}
                  {line.type === 'TRANSFER' && (
                    <div className="md:col-span-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2 block">Arrival Chamber</label>
                      <select required value={line.to_location_id} onChange={e => updateLine(line.id, 'to_location_id', e.target.value)} className="w-full bg-black border border-gray-800 p-3 rounded-xl text-xs font-bold outline-none focus:border-blue-500">
                        <option value="">-- Select --</option>
                        {locations.filter(l => l.id !== line.location_id).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Qty */}
                  <div className="md:col-span-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2 block">Qty</label>
                    <input type="number" step="any" value={line.quantity} onChange={e => updateLine(line.id, 'quantity', e.target.value)} className="w-full bg-black border border-gray-800 p-3 rounded-xl text-xs font-black text-center outline-none focus:border-purple-500" />
                  </div>

                  {/* Notes Toggle */}
                  <div className="md:col-span-1 flex justify-center">
                    <button onClick={() => updateLine(line.id, 'showNotes', !line.showNotes)} className={`p-3 rounded-xl border transition-all ${line.showNotes ? 'bg-purple-600 text-white border-purple-600' : 'bg-gray-900 border-gray-800 text-gray-500'}`}><Info size={16} /></button>
                  </div>
                </div>

                {line.showNotes && (
                  <div className="mt-4 animate-in slide-in-from-top-2">
                    <textarea placeholder="Reason for movement..." value={line.notes} onChange={e => updateLine(line.id, 'notes', e.target.value)} className="w-full bg-black border border-gray-800 p-4 rounded-xl text-xs font-bold outline-none focus:border-purple-500 h-20 resize-none" />
                  </div>
                )}

                {lines.length > 1 && (
                  <button onClick={() => setLines(lines.filter(l => l.id !== line.id))} className="absolute -right-3 -top-3 w-8 h-8 bg-red-950 border border-red-900 text-red-500 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><Trash2 size={14}/></button>
                )}
              </div>
            )
          })}

          <button onClick={addLine} className="w-full py-4 border-2 border-dashed border-gray-800 rounded-[2rem] text-gray-600 hover:border-purple-500/50 hover:text-purple-400 transition-all font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 group">
            <Plus size={16} className="group-hover:rotate-90 transition-transform" /> Add Batch Line
          </button>
        </div>
      </div>
    </div>
  )
}

export default function InventoryPage() {
  return <Suspense fallback={<div className="min-h-screen bg-black" />}><TransactionEngine /></Suspense>
}