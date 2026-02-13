'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useOrganization } from './context/OrganizationContext'
import { MapPin, Package, AlertCircle, Shield } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function DashboardPage() {
  const { organization } = useOrganization()
  const [locations, setLocations] = useState<any[]>([])
  const [stock, setStock] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Moved inside the useEffect to satisfy Next.js strict build rules
    const fetchData = async () => {
      setLoading(true)
      
      const { data: locData } = await supabase.from('locations')
        .select('*')
        .eq('organization_id', organization.id)
        .order('name')
        
      const { data: stockData } = await supabase.from('view_current_stock')
        .select('*')
        .eq('organization_id', organization.id)
        .gt('current_stock', 0) 
        .order('name')

      if (locData) setLocations(locData)
      if (stockData) setStock(stockData)
      
      setLoading(false)
    }

    if (organization) {
      fetchData()
    }
  }, [organization]) // Now the dependency array is perfectly clean

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
      <div className="max-w-7xl mx-auto space-y-12">
        <header className="border-b border-gray-800 pb-6">
          <h1 className="text-4xl font-black uppercase tracking-tighter italic text-gray-100 mb-1">Command Center</h1>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
            <Shield size={12} className="text-purple-500" /> Live Inventory Overview
          </p>
        </header>

        {stock.length === 0 ? (
          <div className="text-center py-20 bg-gray-900 border border-gray-800 rounded-3xl">
            <Package size={48} className="mx-auto text-gray-700 mb-4" />
            <h2 className="text-xl font-black uppercase tracking-tight text-gray-400">The Keep is Empty</h2>
            <p className="text-xs font-bold text-gray-600 mt-2">Add goods to your master data and record transactions to see them here.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {groupedData.map((group) => (
              <section key={group.id} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-900 border border-gray-800 rounded-lg flex items-center justify-center">
                    <MapPin size={16} className="text-purple-500" />
                  </div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-gray-200">{group.name}</h2>
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-900 px-2 py-1 rounded-md">
                    {group.items.length} items
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {group.items.map((item: any) => (
                    <StockTile key={item.material_id} item={item} />
                  ))}
                </div>
              </section>
            ))}

            {unassignedItems.length > 0 && (
              <section className="space-y-4 pt-6 border-t border-gray-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-900 border border-gray-800 rounded-lg flex items-center justify-center">
                    <Package size={16} className="text-yellow-500" />
                  </div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-gray-200">Unassigned Goods</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {unassignedItems.map((item: any) => (
                    <StockTile key={item.material_id} item={item} />
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

function StockTile({ item }: { item: any }) {
  const isLowStock = item.reorder_point > 0 && item.current_stock <= item.reorder_point

  return (
    <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl hover:border-purple-500/50 transition-colors group relative overflow-hidden flex flex-col justify-between min-h-[100px]">
      <div className="flex justify-between items-start gap-2">
        <h3 className="text-xs font-bold leading-tight text-gray-300 group-hover:text-white transition-colors line-clamp-2">
          {item.name}
        </h3>
        {isLowStock && (
          <AlertCircle size={14} className="text-yellow-500 shrink-0" />
        )}
      </div>
      
      <div className="mt-4 flex items-end justify-between">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 truncate max-w-[50px]">
          {item.unit || 'QTY'}
        </p>
        <p className={`text-2xl font-black tracking-tighter leading-none ${isLowStock ? 'text-yellow-500' : 'text-purple-400'}`}>
          {item.current_stock}
        </p>
      </div>
    </div>
  )
}