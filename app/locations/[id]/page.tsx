'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { Package, ArrowLeft } from 'lucide-react'
import { useOrganization } from '../../context/OrganizationContext'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function LocationItemsPage({ params }: { params: Promise<{ id: string }> }) {
  const { organization } = useOrganization()
  const resolvedParams = use(params)
  const locId = resolvedParams.id
  
  const [items, setItems] = useState<any[]>([])
  const [locName, setLocName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!organization) return
      
      // 1. Get Location Name
      const { data: loc } = await supabase.from('locations').select('name').eq('id', locId).single()
      if (loc) setLocName(loc.name)

      // 2. Get all items in this location
      const { data } = await supabase
        .from('view_stock_by_location')
        .select('*')
        .eq('location_id', locId)
        .gt('quantity', 0) // Only show things actually there

      setItems(data || [])
      setLoading(false)
    }
    load()
  }, [locId, organization])

  if (loading) return <div className="p-8 text-white animate-pulse">Scanning Shelves...</div>

  return (
    <div className="min-h-screen p-4 md:p-8 text-white max-w-5xl mx-auto">
      <Link href="/locations" className="flex items-center gap-2 text-gray-500 hover:text-white mb-8 font-bold text-xs uppercase tracking-widest transition-colors">
        <ArrowLeft size={14} /> Back to Locations
      </Link>

      <div className="mb-12">
        <h1 className="text-5xl font-black uppercase tracking-tighter italic">{locName}</h1>
        <p className="text-gray-500 font-bold text-[10px] uppercase tracking-widest mt-2">
            Contents Inventory ({items.length} unique items)
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {items.length === 0 ? (
          <div className="bg-gray-900/30 border-2 border-dashed border-gray-800 p-20 rounded-[3rem] text-center text-gray-600 font-bold uppercase text-xs">
            This location is currently empty.
          </div>
        ) : (
          items.map(item => (
            <Link key={item.material_id} href={`/materials/${item.material_id}`} className="group">
                <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-3xl flex justify-between items-center group-hover:border-purple-500 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-purple-500 border border-gray-800">
                            <Package size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tight group-hover:text-purple-400">{item.material_name}</h3>
                            <span className="text-[10px] font-bold text-gray-500 uppercase">{item.category}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="block text-[10px] font-black text-gray-600 uppercase">Current Qty</span>
                        <span className="text-2xl font-black font-mono text-green-500">{item.quantity}</span>
                    </div>
                </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}