'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useOrganization } from './context/OrganizationContext'
import { useRouter } from 'next/navigation'
import { MapPin, Package, AlertCircle, Shield, ArrowLeftRight } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function DashboardPage() {
  const router = useRouter()
  const { organization } = useOrganization()
  const [locations, setLocations] = useState<any[]>([])
  const [stock, setStock] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const { data: locData } = await supabase.from('locations').select('*').eq('organization_id', organization.id).order('name')
      const { data: stockData } = await supabase.from('view_current_stock').select('*').eq('organization_id', organization.id).gt('current_stock', 0).order('name')

      if (locData) setLocations(locData)
      if (stockData) setStock(stockData)
      setLoading(false)
    }

    if (organization) fetchData()
  }, [organization]) 

  const groupedData = locations.map(loc => ({
    ...loc,
    items: stock.filter(item => item.default_location_id === loc.id)
  })).filter(loc => loc.items.length > 0) 

  const unassignedItems = stock.filter(item => !item.default_location_id)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-purple-500">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Shield size={40} />
          <p className="text-xs font-black uppercase tracking-widest text-gray-500">Inspecting Keep...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto space-y-12 pb-20">
        <header className="border-b border-gray-800 pb-6">
          <h1 className="text-4xl font-black uppercase tracking-tighter italic text-gray-100 mb-1">Command Center</h1>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
            <Shield size={12} className="text-purple-500" /> Live Inventory Overview
          </p>
        </header>

        {stock.length === 0 ? (
          <div className="text-center py-20 bg-[#0f0f0f] border border-gray-800 rounded-[2.5rem]">
            <Package size={48} className="mx-auto text-gray-700 mb-4" />
            <h2 className="text-xl font-black uppercase tracking-tight text-gray-400">The Keep is Empty</h2>
            <p className="text-xs font-bold text-gray-600 mt-2">Add goods to your master data and record transactions to see them here.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedData.map((group) => (
              <section key={group.id} className="bg-[#0f0f0f] border border-gray-800 p-6 md:p-8 rounded-[2.5rem] shadow-2xl space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4">
                  <div className="w-10 h-10 bg-black border border-gray-800 rounded-xl flex items-center justify-center shadow-inner">
                    <MapPin size={20} className="text-purple-500" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-gray-200 leading-none">{group.name}</h2>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      {group.items.length} Unique Goods
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {group.items.map((item: any) => (
                    <StockTile key={item.material_id} item={item} router={router} />
                  ))}
                </div>
              </section>
            ))}

            {unassignedItems.length > 0 && (
              <section className="bg-[#1a110a] border border-yellow-900/30 p-6 md:p-8 rounded-[2.5rem] shadow-2xl space-y-6">
                <div className="flex items-center gap-3 border-b border-yellow-900/30 pb-4">
                  <div className="w-10 h-10 bg-black border border-yellow-900/50 rounded-xl flex items-center justify-center shadow-inner">
                    <Package size={20} className="text-yellow-500" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-yellow-500 leading-none">Unassigned Goods</h2>
                    <span className="text-[10px] font-black uppercase tracking-widest text-yellow-700">Needs Chamber Assignment</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {unassignedItems.map((item: any) => (
                    <StockTile key={item.material_id} item={item} router={router} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StockTile({ item, router }: { item: any, router: any }) {
  const isLowStock = item.reorder_point > 0 && item.current_stock <= item.reorder_point

  return (
    <div className="bg-black border border-gray-800 p-5 rounded-3xl hover:border-purple-500/50 transition-all group relative overflow-hidden flex flex-col justify-between min-h-[120px] shadow-lg">
      <div className="flex justify-between items-start gap-2">
        <h3 className="text-xs font-bold leading-tight text-gray-300 group-hover:text-white transition-colors line-clamp-2">
          {item.name}
        </h3>
        
        {/* Dynamic Top Right Icon (Alert or Transact) */}
        <div className="flex items-center gap-2">
          {isLowStock && <AlertCircle size={16} className="text-yellow-500 shrink-0" />}
          <button 
            onClick={(e) => { e.stopPropagation(); router.push(`/inventory/new?material_id=${item.material_id}`) }}
            className="p-1.5 bg-gray-900 rounded-lg text-gray-500 hover:text-purple-400 hover:bg-gray-800 transition-colors opacity-0 group-hover:opacity-100"
            title="Quick Transact"
          >
             <ArrowLeftRight size={14} />
          </button>
        </div>
      </div>
      
      <div className="mt-4 flex items-end justify-between">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 truncate max-w-[50px]">
          {item.unit || 'QTY'}
        </p>
        <p className={`text-3xl font-black tracking-tighter leading-none ${isLowStock ? 'text-yellow-500' : 'text-purple-400'}`}>
          {item.current_stock}
        </p>
      </div>
    </div>
  )
}