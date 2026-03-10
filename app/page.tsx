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
  
  const [activeLocs, setActiveLocs] = useState<any[]>([])
  const [ghostLocs, setGhostLocs] = useState<any[]>([])
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

    // Process locations with items vs ghost locations, plus add default items count
    const processedLocations = locationsList.map(loc => {
      const items = displayCards.filter(card => card.location_id === loc.id).sort((a, b) => a.name.localeCompare(b.name))
      const defaultCount = materialsList.filter(m => m.default_location_id === loc.id).length
      return { ...loc, items, defaultCount }
    })

    const active = processedLocations.filter(loc => loc.items.length > 0)
    const ghost = processedLocations.filter(loc => loc.items.length === 0)
    const newUnassignedItems = displayCards.filter(card => !card.location_id).sort((a, b) => a.name.localeCompare(b.name))

    setActiveLocs(active)
    setGhostLocs(ghost)
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
        
        {/* ROW 1: TIGHTLY PACKED HEADER */}
        <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 border-b border-gray-800 pb-5 mb-6">
          <div className="flex-shrink-0">
            <h1 className="text-3xl font-black uppercase tracking-tighter italic text-gray-100 leading-none">My Keep</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2 mt-1.5">
              <Shield size={12} className="text-purple-500" /> {organization.name} Operations
            </p>
          </div>

          <div className="flex flex-wrap xl:flex-nowrap items-center justify-start xl:justify-end gap-3 flex-1">
            
            {/* System Pulse - Embedded in Header */}
            <div className="flex items-center gap-4 bg-black border border-gray-800/60 px-4 py-2 rounded-xl">
              <div className="flex items-center gap-2.5">
                <Package size={14} className="text-gray-500" />
                <div className="flex items-baseline gap-1.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Active</p>
                  <p className="text-lg font-black tracking-tighter text-gray-200">{totalItems}</p>
                </div>
              </div>
              <div className="w-px h-5 bg-gray-800"></div>
              <div className="flex items-center gap-2.5">
                <TrendingUp size={14} className="text-yellow-600" />
                <div className="flex items-baseline gap-1.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-yellow-600">Restock</p>
                  <p className="text-lg font-black tracking-tighter text-yellow-500 flex items-baseline gap-1">
                    {lowStockCount} <span className="text-[10px] text-gray-500 font-bold">/ {mrpItemCount} MRP</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions - Compact */}
            <div className="flex items-center gap-2">
              <button onClick={() => router.push('/inventory')} className="bg-[#0f0f0f] border border-gray-800 hover:border-purple-500 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all group">
                <ArrowRightLeft size={14} className="text-purple-500 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-300">Transact</span>
              </button>
              <button onClick={() => router.push('/inventory/count')} className="bg-[#0f0f0f] border border-gray-800 hover:border-blue-500 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all group">
                <ClipboardCheck size={14} className="text-blue-500 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-300 hidden sm:block">Audit</span>
              </button>
              <button onClick={() => router.push('/materials/new')} className="bg-[#0f0f0f] border border-gray-800 hover:border-green-500 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all group">
                <Plus size={14} className="text-green-500 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-300 hidden sm:block">Item</span>
              </button>
              <button onClick={() => router.push('/shopping-list')} className="bg-[#0f0f0f] border border-gray-800 hover:border-yellow-500 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all group relative overflow-hidden">
                {lowStockCount > 0 && <span className="absolute top-0 right-0 w-full h-full bg-yellow-500/10 pointer-events-none animate-pulse"></span>}
                <ShoppingCart size={14} className="text-yellow-500 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-300 hidden sm:block relative z-10">Shop</span>
              </button>
            </div>
          </div>
        </header>

        {/* MAIN LAYOUT: LOCATIONS (LEFT) | LEDGER (RIGHT) */}
        <div className="flex flex-col xl:flex-row items-start gap-8 animate-in fade-in slide-in-from-bottom-4">
          
          {/* LEFT: VISUAL INVENTORY - CSS MASONRY */}
          <div className="flex-1 w-full">
            {activeLocs.length === 0 && unassignedItems.length === 0 && ghostLocs.length === 0 ? (
              <div className="w-full text-center py-20 border border-dashed border-gray-800 rounded-3xl">
                <Package size={32} className="mx-auto text-gray-700 mb-3" />
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-500">All Master Items Inactive</h2>
              </div>
            ) : (
              // The Magic Masonry Container
              <div className="columns-1 md:columns-2 gap-5 w-full">
                
                {/* 1. ACTIVE LOCATIONS */}
                {activeLocs.map((group) => {
                  return (
                    // Lightened Location Containers: bg-[#121212]
                    <section key={group.id} className="break-inside-avoid inline-block w-full mb-5 border border-gray-800/80 rounded-[1.5rem] bg-[#121212] overflow-hidden shadow-lg hover:border-gray-600 transition-colors">
                      {/* Location Header - Lifted to bg-[#1a1a1a] */}
                      <div className="bg-[#1a1a1a] flex items-center justify-between px-4 py-3.5 border-b border-gray-800/80">
                        <Link href={`/locations/${group.id}`} className="flex items-center gap-2.5 group/loc">
                          <MapPin size={14} className="text-purple-500 group-hover/loc:scale-110 transition-transform" />
                          <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-100 group-hover/loc:text-purple-400 transition-colors">{group.name}</h2>
                        </Link>
                        <div className="flex items-center gap-2">
                          <span className="text-[7px] font-black uppercase tracking-widest text-gray-500 bg-black/60 px-2 py-1.5 rounded-md border border-gray-800">{group.defaultCount} Default</span>
                          <span className="text-[8px] font-black uppercase tracking-widest text-purple-400 bg-purple-900/20 px-2 py-1 rounded-md border border-purple-500/30">{group.items.length} On Hand</span>
                        </div>
                      </div>

                      {/* Item Rows */}
                      <div className="flex flex-col">
                        {group.items.map((item: any) => <StockRow key={item.id} item={item} router={router} />)}
                        
                        {/* Quick Add Row */}
                        <Link href={`/materials/new?location_id=${group.id}`} className="flex items-center gap-2 py-2.5 px-4 text-[9px] font-black uppercase tracking-widest text-gray-600 hover:text-purple-400 hover:bg-white/[0.04] transition-colors border-t border-gray-800/40">
                          <Plus size={12} /> Add to {group.name}
                        </Link>
                      </div>
                    </section>
                  )
                })}

                {/* 2. UNASSIGNED ITEMS */}
                {unassignedItems.length > 0 && (
                  <section className="break-inside-avoid inline-block w-full mb-5 border border-yellow-900/50 rounded-[1.5rem] bg-[#121212] overflow-hidden shadow-lg">
                    <div className="bg-yellow-950/20 flex items-center justify-between px-4 py-3.5 border-b border-yellow-900/50">
                      <div className="flex items-center gap-2.5">
                        <Package size={14} className="text-yellow-500" />
                        <h2 className="text-[11px] font-black uppercase tracking-widest text-yellow-500">Unassigned</h2>
                      </div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-yellow-600 bg-yellow-950/50 px-2 py-1 rounded-md border border-yellow-900/50">{unassignedItems.length} On Hand</span>
                    </div>
                    <div className="flex flex-col">
                      {unassignedItems.map((item: any) => <StockRow key={item.id} item={item} router={router} />)}
                    </div>
                  </section>
                )}

                {/* 3. ADD STORE BUTTON TILE */}
                <button onClick={() => router.push('/locations')} className="break-inside-avoid inline-block w-full mb-5 border-2 border-dashed border-gray-800 hover:border-purple-500/50 rounded-[1.5rem] bg-transparent hover:bg-[#121212] transition-all p-6 group text-gray-600 hover:text-purple-400 cursor-pointer shadow-sm">
                   <div className="flex flex-col items-center justify-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-black border border-gray-800 group-hover:border-purple-500/30 flex items-center justify-center shadow-inner">
                       <Plus size={16} />
                     </div>
                     <h3 className="text-[10px] font-black uppercase tracking-widest">Establish New Chamber</h3>
                   </div>
                </button>

                {/* 4. GHOST LOCATIONS (Consolidated) */}
                {ghostLocs.length > 0 && (
                  <section className="break-inside-avoid inline-block w-full mb-5 border border-gray-800/80 rounded-[1.5rem] bg-[#121212] overflow-hidden shadow-sm opacity-90 hover:opacity-100 transition-opacity">
                    <div className="bg-[#1a1a1a] flex items-center justify-between px-4 py-3.5 border-b border-gray-800/80">
                      <div className="flex items-center gap-2.5">
                        <MapPin size={14} className="text-gray-600" />
                        <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-400">Empty Chambers</h2>
                      </div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 bg-black/60 px-2 py-1 rounded-md border border-gray-800">{ghostLocs.length} Total</span>
                    </div>

                    <div className="flex flex-col">
                      {ghostLocs.map((loc) => (
                        <div key={loc.id} className="flex items-center justify-between py-3 px-4 border-b border-gray-800/40 last:border-0 hover:bg-white/[0.02] transition-colors group">
                          <div className="flex items-center gap-3">
                            <Link href={`/locations/${loc.id}`} className="text-[11px] font-bold text-gray-400 group-hover:text-purple-400 transition-colors">
                              {loc.name}
                            </Link>
                            <span className="text-[7px] font-black uppercase tracking-widest text-gray-600 bg-black/40 px-1.5 py-0.5 rounded border border-gray-800/50">
                              {loc.defaultCount} Default
                            </span>
                          </div>
                          <Link href={`/materials/new?location_id=${loc.id}`} className="text-[9px] font-black uppercase tracking-widest text-gray-600 hover:text-purple-400 flex items-center gap-1.5 transition-colors">
                            <Plus size={10} /> Add Item
                          </Link>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

              </div>
            )}
          </div>

          {/* RIGHT: LEDGER FEED (Subtle List Style) */}
          <div className="w-full xl:w-[320px] shrink-0 xl:border-l xl:border-gray-800/50 xl:pl-6 space-y-4">
             <div className="flex items-center justify-between pb-1">
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2"><History size={12}/> Ledger Feed</h3>
                 <Link href="/history" className="text-[9px] font-bold text-purple-500 hover:text-purple-400">View All</Link>
             </div>
             
             <div className="flex flex-col gap-1.5">
               {recentActivity.length === 0 ? (
                 <p className="text-[10px] text-gray-600 font-bold italic py-4">No recent movements.</p>
               ) : (
                 recentActivity.map(act => (
                   <div key={act.id} className="flex items-center justify-between py-2 border-b border-gray-800/30 last:border-0 group cursor-default">
                     <div className="flex items-center gap-3 overflow-hidden">
                       <div className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-md bg-[#0f0f0f] border ${act.movement_type.includes('IN') ? 'border-purple-500/20 text-purple-400' : act.movement_type.includes('TRANSFER') ? 'border-blue-500/20 text-blue-400' : 'border-yellow-500/20 text-yellow-500'}`}>
                          {act.movement_type.includes('IN') ? <ArrowDownLeft size={10}/> : act.movement_type.includes('TRANSFER') ? <ArrowRightLeft size={10}/> : <ArrowUpRight size={10}/>}
                       </div>
                       <div className="truncate">
                         {/* Muted Italic Item Names for System Log Vibe */}
                         <p className="text-[11px] font-semibold text-gray-500 italic truncate">{act.materials?.name || 'Unknown'}</p>
                         <p className="text-[8px] font-black uppercase tracking-widest text-gray-600 truncate mt-0.5">
                           {act.locations?.name || 'Unassigned'} 
                           <span className="text-gray-700 ml-1.5 font-medium tracking-normal normal-case">• {new Date(act.created_at).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}</span>
                         </p>
                       </div>
                     </div>
                     <span className={`shrink-0 text-xs font-black ml-3 ${act.quantity > 0 ? 'text-purple-400' : 'text-yellow-500'}`}>
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
  )
}

// Sleek Table-Row Component for Inventory Items
function StockRow({ item, router }: { item: any, router: any }) {
  const threshold = item.is_mrp_enabled ? (item.reorder_point || 0) : 0
  const isOut = item.quantity <= 0
  const isLowStock = !isOut && item.quantity <= threshold

  return (
    <div 
      onClick={() => router.push(`/materials/${item.material_id}`)}
      className="flex items-center justify-between py-2.5 px-4 border-b border-gray-800/40 last:border-0 hover:bg-[#1f1f1f] transition-colors cursor-pointer group"
    >
      <div className="flex items-center gap-3 truncate pr-4">
        <h3 className={`text-xs font-bold truncate transition-colors ${
          isOut ? 'text-red-400 group-hover:text-red-300' : 
          isLowStock ? 'text-yellow-400 group-hover:text-yellow-300' : 
          'text-gray-300 group-hover:text-white'
        }`}>
          {item.name}
        </h3>
      </div>
      
      <div className="flex items-center gap-4 shrink-0">
        {/* Dynamic Warning Icon */}
        <div className="flex items-center justify-center w-4 h-4 group-hover:hidden">
          {isOut ? <AlertCircle size={12} className="text-red-500" /> : 
           isLowStock ? <AlertCircle size={12} className="text-yellow-500" /> : null}
        </div>
        
        {/* Quick Transact Button (Appears on Hover) */}
        <button 
          onClick={(e) => { e.stopPropagation(); router.push(`/inventory?material_id=${item.material_id}`) }}
          className={`hidden group-hover:flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
            isOut ? 'bg-red-900/50 text-red-100 hover:bg-red-500' : 
            isLowStock ? 'bg-yellow-900/50 text-yellow-100 hover:bg-yellow-500' : 
            'bg-gray-800 text-purple-400 hover:bg-purple-500 hover:text-white'
          }`}
          title="Quick Transact"
        >
           <ArrowRightLeft size={10} />
        </button>

        {/* Value Data */}
        <div className="text-right flex flex-col justify-center min-w-[2.5rem]">
          <p className={`text-[13px] font-black leading-none ${
            isOut ? 'text-red-500' : isLowStock ? 'text-yellow-500' : 'text-purple-400'
          }`}>
            {item.quantity}
          </p>
          <p className="text-[7px] font-black uppercase tracking-widest text-gray-500 mt-1">
            {item.unit}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() { return <Suspense fallback={<div className="min-h-screen bg-black" />}><DashboardContent /></Suspense> }