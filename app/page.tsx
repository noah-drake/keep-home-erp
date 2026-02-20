'use client'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useOrganization } from './context/OrganizationContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import StarterKits from './components/StarterKits'
import { MapPin, Package, AlertCircle, Shield, ArrowLeftRight, BookOpen, Plus } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function DashboardContent() {
  const router = useRouter()
  const { organization } = useOrganization()
  
  const [locations, setLocations] = useState<any[]>([])
  const [stock, setStock] = useState<any[]>([])
  const [totalItems, setTotalItems] = useState<number | null>(null) // Used for Split-Render
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    if (!organization) return
    setLoading(true)
    
    // 1. Fetch Locations
    const { data: locData } = await supabase.from('locations')
      .select('*')
      .eq('organization_id', organization.id)
      .order('name')
      
    // 2. Fetch Active Stock for the Dashboard
    const { data: stockData } = await supabase.from('view_current_stock')
      .select('*')
      .eq('organization_id', organization.id)
      .gt('current_stock', 0) 
      .order('name')

    // 3. Count total Master Data items to determine if we are in "Onboarding Mode"
    const { count } = await supabase.from('materials')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization.id)

    if (locData) setLocations(locData)
    if (stockData) setStock(stockData)
    setTotalItems(count || 0)
    
    setLoading(false)
  }

  useEffect(() => { 
    fetchData() 
  }, [organization]) 

  // Group stock by location Chamber
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

  // ==========================================
  // STATE 1: ONBOARDING (Empty Keep)
  // ==========================================
  if (totalItems === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 flex flex-col justify-center items-center text-white font-sans pb-32">
        <div className="max-w-5xl w-full space-y-12">
          <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <h1 className="text-5xl font-black uppercase italic tracking-tighter text-gray-100">Establish Master Data</h1>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Your registry is empty. Initialize goods to begin tracking.</p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
               <h2 className="text-[10px] font-black uppercase tracking-widest text-purple-500">Option 1: One-Click Starter Kits</h2>
            </div>
            {/* The StarterKits component triggers fetchData() to instantly reveal the Dashboard when done */}
            <StarterKits onComplete={fetchData} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-gray-800/50">
            <Link href="/materials/new" className="bg-[#0f0f0f] border border-gray-800 p-8 rounded-[2.5rem] hover:border-blue-500 transition-all group flex items-center gap-6 shadow-xl">
              <div className="w-14 h-14 bg-blue-900/10 rounded-2xl flex items-center justify-center border border-blue-500/20 text-blue-500 group-hover:scale-110 transition-transform"><BookOpen size={24} /></div>
              <div>
                <h3 className="font-black uppercase tracking-tight text-xl mb-1 text-gray-200">Global Registry</h3>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Search & Import single items.</p>
              </div>
            </Link>

            <Link href="/materials/new?mode=manual" className="bg-[#0f0f0f] border border-gray-800 p-8 rounded-[2.5rem] hover:border-gray-500 transition-all group flex items-center gap-6 shadow-xl">
              <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center border border-gray-800 text-gray-400 group-hover:scale-110 transition-transform"><Plus size={24} /></div>
              <div>
                <h3 className="font-black uppercase tracking-tight text-xl mb-1 text-gray-200">Manual Entry</h3>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Define custom goods from scratch.</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // STATE 2: ACTIVE KEEP (The Original Dashboard)
  // ==========================================
  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto space-y-12 pb-20">
        
        {/* DASHBOARD HEADER */}
        <header className="border-b border-gray-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic text-gray-100 mb-1">Command Center</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <Shield size={12} className="text-purple-500" /> Live Inventory Overview
            </p>
          </div>
        </header>

        {stock.length === 0 ? (
          <div className="text-center py-20 bg-[#0f0f0f] border border-gray-800 rounded-[2.5rem]">
            <Package size={48} className="mx-auto text-gray-700 mb-4" />
            <h2 className="text-xl font-black uppercase tracking-tight text-gray-400">Inventory Exhausted</h2>
            <p className="text-xs font-bold text-gray-600 mt-2">All tracked goods are currently at 0. Record transactions to restock.</p>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            {/* GROUPED LOCATIONS */}
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

            {/* UNASSIGNED ITEMS */}
            {unassignedItems.length > 0 && (
              <section className="bg-yellow-950/10 border border-yellow-900/30 p-6 md:p-8 rounded-[2.5rem] shadow-2xl space-y-6">
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

// Sub-component for individual stock cards
function StockTile({ item, router }: { item: any, router: any }) {
  const isLowStock = item.reorder_point > 0 && item.current_stock <= item.reorder_point

  return (
    <div 
      onClick={() => router.push(`/materials/${item.material_id}`)}
      className="cursor-pointer bg-black border border-gray-800 p-5 rounded-3xl hover:border-purple-500/50 transition-all group relative overflow-hidden flex flex-col justify-between min-h-[120px] shadow-lg"
    >
      <div className="flex justify-between items-start gap-2">
        <h3 className="text-xs font-bold leading-tight text-gray-300 group-hover:text-white transition-colors line-clamp-2">
          {item.name}
        </h3>
        
        {/* Dynamic Top Right Icons */}
        <div className="flex items-center gap-2">
          {isLowStock && <AlertCircle size={16} className="text-yellow-500 shrink-0" />}
          
          {/* Quick Transact Button */}
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              // Changed /inventory/new to /inventory to match your transaction engine route
              router.push(`/inventory?material_id=${item.material_id}`) 
            }}
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

export default function DashboardPage() { return <Suspense fallback={<div className="min-h-screen bg-black" />}><DashboardContent /></Suspense> }