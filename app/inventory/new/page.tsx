'use client'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'
import { useOrganization } from '../../context/OrganizationContext'
import { ArrowLeft, Plus, Trash2, Save, Shield, Package, MapPin, ArrowRightLeft, Info } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function TransactionEntryContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlMaterialId = searchParams.get('material_id')
  const { organization } = useOrganization()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [materials, setMaterials] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [primaryMaterial, setPrimaryMaterial] = useState<any>(null)

  // Batch Lines State
  const [lines, setLines] = useState<any[]>([
    { id: Date.now(), material_id: urlMaterialId || '', location_id: '', to_location_id: '', quantity: '', type: 'OUT', notes: '' }
  ])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const [matRes, locRes] = await Promise.all([
        supabase.from('materials').select('*').eq('organization_id', organization.id).eq('is_active', true).order('name'),
        supabase.from('locations').select('*').eq('organization_id', organization.id).order('name')
      ])

      if (matRes.data) {
        setMaterials(matRes.data)
        if (urlMaterialId) {
          const found = matRes.data.find(m => m.id === urlMaterialId)
          setPrimaryMaterial(found)
          // Pre-fill the first line with the default location
          setLines(prev => prev.map((line, i) => i === 0 ? { ...line, location_id: found?.default_location_id || '' } : line))
        }
      }
      if (locRes.data) setLocations(locRes.data)
      setLoading(false)
    }
    if (organization) fetchData()
  }, [organization, urlMaterialId])

  const addLine = () => {
    setLines([...lines, { id: Date.now(), material_id: '', location_id: '', to_location_id: '', quantity: '', type: 'OUT', notes: '' }])
  }

  const removeLine = (id: number) => {
    if (lines.length > 1) setLines(lines.filter(l => l.id !== id))
  }

  const updateLine = (id: number, field: string, value: any) => {
    setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  const handleSubmit = async () => {
    setSaving(true)
    const movements: any[] = []

    lines.forEach(line => {
      const qty = Number(line.quantity)
      if (line.type === 'TRANSFER') {
        // Create two balanced records for a transfer
        movements.push({
          organization_id: organization.id,
          material_id: line.material_id,
          location_id: line.location_id,
          quantity: -Math.abs(qty),
          transaction_type: 'TRANSFER_OUT',
          notes: line.notes || 'Transfer Departure'
        })
        movements.push({
          organization_id: organization.id,
          material_id: line.material_id,
          location_id: line.to_location_id,
          quantity: Math.abs(qty),
          transaction_type: 'TRANSFER_IN',
          notes: line.notes || 'Transfer Arrival'
        })
      } else {
        movements.push({
          organization_id: organization.id,
          material_id: line.material_id,
          location_id: line.location_id,
          quantity: line.type === 'OUT' ? -Math.abs(qty) : Math.abs(qty),
          transaction_type: line.type,
          notes: line.notes || null
        })
      }
    });

    const { error } = await supabase.from('inventory_movements').insert(movements)
    setSaving(false)
    if (error) alert(error.message)
    else router.push('/')
  }

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-purple-500 font-black">SCANNING VAULT...</div>

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans pb-32">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-3 bg-gray-900 border border-gray-800 rounded-xl text-gray-400 hover:text-white transition-all"><ArrowLeft size={20}/></button>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic">Process Movements</h1>
          </div>
          <button onClick={handleSubmit} disabled={saving} className="bg-purple-600 hover:bg-purple-500 px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-lg shadow-purple-900/20">
            <Save size={14}/> {saving ? 'Recording...' : 'Commit Batch'}
          </button>
        </div>

        {/* PRIMARY ITEM FOCUS (If available) */}
        {primaryMaterial && (
          <div className="bg-purple-900/10 border border-purple-500/30 p-6 rounded-[2rem] flex items-center gap-6">
            <div className="w-16 h-16 bg-black border border-purple-500/50 rounded-2xl flex items-center justify-center text-purple-400">
              <Package size={32} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">Primary Subject</p>
              <h2 className="text-2xl font-black uppercase tracking-tight leading-none">{primaryMaterial.name}</h2>
              <p className="text-xs font-bold text-gray-500 mt-1">MRP: {primaryMaterial.reorder_point || 'N/A'} • Unit: {primaryMaterial.unit || 'QTY'}</p>
            </div>
          </div>
        )}

        {/* BATCH LINES */}
        <div className="space-y-4">
          {lines.map((line, index) => (
            <div key={line.id} className="bg-[#0f0f0f] border border-gray-800 p-6 rounded-[2rem] relative group animate-in fade-in slide-in-from-top-2">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                
                {/* Movement Type */}
                <div className="md:col-span-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2 block">Action</label>
                  <select 
                    value={line.type} 
                    onChange={e => updateLine(line.id, 'type', e.target.value)}
                    className={`w-full bg-black border p-3 rounded-xl text-xs font-black uppercase tracking-widest outline-none transition-colors ${line.type === 'IN' ? 'border-purple-500 text-purple-400' : line.type === 'OUT' ? 'border-yellow-500 text-yellow-500' : 'border-blue-500 text-blue-400'}`}
                  >
                    <option value="OUT">Goods Issue (-)</option>
                    <option value="IN">Goods Receipt (+)</option>
                    <option value="TRANSFER">Transfer (A → B)</option>
                  </select>
                </div>

                {/* Material Selection */}
                <div className="md:col-span-3">
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2 block">Good</label>
                  <select 
                    value={line.material_id} 
                    onChange={e => updateLine(line.id, 'material_id', e.target.value)}
                    className="w-full bg-black border border-gray-800 p-3 rounded-xl text-xs font-bold outline-none focus:border-purple-500"
                  >
                    <option value="">Select Good...</option>
                    {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>

                {/* Source Location */}
                <div className={line.type === 'TRANSFER' ? 'md:col-span-2' : 'md:col-span-3'}>
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2 block">{line.type === 'TRANSFER' ? 'From Chamber' : 'Chamber'}</label>
                  <select 
                    value={line.location_id} 
                    onChange={e => updateLine(line.id, 'location_id', e.target.value)}
                    className="w-full bg-black border border-gray-800 p-3 rounded-xl text-xs font-bold outline-none focus:border-blue-500"
                  >
                    <option value="">Select Chamber...</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>

                {/* To Location (Only for Transfers) */}
                {line.type === 'TRANSFER' && (
                  <div className="md:col-span-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2 block">To Chamber</label>
                    <select 
                      value={line.to_location_id} 
                      onChange={e => updateLine(line.id, 'to_location_id', e.target.value)}
                      className="w-full bg-black border border-gray-800 p-3 rounded-xl text-xs font-bold outline-none focus:border-green-500"
                    >
                      <option value="">Select Dest...</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                )}

                {/* Quantity */}
                <div className="md:col-span-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2 block">Qty</label>
                  <input 
                    type="number" 
                    value={line.quantity}
                    onChange={e => updateLine(line.id, 'quantity', e.target.value)}
                    className="w-full bg-black border border-gray-800 p-3 rounded-xl text-xs font-black text-center outline-none focus:border-purple-500"
                  />
                </div>

                {/* Notes Toggle (Simple) */}
                <div className="md:col-span-1 flex justify-center">
                  <button onClick={() => updateLine(line.id, 'showNotes', !line.showNotes)} className={`p-3 rounded-xl border transition-all ${line.showNotes ? 'bg-purple-500 text-black border-purple-500' : 'bg-gray-900 border-gray-800 text-gray-500'}`}>
                    <Info size={16} />
                  </button>
                </div>
              </div>

              {/* Collapsible Notes Field */}
              {line.showNotes && (
                <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
                  <textarea 
                    placeholder="Add transaction reason or audit notes..."
                    value={line.notes}
                    onChange={e => updateLine(line.id, 'notes', e.target.value)}
                    className="w-full bg-black border border-gray-800 p-4 rounded-xl text-xs font-bold outline-none focus:border-purple-500 h-20 resize-none"
                  />
                </div>
              )}

              {/* Remove Button */}
              {lines.length > 1 && (
                <button onClick={() => removeLine(line.id)} className="absolute -right-3 -top-3 w-8 h-8 bg-red-950 border border-red-900 text-red-500 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-xl">
                  <Trash2 size={14}/>
                </button>
              )}
            </div>
          ))}

          {/* ADD LINE BUTTON */}
          <button onClick={addLine} className="w-full py-4 border-2 border-dashed border-gray-800 rounded-[2rem] text-gray-600 hover:border-purple-500/50 hover:text-purple-400 transition-all font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 group">
            <Plus size={16} className="group-hover:rotate-90 transition-transform" /> Add Row to Batch
          </button>
        </div>

      </div>
    </div>
  )
}

export default function TransactionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <TransactionEntryContent />
    </Suspense>
  )
}