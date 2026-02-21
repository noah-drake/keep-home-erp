'use client'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'
import { useOrganization } from '../context/OrganizationContext'
import { Plus, Trash2, Save, Package, Copy, CheckSquare, Square, ArrowDownLeft, ArrowRightLeft, ArrowUpRight } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function TransactionEngine() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlMaterialId = searchParams.get('material_id')
  const { organization } = useOrganization()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [autoSwitched, setAutoSwitched] = useState(false) // Tracks if the system intervened
  
  const [materials, setMaterials] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [stockByLoc, setStockByLoc] = useState<any[]>([])
  const [primaryMaterial, setPrimaryMaterial] = useState<any>(null)

  // Transaction State
  const [lines, setLines] = useState<any[]>([])
  const [selectedLines, setSelectedLines] = useState<number[]>([])

  useEffect(() => {
    const fetchData = async () => {
      if (!organization) return
      setLoading(true)
      
      const [matRes, locRes, sblRes] = await Promise.all([
        supabase.from('materials').select('*').eq('organization_id', organization.id).eq('is_active', true).order('name'),
        supabase.from('locations').select('*').eq('organization_id', organization.id).order('name'),
        supabase.from('view_stock_by_location').select('*').eq('organization_id', organization.id)
      ])

      if (matRes.data) setMaterials(matRes.data)
      if (locRes.data) setLocations(locRes.data)
      if (sblRes.data) setStockByLoc(sblRes.data)
      
      // SMART INIT LOGIC ON PAGE LOAD
      let initType = 'OUTBOUND'
      let initLoc = ''
      
      if (urlMaterialId && matRes.data) {
        const targetMat = matRes.data.find(m => String(m.id) === urlMaterialId)
        if (targetMat) {
          setPrimaryMaterial(targetMat)
          const itemStock = sblRes.data?.filter(s => String(s.material_id) === urlMaterialId && s.quantity > 0) || []
          const totalStock = itemStock.reduce((sum, s) => sum + s.quantity, 0)
          
          if (totalStock <= 0) {
             // Out of stock: Default to Inbound & Default Location
             initType = 'INBOUND'
             initLoc = targetMat.default_location_id || ''
             setAutoSwitched(true) // System intervened
          } else if (itemStock.length === 1) {
             // In stock in exactly ONE location: Default to Outbound & auto-select that location
             initType = 'OUTBOUND'
             initLoc = itemStock[0].location_id
          }
        }
      }

      setLines([{ 
        id: Date.now(), 
        material_id: urlMaterialId || '', 
        location_id: initLoc, 
        to_location_id: '', 
        quantity: '', 
        type: initType, 
        notes: '' 
      }])
      
      setLoading(false)
    }
    fetchData()
  }, [organization, urlMaterialId])

  // --- LINE MANAGEMENT ---
  const addLine = () => {
    setLines([...lines, { id: Date.now(), material_id: '', location_id: '', to_location_id: '', quantity: '', type: 'OUTBOUND', notes: '' }])
  }

  const updateLine = (id: number, field: string, value: any) => {
    setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  const duplicateLine = (line: any) => {
    const newLine = { ...line, id: Date.now() + Math.random() }
    const index = lines.findIndex(l => l.id === line.id)
    const newLines = [...lines]
    newLines.splice(index + 1, 0, newLine)
    setLines(newLines)
  }

  // --- SMART DROPDOWN LOGIC ---
  const handleMaterialSelect = (id: number, newMaterialId: string) => {
    const mat = materials.find(m => String(m.id) === newMaterialId)
    if (!mat) {
      updateLine(id, 'material_id', newMaterialId)
      return
    }

    const itemStock = stockByLoc.filter(s => String(s.material_id) === newMaterialId && s.quantity > 0)
    const totalStock = itemStock.reduce((sum, s) => sum + s.quantity, 0)
    
    setLines(lines.map(l => {
      if (l.id === id) {
        let newType = l.type
        let newLoc = l.location_id

        if (totalStock <= 0) {
           newType = 'INBOUND'
           newLoc = mat.default_location_id || ''
        } else {
           newType = 'OUTBOUND'
           if (itemStock.length === 1) {
             newLoc = itemStock[0].location_id
           } else {
             newLoc = '' 
           }
        }

        return { ...l, material_id: newMaterialId, type: newType, location_id: newLoc, to_location_id: '' }
      }
      return l
    }))
  }

  const handleTypeChange = (id: number, newType: string) => {
    setLines(lines.map(l => {
      if (l.id === id) {
        let newLoc = l.location_id
        const mat = materials.find(m => String(m.id) === l.material_id)
        
        if (mat) {
          const itemStock = stockByLoc.filter(s => String(s.material_id) === String(mat.id) && s.quantity > 0)
          
          if (newType === 'INBOUND') {
             newLoc = mat.default_location_id || ''
          } else if ((newType === 'OUTBOUND' || newType === 'TRANSFER') && itemStock.length === 1) {
             newLoc = itemStock[0].location_id
          }
        }

        return { ...l, type: newType, location_id: newLoc, to_location_id: newType === 'TRANSFER' ? l.to_location_id : '' }
      }
      return l
    }))
  }

  // --- BULK ACTIONS ---
  const toggleLineSelect = (id: number) => {
    if (selectedLines.includes(id)) setSelectedLines(selectedLines.filter(lineId => lineId !== id))
    else setSelectedLines([...selectedLines, id])
  }

  const handleBulkDelete = () => {
    setLines(lines.filter(l => !selectedLines.includes(l.id)))
    setSelectedLines([])
  }

  const handleBulkDuplicate = () => {
    const linesToDuplicate = lines.filter(l => selectedLines.includes(l.id))
    const duplicated = linesToDuplicate.map(l => ({ ...l, id: Date.now() + Math.random() }))
    setLines([...lines, ...duplicated])
    setSelectedLines([])
  }

  // --- SUBMISSION ---
  const validateBatch = () => {
    const projectedChanges = new Map<string, number>()

    for (const line of lines) {
      if (!line.material_id || !line.location_id || !line.quantity) continue
      const qty = parseFloat(line.quantity)
      const key = `${line.material_id}|${line.location_id}`

      if (line.type === 'OUTBOUND' || line.type === 'TRANSFER') {
        projectedChanges.set(key, (projectedChanges.get(key) || 0) + qty)
      }
    }

    for (const [key, totalRequested] of projectedChanges.entries()) {
      const [mId, lId] = key.split('|')
      const currentAvailable = stockByLoc.find(s => String(s.material_id) === String(mId) && String(s.location_id) === String(lId))?.quantity || 0
      
      if (totalRequested > currentAvailable) {
        const matName = materials.find(m => String(m.id) === String(mId))?.name || "Item"
        const locName = locations.find(l => String(l.id) === String(lId))?.name || "Location"
        alert(`STOCK REJECTED: You are trying to move ${totalRequested} of ${matName} from ${locName}, but only ${currentAvailable} exist there.`)
        return false
      }
    }
    return true
  }

  const handleSubmit = async () => {
    if (lines.length === 0) return alert("Add at least one valid line to commit.")
    if (!validateBatch()) return
    
    setSaving(true)
    const movements: any[] = []

    lines.forEach(line => {
      if (!line.material_id || !line.location_id || !line.quantity) return
      const qty = parseFloat(line.quantity)
      
      if (line.type === 'TRANSFER') {
        movements.push(
          { organization_id: organization.id, material_id: line.material_id, location_id: line.location_id, quantity: -qty, movement_type: 'TRANSFER_OUT', notes: line.notes || 'Transfer Out' },
          { organization_id: organization.id, material_id: line.material_id, location_id: line.to_location_id, quantity: qty, movement_type: 'TRANSFER_IN', notes: line.notes || 'Transfer In' }
        )
      } else {
        movements.push({
          organization_id: organization.id,
          material_id: line.material_id,
          location_id: line.location_id,
          quantity: line.type === 'OUTBOUND' ? -qty : qty,
          movement_type: line.type,
          notes: line.notes || null
        })
      }
    })

    const { error } = await supabase.from('inventory_movements').insert(movements)
    if (error) alert(error.message)
    else router.push('/history')
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-purple-500 font-black tracking-widest uppercase text-xs">Verifying Vault...</div>

  // Dense UI Styling Constants
  const lbl = "block text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1"
  const inpt = "w-full bg-black border border-gray-800 p-2.5 rounded-xl outline-none transition-colors font-bold text-xs text-gray-200 appearance-none"
  const getFocusColor = (type: string) => {
    if (type === 'INBOUND') return 'focus:border-purple-500 text-purple-400'
    if (type === 'TRANSFER') return 'focus:border-blue-500 text-blue-400'
    return 'focus:border-yellow-500 text-yellow-500'
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans pb-32">
      <div className="max-w-[1440px] mx-auto space-y-6">
        
        <header className="border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">Ledger Entry</h1>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mt-1">Batch Goods Movements</p>
        </header>

        {primaryMaterial && (
          <div className="bg-[#0f0f0f] border border-gray-800 p-5 rounded-[2rem] flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 bg-black border border-gray-800 rounded-2xl flex items-center justify-center text-purple-500 shadow-inner shrink-0">
                 <Package size={24} />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-purple-500 mb-0.5">Active Focus</p>
                <h2 className="text-xl font-black uppercase tracking-tight leading-none text-gray-200">{primaryMaterial.name}</h2>
              </div>
            </div>
            
            {/* Contextual Warning Flag */}
            {autoSwitched && lines[0]?.type === 'INBOUND' && (
              <div className="bg-yellow-950/10 border border-yellow-900/30 px-4 py-2.5 rounded-xl flex items-center gap-3">
                 <ArrowDownLeft size={14} className="text-yellow-500" />
                 <div>
                     <p className="text-[9px] font-black uppercase tracking-widest text-yellow-500">Auto-Switched to Receipt</p>
                     <p className="text-[8px] font-bold text-gray-500 mt-0.5 uppercase tracking-widest">Item is currently out of stock.</p>
                 </div>
              </div>
            )}
          </div>
        )}

        {/* BULK ACTION BAR */}
        <div className={`transition-all duration-300 overflow-hidden ${selectedLines.length > 0 ? 'max-h-20 opacity-100 mb-2' : 'max-h-0 opacity-0 mb-0'}`}>
          <div className="bg-purple-900/10 border border-purple-500/30 p-3 rounded-2xl flex justify-between items-center shadow-lg px-5">
            <span className="text-[9px] font-black uppercase tracking-widest text-purple-400">
              {selectedLines.length} Line{selectedLines.length > 1 ? 's' : ''} Selected
            </span>
            <div className="flex gap-3">
              <button onClick={handleBulkDuplicate} className="px-4 py-2 bg-[#0f0f0f] hover:bg-gray-900 border border-gray-800 rounded-lg text-[9px] font-black uppercase tracking-widest text-gray-300 flex items-center gap-2 transition-colors">
                <Copy size={12} /> Duplicate
              </button>
              <button onClick={handleBulkDelete} className="px-4 py-2 bg-red-950/30 hover:bg-red-900/50 border border-red-900/50 rounded-lg text-[9px] font-black uppercase tracking-widest text-red-400 flex items-center gap-2 transition-colors">
                <Trash2 size={12} /> Remove
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {lines.length === 0 && (
             <div className="text-center py-10 border border-dashed border-gray-800 rounded-3xl">
               <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">No lines in batch. Add a line to begin.</p>
             </div>
          )}

          {lines.map((line) => {
            const activeStock = stockByLoc.filter(s => String(s.material_id) === String(line.material_id) && s.quantity > 0)
            const isSelected = selectedLines.includes(line.id)
            const focusStyle = getFocusColor(line.type)

            return (
              <div key={line.id} className={`bg-[#0f0f0f] border p-4 rounded-3xl shadow-md transition-colors ${isSelected ? 'border-purple-500/50 bg-purple-900/5' : 'border-gray-800 hover:border-gray-700'}`}>
                {/* DENSE HORIZONTAL ROW LAYOUT */}
                <div className="flex flex-wrap lg:flex-nowrap items-end gap-4">
                  
                  {/* Select Checkbox */}
                  <div className="pb-2.5 flex items-center justify-center shrink-0">
                    <button onClick={() => toggleLineSelect(line.id)} className="text-gray-600 hover:text-purple-400 transition-colors">
                      {isSelected ? <CheckSquare size={18} className="text-purple-500" /> : <Square size={18} />}
                    </button>
                  </div>

                  {/* Type */}
                  <div className="w-full sm:w-1/2 lg:w-40 shrink-0">
                    <label className={lbl}>Operation</label>
                    <div className="relative">
                      <select value={line.type} onChange={e => handleTypeChange(line.id, e.target.value)} className={`${inpt} pl-9 ${focusStyle}`}>
                        <option value="OUTBOUND">Issue (-)</option>
                        <option value="INBOUND">Receipt (+)</option>
                        <option value="TRANSFER">Transfer</option>
                      </select>
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        {line.type === 'INBOUND' ? <ArrowDownLeft size={14} className="text-purple-500"/> : line.type === 'TRANSFER' ? <ArrowRightLeft size={14} className="text-blue-500"/> : <ArrowUpRight size={14} className="text-yellow-500"/>}
                      </div>
                    </div>
                  </div>

                  {/* Good */}
                  <div className="w-full sm:w-1/2 lg:flex-1 shrink-0">
                    <label className={lbl}>Master Good</label>
                    <select value={line.material_id} onChange={e => handleMaterialSelect(line.id, e.target.value)} className={`${inpt} ${focusStyle}`}>
                      <option value="">-- Select Good --</option>
                      {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>

                  {/* Source */}
                  <div className={`w-full sm:w-1/2 shrink-0 ${line.type === 'TRANSFER' ? 'lg:w-40' : 'lg:w-56'}`}>
                    <label className={lbl}>{line.type === 'INBOUND' ? 'Dest Chamber' : 'Source Chamber'}</label>
                    <select required value={line.location_id} onChange={e => updateLine(line.id, 'location_id', e.target.value)} className={`${inpt} ${focusStyle}`}>
                      <option value="">-- Choose --</option>
                      {line.type === 'INBOUND' ? locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>) :
                       activeStock.map(s => <option key={s.location_id} value={s.location_id}>{locations.find(l=>l.id===s.location_id)?.name} ({s.quantity})</option>)}
                    </select>
                  </div>

                  {/* Dest (Transfer Only) */}
                  {line.type === 'TRANSFER' && (
                    <div className="w-full sm:w-1/2 lg:w-40 shrink-0 animate-in fade-in slide-in-from-left-4">
                      <label className={lbl}>Arrival Chamber</label>
                      <select required value={line.to_location_id} onChange={e => updateLine(line.id, 'to_location_id', e.target.value)} className={`${inpt} focus:border-blue-500 text-blue-400`}>
                        <option value="">-- Choose --</option>
                        {locations.filter(l => l.id !== line.location_id).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Qty */}
                  <div className="w-24 shrink-0">
                    <label className={lbl}>Quantity</label>
                    <input type="number" step="any" required value={line.quantity} onChange={e => updateLine(line.id, 'quantity', e.target.value)} className={`${inpt} text-center ${focusStyle}`} placeholder="0.0" />
                  </div>

                  {/* Notes (Single Line) */}
                  <div className="w-full lg:w-48 shrink-0">
                    <label className={lbl}>Notes</label>
                    <input 
                      placeholder="Details..." 
                      value={line.notes} 
                      onChange={e => updateLine(line.id, 'notes', e.target.value)} 
                      className={`${inpt} font-medium text-gray-300 italic ${focusStyle}`} 
                    />
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2 shrink-0">
                    <button type="button" onClick={() => duplicateLine(line)} className="h-[38px] w-[38px] flex items-center justify-center text-gray-500 bg-gray-900 border border-gray-800 hover:border-blue-500 hover:text-blue-400 rounded-xl transition-all" title="Duplicate Line">
                      <Copy size={14}/>
                    </button>
                    <button type="button" onClick={() => setLines(lines.filter(l => l.id !== line.id))} className="h-[38px] w-[38px] flex items-center justify-center text-gray-500 bg-gray-900 border border-gray-800 hover:border-red-500 hover:text-red-400 hover:bg-red-950/30 rounded-xl transition-all" title="Remove Line">
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          <button onClick={addLine} className="w-full py-4 border border-dashed border-gray-800 rounded-3xl bg-[#0a0a0a] text-gray-600 hover:border-purple-500/50 hover:bg-purple-900/10 hover:text-purple-400 transition-all font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 group mt-2 shadow-sm">
            <Plus size={14} className="group-hover:scale-110 transition-transform" /> Add Blank Line
          </button>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="flex justify-end pt-6 border-t border-gray-800/50 mt-8">
          <button onClick={handleSubmit} disabled={saving || lines.length === 0} className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 px-12 py-5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-3 shadow-xl shadow-purple-900/20 transition-all active:scale-95">
            <Save size={18}/> {saving ? 'Recording Ledger...' : 'Commit Batch to Ledger'}
          </button>
        </div>

      </div>
    </div>
  )
}

export default function InventoryPage() {
  return <Suspense fallback={<div className="min-h-screen bg-black" />}><TransactionEngine /></Suspense>
}