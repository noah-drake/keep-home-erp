'use client'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useOrganization } from './context/OrganizationContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import StarterKits from './components/StarterKits'
import { 
  MapPin, Package, AlertCircle, Shield, ArrowRightLeft, BookOpen, 
  Plus, ClipboardCheck, ShoppingCart, History, ArrowDownLeft, ArrowUpRight, TrendingUp
} from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function DashboardContent() {
  const router = useRouter()
  const { organization } = useOrganization()
  
  const [groupedData, setGroupedData] = useState<any[]>([])
  const [unassignedItems, setUnassignedItems] = useState<any[]>([])
  const [totalItems, setTotalItems] = useState<number | null>(null)
  
  // Dashboard Telemetry State
  const [lowStockCount, setLowStockCount] = useState(0)
  const [mrpItemCount, setMrpItemCount] = useState(0)
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    if (!organization) return
    setLoading(true)
    
    const [locRes, matRes, countRes, stockRes, unitRes, activityRes] = await Promise.all([
      supabase.from('locations').select('*').eq('organization_id', organization.id).order('name'),
      supabase.from('materials').select('*').eq('organization_id', organization.id).eq('is_active', true),
      supabase.from('materials').select('*', { count: 'exact', head: true }).eq('organization_id', organization.id),
      supabase.from('view_stock_by_location').select('*').eq('organization_id', organization.id).gt('quantity', 0),
      supabase.from('units').select('*').or(`organization_id.eq.${organization.id},organization_id.is.null`),
      supabase.from('inventory_movements').select('*, materials(name), locations(name)').eq('organization_id', organization.id).order('created_at', { ascending: false }).limit(15)
    ])

    const locationsList = locRes.data || []
    const materialsList = matRes.data || []
    const stockList = stockRes.data || []
    const unitsList = unitRes.data || []
    
    if (activityRes.data) setRecentActivity(activityRes.data)

    const displayCards: any[] = []
    let lowStockTracker = 0
    let mrpTracker = 0

    materialsList.forEach(mat => {
      const unit = unitsList.find(u => String(u.id) === String(mat.unit_id)) || unitsList.find(u => u.name === mat.unit_id)
      const unitStr = unit ? (unit.abbreviation || unit.name) : 'QTY'
      const stocksForMat = stockList.filter(s => String(s.material_id) === String(mat.id))
      const threshold = mat.is_mrp_enabled ? (mat.reorder_point || 0) : 0
      
      if (mat.is_mrp_enabled) mrpTracker++
      
      let totalStockForMat = 0

      if (stocksForMat.length > 0) {
         stocksForMat.forEach(stock => {
           totalStockForMat += stock.quantity
           displayCards.push({
             id: `${mat.id}-${stock.location_id}`, 
             material_id: mat.id, name: mat.name, unit: unitStr,
             reorder_point: mat.reorder_point, is_mrp_enabled: mat.is_mrp_enabled,
             location_id: stock.location_id, quantity: stock.quantity
           })
         })
      } else {
         displayCards.push({
           id: `${mat.id}-default`, material_id: mat.id, name: mat.name, unit: unitStr,
           reorder_point: mat.reorder_point, is_mrp_enabled: mat.is_mrp_enabled,
           location_id: mat.default_location_id, quantity: 0 
         })
      }

      if (totalStockForMat <= threshold) lowStockTracker++
    })

    setLowStockCount(lowStockTracker)
    setMrpItemCount(mrpTracker)

    const newGroupedData = locationsList.map(loc => ({
      ...loc,
      items: displayCards.filter(card => card.location_id === loc.id).sort((a, b) => a.name.localeCompare(b.name))
    })).filter(loc => loc.items.length > 0)

    const newUnassignedItems = displayCards.filter(card => !card.location_id).sort((a, b) => a.name.localeCompare(b.name))

    setGroupedData(newGroupedData)
    setUnassignedItems(newUnassignedItems)
    setTotalItems(countRes.count || 0)
    
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [organization]) 

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-purple-500">
      <div className="animate-pulse flex flex-col items-center gap-4"><Shield size={40} /><p className="text-xs font-black uppercase tracking-widest text-gray-500">Inspecting Keep...</p></div>
    </div>
  )

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
            <div className="flex items-center gap-3 border-b border-gray-800 pb-4"><h2 className="text-[10px] font-black uppercase tracking-widest text-purple-500">Option 1: One-Click Starter Kits</h2></div>
            <StarterKits onComplete={fetchData} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-gray-800/50">
            <Link href="/materials/new" className="bg-[#0f0f0f] border border-gray-800 p-8 rounded-[2.5rem] hover:border-blue-500 transition-all group flex items-center gap-6 shadow-xl">
              <div className="w-14 h-14 bg-blue-900/10 rounded-2xl flex items-center justify-center border border-blue-500/20 text-blue-500 group-hover:scale-110 transition-transform"><BookOpen size={24} /></div>
              <div><h3 className="font-black uppercase tracking-tight text-xl mb-1 text-gray-200">Global Registry</h3><p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Search & Import single items.</p></div>
            </Link>
            <Link href="/materials/new?mode=manual" className="bg-[#0f0f0f] border border-gray-800 p-8 rounded-[2.5rem] hover:border-gray-500 transition-all group flex items-center gap-6 shadow-xl">
              <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center border border-gray-800 text-gray-400 group-hover:scale-110 transition-transform"><Plus size={24} /></div>
              <div><h3 className="font-black uppercase tracking-tight text-xl mb-1 text-gray-200">Manual Entry</h3><p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Define custom goods from scratch.</p></div>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // STATE 2: ACTIVE COMMAND CENTER
  // ==========================================
  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans pb-32">
      <div className="max-w-[1600px] mx-auto">
        
        {/* ROW 1: ULTRA-DENSE HEADER */}
        <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-gray-800 pb-4 mb-6">
          <div className="flex-shrink-0">
            <h1 className="text-3xl font-black uppercase tracking-tighter italic text-gray-100 mb-1">Command Center</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <Shield size={12} className="text-purple-500" /> {organization.name} Operations
            </p>
          </div>

          <div className="flex flex-wrap xl:flex-nowrap items-center justify-start xl:justify-end gap-3 flex-1">
            
            {/* System Pulse - Tight integration */}
            <div className="flex items-center gap-4 bg-[#0f0f0f] border border-gray-800 px-4 py-2 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2.5">
                <Package size={14} className="text-purple-500" />
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-purple-400 leading-none">Active</p>
                  <p className="text-lg font-black tracking-tighter leading-none mt-1">{totalItems}</p>
                </div>
              </div>
              <div className="w-px h-6 bg-gray-800"></div>
              <div className="flex items-center gap-2.5">
                <TrendingUp size={14} className="text-yellow-500" />
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-yellow-500 leading-none">Restock</p>
                  <p className="text-lg font-black tracking-tighter leading-none mt-1 flex items-baseline gap-1">
                    {lowStockCount} <span className="text-xs text-gray-600 font-bold">/ {mrpItemCount} MRP</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions - Compact */}
            <div className="flex items-center gap-2">
              <button onClick={() => router.push('/inventory')} className="bg-[#0f0f0f] border border-gray-800 hover:border-purple-500 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-sm group">
                <ArrowRightLeft size={14} className="text-purple-500 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-300">Transact</span>
              </button>
              <button onClick={() => router.push('/inventory/count')} className="bg-[#0f0f0f] border border-gray-800 hover:border-blue-500 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-sm group">
                <ClipboardCheck size={14} className="text-blue-500 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-300 hidden sm:block">Audit</span>
              </button>
              <button onClick={() => router.push('/materials/new')} className="bg-[#0f0f0f] border border-gray-800 hover:border-green-500 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-sm group">
                <Plus size={14} className="text-green-500 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-300 hidden sm:block">Item</span>
              </button>
              <button onClick={() => router.push('/shopping-list')} className="bg-[#0f0f0f] border border-gray-800 hover:border-yellow-500 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-sm group relative overflow-hidden">
                {lowStockCount > 0 && <span className="absolute top-0 right-0 w-full h-full bg-yellow-500/10 pointer-events-none animate-pulse"></span>}
                <ShoppingCart size={14} className="text-yellow-500 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-300 hidden sm:block relative z-10">Shop</span>
              </button>
            </div>
          </div>
        </header>

        {/* TWO COLUMN LAYOUT */}
        <div className="flex flex-col xl:flex-row items-start gap-6 animate-in fade-in slide-in-from-bottom-4">
          
          {/* LEFT: VISUAL INVENTORY - AUTO-PACKING MASONRY */}
          <div className="flex-1 flex flex-row flex-wrap items-start gap-5 w-full">
            {groupedData.length === 0 && unassignedItems.length === 0 ? (
              <div className="w-full text-center py-20 bg-[#0f0f0f] border border-gray-800 rounded-[2.5rem]">
                <Package size={48} className="mx-auto text-gray-700 mb-4" />
                <h2 className="text-xl font-black uppercase tracking-tight text-gray-400">All Master Items Inactive</h2>
                <p className="text-xs font-bold text-gray-600 mt-2">Activate items in your registry to see them on the dashboard.</p>
              </div>
            ) : (
              <>
                {groupedData.map((group) => {
                  const count = group.items.length
                  // The wrapping magic: Small containers won't force line breaks if there's room.
                  const sizeClass = count === 1 ? 'w-full sm:w-[260px]' : 
                                    count === 2 ? 'w-full sm:w-[540px]' : 
                                    'w-full'
                  
                  const gridClass = count === 1 ? 'grid-cols-1' : 
                                    count === 2 ? 'grid-cols-1 sm:grid-cols-2' : 
                                    'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3'

                  return (
                    <section key={group.id} className={`bg-[#0f0f0f] border border-gray-800 p-5 rounded-[2.5rem] shadow-lg shrink-0 flex-grow-0 ${sizeClass}`}>
                      <div className="flex items-center justify-between border-b border-gray-800/50 pb-3 mb-4">
                        <Link href={`/locations/${group.id}`} className="flex items-center gap-2.5 group/loc">
                          <div className="w-7 h-7 bg-black border border-gray-800 rounded-lg flex items-center justify-center shadow-inner group-hover/loc:border-purple-500/50 transition-colors">
                            <MapPin size={14} className="text-purple-500 group-hover/loc:scale-110 transition-transform" />
                          </div>
                          <h2 className="text-base font-black uppercase tracking-tight text-gray-200 leading-none truncate max-w-[180px] group-hover/loc:text-purple-400 transition-colors">{group.name}</h2>
                        </Link>
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-600 bg-gray-900 px-2 py-1 rounded-md">{count}</span>
                      </div>

                      <div className={`grid gap-3 ${gridClass}`}>
                        {group.items.map((item: any) => <StockTile key={item.id} item={item} router={router} />)}
                      </div>
                    </section>
                  )
                })}

                {/* UNASSIGNED ITEMS */}
                {unassignedItems.length > 0 && (
                  <section className={`bg-yellow-950/10 border border-yellow-900/30 p-5 rounded-[2.5rem] shadow-lg shrink-0 flex-grow-0 ${
                    unassignedItems.length === 1 ? 'w-full sm:w-[260px]' : 
                    unassignedItems.length === 2 ? 'w-full sm:w-[540px]' : 
                    'w-full'
                  }`}>
                    <div className="flex items-center justify-between border-b border-yellow-900/30 pb-3 mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-black border border-yellow-900/50 rounded-lg flex items-center justify-center shadow-inner"><Package size={14} className="text-yellow-500" /></div>
                        <h2 className="text-base font-black uppercase tracking-tight text-yellow-500 leading-none truncate max-w-[180px]">Unassigned</h2>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-yellow-700 bg-yellow-950/50 px-2 py-1 rounded-md">{unassignedItems.length}</span>
                    </div>
                    <div className={`grid gap-3 ${
                      unassignedItems.length === 1 ? 'grid-cols-1' : 
                      unassignedItems.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 
                      'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3'
                    }`}>
                      {unassignedItems.map((item: any) => <StockTile key={item.id} item={item} router={router} />)}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>

          {/* RIGHT: RECESSED TELEMETRY FEED */}
          <div className="w-full xl:w-[360px] shrink-0">
            <div className="relative bg-black/60 backdrop-blur-2xl border border-gray-800/60 rounded-[2.5rem] p-6 shadow-[inset_0_0_40px_rgba(0,0,0,0.6)] sticky top-24 overflow-hidden">
               
               {/* Terminal Top Glow */}
               <div className="absolute top-0 left-[15%] right-[15%] h-[1px] bg-gradient-to-r from-transparent via-purple-500/60 to-transparent"></div>
               <div className="absolute inset-0 bg-gradient-to-b from-purple-900/5 to-transparent pointer-events-none"></div>

               <div className="relative z-10">
                 <div className="flex items-center justify-between border-b border-gray-800/50 pb-4 mb-5">
                     <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2"><History size={14} className="text-purple-500/70"/> Ledger Feed</h3>
                     <Link href="/history" className="text-[9px] text-purple-400 font-black tracking-widest hover:text-white transition-colors bg-purple-500/10 hover:bg-purple-500/20 px-3 py-1.5 rounded-lg uppercase">View All</Link>
                 </div>
                 
                 <div className="flex flex-col gap-3">
                   {recentActivity.length === 0 ? (
                     <p className="text-[10px] text-gray-600 font-bold italic py-4 text-center">No recent movements.</p>
                   ) : (
                     recentActivity.map(act => (
                       <div key={act.id} className="flex items-center gap-3 bg-[#0f0f0f]/80 border border-gray-800/60 p-3 rounded-2xl group hover:bg-[#1a1a1a] transition-colors">
                         <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center border ${act.movement_type.includes('IN') ? 'bg-purple-900/20 border-purple-500/30 text-purple-400' : act.movement_type.includes('TRANSFER') ? 'bg-blue-900/20 border-blue-500/30 text-blue-400' : 'bg-yellow-900/20 border-yellow-500/30 text-yellow-500'}`}>
                            {act.movement_type.includes('IN') ? <ArrowDownLeft size={12}/> : act.movement_type.includes('TRANSFER') ? <ArrowRightLeft size={12}/> : <ArrowUpRight size={12}/>}
                         </div>
                         <div className="truncate flex-1">
                           <p className="text-[10px] font-bold text-gray-300 truncate group-hover:text-white transition-colors">{act.materials?.name || 'Unknown'}</p>
                           <p className="text-[8px] font-black uppercase tracking-widest text-gray-600 truncate mt-0.5">{act.locations?.name || 'Unassigned'}</p>
                         </div>
                         <span className={`shrink-0 text-xs font-black ${act.quantity > 0 ? 'text-purple-400' : 'text-yellow-500'}`}>
                           {act.quantity > 0 ? `+${act.quantity}` : act.quantity}
                         </span>
                       </div>
                     ))
                   )}
                 </div>
               </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// Sub-component for individual stock cards
function StockTile({ item, router }: { item: any, router: any }) {
  const threshold = item.is_mrp_enabled ? (item.reorder_point || 0) : 0
  const isOut = item.quantity <= 0
  const isLowStock = !isOut && item.quantity <= threshold

  return (
    <div 
      onClick={() => router.push(`/materials/${item.material_id}`)}
      className={`cursor-pointer border p-3.5 rounded-2xl transition-all group relative overflow-hidden flex flex-col justify-between min-h-[90px] shadow-sm hover:shadow-md ${
        isOut ? 'bg-red-950/10 border-red-900/40 hover:border-red-500/60' :
        isLowStock ? 'bg-yellow-950/10 border-yellow-900/40 hover:border-yellow-500/60' : 
        'bg-black border-gray-800 hover:border-purple-500/50'
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <h3 className={`text-[11px] font-bold leading-tight transition-colors line-clamp-2 ${
          isOut ? 'text-red-200 group-hover:text-red-100' : 
          isLowStock ? 'text-yellow-200 group-hover:text-yellow-100' : 
          'text-gray-300 group-hover:text-white'
        }`}>
          {item.name}
        </h3>
        
        {/* Quick Transact Button (Replaces the Alert Icon on Hover) */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="group-hover:hidden">
            {isOut ? <AlertCircle size={14} className="text-red-500" /> : 
             isLowStock ? <AlertCircle size={14} className="text-yellow-500" /> : null}
          </div>
          
          <button 
            onClick={(e) => { e.stopPropagation(); router.push(`/inventory?material_id=${item.material_id}`) }}
            className={`hidden group-hover:flex p-1 rounded-md transition-colors ${
              isOut ? 'bg-red-900/50 text-red-100 hover:bg-red-500' : 
              isLowStock ? 'bg-yellow-900/50 text-yellow-100 hover:bg-yellow-500' : 
              'bg-gray-900 text-purple-400 hover:bg-purple-500/20'
            }`}
            title="Quick Transact"
          >
             <ArrowRightLeft size={12} />
          </button>
        </div>
      </div>
      
      <div className="mt-2 flex items-end justify-between">
        <p className={`text-[8px] font-black uppercase tracking-widest truncate max-w-[50px] ${
          isOut ? 'text-red-500/70' : isLowStock ? 'text-yellow-600' : 'text-gray-600'
        }`}>
          {item.unit}
        </p>
        <p className={`text-2xl font-black tracking-tighter leading-none ${
          isOut ? 'text-red-500' : isLowStock ? 'text-yellow-500' : 'text-purple-400'
        }`}>
          {item.quantity}
        </p>
      </div>
    </div>
  )
}

export default function DashboardPage() { return <Suspense fallback={<div className="min-h-screen bg-black" />}><DashboardContent /></Suspense> }