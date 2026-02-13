'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useOrganization } from '../context/OrganizationContext'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function ShoppingListPage() {
  const { organization } = useOrganization()
  const [items, setItems] = useState<any[]>([])
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchList = async () => {
    if (!organization) return
    const { data } = await supabase.from('view_current_stock').select('*').eq('organization_id', organization.id).eq('active', true)
    if (data) setItems(data.filter(i => i.current_stock <= i.reorder_point))
  }

  useEffect(() => { fetchList() }, [organization])

  const handlePurchase = async (item: any) => {
    if (!item.default_location_id) return alert("Error: Set a default location for this item first!")
    setProcessing(item.material_id)

    const { error } = await supabase.from('inventory_movements').insert([{
        material_id: item.material_id,
        location_id: item.default_location_id,
        quantity: item.lot_quantity,
        movement_type: 'INBOUND',
        organization_id: organization?.id
    }])

    if (error) alert(error.message)
    else fetchList()
    setProcessing(null)
  }

  return (
    <div className="min-h-screen p-8 text-white max-w-5xl mx-auto">
      <h1 className="text-4xl font-black uppercase mb-8 tracking-tighter">🛒 Restock List</h1>
      <div className="grid grid-cols-1 gap-4">
        {items.length === 0 ? <p className="text-gray-500 font-bold italic">Everything is fully stocked.</p> :
        items.map(item => (
          <div key={item.material_id} className="bg-gray-900 p-6 rounded-3xl border border-gray-800 flex justify-between items-center group hover:border-purple-500 transition-all">
            <div className="flex-1">
              <span className="text-[9px] font-black uppercase text-purple-400 bg-purple-900/20 px-2 py-0.5 rounded border border-purple-800">{item.category}</span>
              <h2 className="text-2xl font-black mt-2">{item.name}</h2>
              <p className="text-xs text-gray-500 mt-1 font-bold">In Stock: <span className="text-red-500">{item.current_stock}</span> / Min: {item.reorder_point} {item.unit}</p>
            </div>

            <div className="flex items-center gap-6">
                <div className="text-right">
                    <span className="block text-[10px] text-gray-600 font-black uppercase">Order Size</span>
                    <span className="text-xl font-mono font-black">+{item.lot_quantity}</span>
                </div>
                <button 
                  onClick={() => handlePurchase(item)}
                  disabled={processing === item.material_id}
                  className="bg-white text-black px-6 py-4 rounded-2xl font-black text-xs uppercase hover:bg-green-500 hover:text-white transition-all shadow-xl active:scale-95"
                >
                  {processing === item.material_id ? 'Wait...' : 'Mark Received'}
                </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}