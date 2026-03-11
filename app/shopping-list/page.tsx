'use client'
import { useEffect, useState, Suspense } from 'react'
import { useOrganization } from '../context/OrganizationContext'
import { useRouter } from 'next/navigation'
import { ShoppingCart, AlertTriangle, Package, ArrowDownLeft, Settings2, MapPin } from 'lucide-react'
import { supabase } from '@/utils/supabase'

function ReplenishmentContent() {
  const router = useRouter()
  const { organization } = useOrganization()
  const [items, setItems] = useState<any[]>([])
  const [processing, setProcessing] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchList = async () => {
    if (!organization) return
    setLoading(true)
    
    // Fetch all stock data
    const { data, error } = await supabase
      .from('view_current_stock')
      .select('*')
      .eq('organization_id', organization.id)

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }

    if (data) {
      // Filter logic: Must be active, must have an MRP (>0), and stock must be <= MRP
      const procurementList = data.filter(i => 
        i.is_active !== false && 
        i.reorder_point > 0 && 
        i.current_stock <= i.reorder_point
      )
      setItems(procurementList)
    }
    setLoading(false)
  }

  useEffect(() => { fetchList() }, [organization])

  const handlePurchase = async (item: any) => {
    // Hard validation (UI should prevent reaching here, but backend lock is safe)
    if (!item.default_location_id || !item.lot_quantity || item.lot_quantity <= 0) {
      return alert("BLOCKED: Missing Master Data. Please configure a Default Store and Lot Quantity first.")
    }

    setProcessing(item.material_id)

    // Insert to the centralized movements ledger
    const { error } = await supabase.from('inventory_movements').insert([{
        material_id: item.material_id,
        location_id: item.default_location_id,
        quantity: item.lot_quantity,
        movement_type: 'INBOUND',
        organization_id: organization?.id,
        notes: 'Auto-Receipt via Procurement List'
    }])

    if (error) alert(error.message)
    else fetchList() // Refresh list to remove the purchased item
    
    setProcessing(null)
  }

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-purple-500 font-black uppercase tracking-widest">Calculating Procurement Needs...</div>

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans pb-32">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="border-b border-gray-800 pb-6">
          <h1 className="text-4xl font-black uppercase tracking-tighter italic text-gray-100 mb-1">Procurement</h1>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
            <ShoppingCart size={12} className="text-purple-500" /> Automated Restock List
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4">
          {items.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-gray-800 rounded-[2.5rem]">
              <Package size={32} className="mx-auto text-gray-800 mb-3" />
              <p className="text-gray-500 font-black uppercase tracking-widest text-[10px]">All Keep inventory levels are optimal.</p>
            </div>
          ) : (
            items.map(item => {
              // Master Data Health Check
              const isMissingData = !item.default_location_id || !item.lot_quantity || item.lot_quantity <= 0

              return (
                <div key={item.material_id} className="bg-[#0f0f0f] p-6 rounded-[2.5rem] border border-gray-800 flex flex-col md:flex-row justify-between md:items-center gap-6 group hover:border-purple-500/50 transition-all shadow-xl">
                  
                  {/* ITEM IDENTITY & STOCK */}
                  <div className="flex-1 cursor-pointer" onClick={() => router.push(`/materials/${item.material_id}`)}>
                    <div className="flex items-center gap-2 mb-2">
                       <span className="text-[8px] font-black uppercase tracking-widest text-purple-400 bg-purple-900/20 px-2 py-1 rounded-md border border-purple-800/50">{item.category || 'Good'}</span>
                    </div>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-gray-200 group-hover:text-purple-400 transition-colors">{item.name}</h2>
                    <div className="flex items-center gap-4 mt-2">
                       <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                         Stock Level: <span className="text-yellow-500 font-black text-sm ml-1">{item.current_stock}</span> <span className="text-gray-600">/ {item.reorder_point} {item.unit}</span>
                       </p>
                    </div>
                  </div>

                  {/* ACTION AREA */}
                  <div className="flex items-center gap-6 border-t md:border-t-0 border-gray-800 pt-4 md:pt-0">
                    
                    {isMissingData ? (
                      // MISSING DATA WARNING
                      <div className="flex items-center gap-4 bg-red-950/20 border border-red-900/30 p-4 rounded-2xl w-full md:w-auto">
                        <AlertTriangle className="text-red-500 shrink-0" size={20} />
                        <div>
                           <p className="text-[8px] font-black uppercase tracking-widest text-red-500 mb-1">Missing Config</p>
                           <button onClick={() => router.push(`/materials/${item.material_id}?edit=true`)} className="text-[10px] font-bold text-red-400 hover:text-white flex items-center gap-1 transition-colors">
                             <Settings2 size={12} /> Fix Master Data
                           </button>
                        </div>
                      </div>
                    ) : (
                      // READY TO ORDER
                      <>
                        <div className="text-right hidden sm:block">
                            <span className="block text-[8px] text-gray-600 font-black uppercase tracking-widest mb-1">Order Lot</span>
                            <span className="text-xl font-mono font-black text-purple-400">+{item.lot_quantity}</span>
                        </div>
                        <button 
                          onClick={() => handlePurchase(item)}
                          disabled={processing === item.material_id}
                          className="bg-purple-600 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-purple-500 disabled:opacity-50 text-white transition-all shadow-lg active:scale-95 flex items-center gap-2 w-full md:w-auto justify-center"
                        >
                          {processing === item.material_id ? (
                            'Processing...'
                          ) : (
                            <><ArrowDownLeft size={14} /> Receive {item.lot_quantity}</>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default function ShoppingListPage() { return <Suspense fallback={<div className="min-h-screen bg-black" />}><ReplenishmentContent /></Suspense> }