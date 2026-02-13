'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Package, TrendingDown, ArrowRight, ShoppingCart } from 'lucide-react'
import { useOrganization } from './context/OrganizationContext'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Dashboard() {
  const { organization } = useOrganization()
  const [items, setItems] = useState<any[]>([])
  const [stagnantCount, setStagnantCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    if (!organization) return 
    setLoading(true)

    // 1. Fetch Current Stock View
    const { data: stock } = await supabase
      .from('view_current_stock') 
      .select('*')
      .eq('organization_id', organization.id)
      .eq('active', true)
      .order('name', { ascending: true })

    // 2. Fetch Stagnant Stock (No movements in 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { data: recentMoves } = await supabase
      .from('inventory_movements')
      .select('material_id')
      .gt('created_at', thirtyDaysAgo.toISOString())

    const movedIds = new Set((recentMoves || []).map(m => m.material_id))
    const stagnant = (stock || []).filter(item => !movedIds.has(item.material_id) && item.current_stock > 0)

    setItems(stock || [])
    setStagnantCount(stagnant.length)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [organization])

  const criticalItems = items.filter(i => i.current_stock <= i.reorder_point)

  if (loading) return <div className="min-h-screen p-8 text-white animate-pulse">Scanning Inventory...</div>

  return (
    <div className="min-h-screen p-4 md:p-8 text-white font-sans max-w-7xl mx-auto">
      
      {/* HEADER */}
      <div className="flex justify-between items-end mb-10">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic">Control Center</h1>
          <p className="text-gray-500 font-bold text-[10px] uppercase tracking-[0.3em] mt-1">
            Active Plant: <span className="text-green-400">{organization?.name}</span>
          </p>
        </div>
        <Link href="/inventory" className="bg-white text-black px-6 py-3 rounded-2xl font-black text-xs uppercase hover:bg-purple-600 hover:text-white transition-all shadow-xl active:scale-95">
          New Transaction
        </Link>
      </div>

      {/* RE-DEFINED STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {/* SHOPPING TRIP VOLUME */}
        <div className="bg-gray-900/50 p-8 rounded-[2.5rem] border border-gray-800 shadow-2xl relative overflow-hidden group">
          <ShoppingCart className="absolute -right-4 -top-4 text-gray-800 w-32 h-32 group-hover:text-yellow-900/20 transition-colors" />
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest relative z-10">Shopping Trip Volume</span>
          <div className="mt-4 flex items-baseline gap-2 relative z-10">
            <span className="text-6xl font-black text-yellow-500">{criticalItems.length}</span>
            <span className="text-xs text-gray-600 font-bold uppercase italic">Items Needed</span>
          </div>
          <Link href="/shopping-list" className="mt-4 inline-flex items-center gap-2 text-[10px] font-black text-purple-500 uppercase hover:text-white relative z-10 transition-colors">
            Open Shopping List <ArrowRight size={12} />
          </Link>
        </div>

        {/* STAGNANT STOCK */}
        <div className="bg-gray-900/50 p-8 rounded-[2.5rem] border border-gray-800 shadow-2xl relative overflow-hidden group">
          <TrendingDown className="absolute -right-4 -top-4 text-gray-800 w-32 h-32 group-hover:text-red-900/20 transition-colors" />
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest relative z-10">Stagnant Stock</span>
          <div className="mt-4 flex items-baseline gap-2 relative z-10">
            <span className="text-6xl font-black text-red-400">{stagnantCount}</span>
            <span className="text-xs text-gray-600 font-bold uppercase italic">Untouched 30+ Days</span>
          </div>
          <p className="mt-4 text-[10px] font-bold text-gray-600 uppercase italic">Consider lowering reorder points.</p>
        </div>
      </div>
      
      {/* INVENTORY GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => {
          const isLow = item.current_stock <= item.reorder_point;
          return (
            <Link href={`/materials/${item.material_id}`} key={item.material_id} className="block group">
              <div className={`p-8 rounded-[2.5rem] border-2 transition-all duration-500 h-full flex flex-col justify-between ${
                isLow ? 'bg-red-950/5 border-red-900/50 hover:border-red-500' : 'bg-gray-900/40 border-gray-800 hover:border-purple-600'
              }`}>
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-purple-400 bg-purple-900/20 px-3 py-1 rounded-full border border-purple-800/50">
                      {item.category || 'General'}
                    </span>
                    {isLow && <div className="flex items-center gap-1 text-red-500 animate-pulse"><AlertTriangle size={14} /><span className="text-[10px] font-black uppercase">Refill</span></div>}
                  </div>
                  <h2 className="text-3xl font-black tracking-tighter uppercase">{item.name}</h2>
                </div>
                <div className="mt-10 pt-6 border-t border-gray-800/50 flex justify-between items-end">
                  <div>
                    <span className="block text-[10px] font-black text-gray-700 uppercase tracking-widest mb-1">On Hand</span>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-5xl font-black font-mono tracking-tighter ${isLow ? 'text-red-500' : 'text-green-500'}`}>{item.current_stock}</span>
                      <span className="text-[10px] text-gray-600 font-black uppercase">{item.unit}</span>
                    </div>
                  </div>
                  <ArrowRight size={20} className="text-gray-800 group-hover:text-purple-500 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}