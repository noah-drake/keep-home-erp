'use client'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useOrganization } from './context/OrganizationContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import StarterKits from './components/StarterKits'
import { 
  MapPin, Package, AlertCircle, Shield, ArrowRightLeft, BookOpen, 
  Plus, ClipboardCheck, ShoppingCart, History, ArrowDownLeft, ArrowUpRight 
} from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function DashboardContent() {
  const router = useRouter()
  const { organization } = useOrganization()
  
  const [groupedData, setGroupedData] = useState<any[]>([])
  const [unassignedItems, setUnassignedItems] = useState<any[]>([])
  const [totalItems, setTotalItems] = useState<number | null>(null)
  
  // New Dashboard Telemetry State
  const [lowStockCount, setLowStockCount] = useState(0)
  const [mrpItemCount, setMrpItemCount] = useState(0)
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    if (!organization) return
    setLoading(true)
    
    // Fetch all necessary dashboard data simultaneously
    const [locRes, matRes, countRes, stockRes, unitRes, activityRes] = await Promise.all([
      supabase.from('locations').select('*').eq('organization_id', organization.id).order('name'),
      supabase.from('materials').select('*').eq('organization_id', organization.id).eq('is_active', true),
      supabase.from('materials').select('*', { count: 'exact', head: true }).eq('organization_id', organization.id),
      supabase.from('view_stock_by_location').select('*').eq('organization_id', organization.id).gt('quantity', 0),
      supabase.from('units').select('*').or(`organization_id.eq.${organization.id},organization_id.is.null`),
      supabase.from('inventory_movements').select('*, materials(name), locations(name)').eq('organization_id', organization.id).order('created_at', { ascending: false }).limit(5)
    ])

    const locationsList = locRes.data || []
    const materialsList = matRes.data || []
    const stockList = stockRes.data || []
    const unitsList = unitRes.data || []
    
    if (activityRes.data) setRecentActivity(activityRes.data)

    const displayCards: any[] = []
    let lowStockTracker = 0
    let mrpTracker = 0

    // Map active materials to Display Cards
    materialsList.forEach(mat => {
      const unit = unitsList.find(u => u.id === mat.unit_id) || unitsList.find(u => u.name === mat.unit_id)
      const unitStr = unit ? (unit.abbreviation || unit.name) : 'QTY'
      const stocksForMat = stockList.filter(s => s.material_id === mat.id)
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

    // Group cards by Location
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
  // STATE 1: ONBOARDING (Empty Keep) - Remains Centered
  // ==========================================
  if (totalItems === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 flex flex-col justify-center items-center text-white font-sans pb-32">
        {/* Onboarding UI stays exactly as it was... */}
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
  // STATE 2: ACTIVE KEEP (New Bento Layout)
  // ==========================================
  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans">
      <div className="max-w-[1400px] mx-auto pb-20">
        
        {/* DASHBOARD HEADER */}
        <header className="border-b border-gray-800 pb-6 mb-8">
          <h1 className="text-4xl font-black uppercase tracking-tighter italic text-gray-100 mb-1">Command Center</h1>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
            <Shield size={12} className="text-purple-500" /> {organization.name} Operations
          </p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: VISUAL INVENTORY (Occupies 8/12 cols on massive screens) */}
          <div className="xl:col-span-8 space-y-8 animate-in fade-in slide-in-from-bottom-4">
            {groupedData.length === 0 && unassignedItems.length === 0 ? (
              <div className="text-center py-20 bg-[#0f0f0f] border border-gray-800 rounded-[2.5rem]">
                <Package size={48} className="mx-auto text-gray-700 mb-4" />
                <h2 className="text-xl font-black uppercase tracking-tight text-gray-400">All Master Items Inactive</h2>
                <p className="text-xs font-bold text-gray-600 mt-2">Activate items in your registry to see them on the dashboard.</p>
              </div>
            ) : (
              <>
                {groupedData.map((group) => (
                  <section key={group.id} className="bg-[#0f0f0f] border border-gray-800 p-6 md:p-8 rounded-[2.5rem] shadow-xl space-y-6">
                    <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4">
                      <div className="w-10 h-10 bg-black border border-gray-800 rounded-xl flex items-center justify-center shadow-inner"><MapPin size={20} className="text-purple-500" /></div>
                      <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight text-gray-200 leading-none">{group.name}</h2>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{group.items.length} Tracked Goods</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {group.items.map((item: any) => <StockTile key={item.id} item={item} router={router} />)}
                    </div>
                  </section>
                ))}

                {unassignedItems.length > 0 && (
                  <section className="bg-yellow-950/10 border border-yellow-900/30 p-6 md:p-8 rounded-[2.5rem] shadow-xl space-y-6">
                    <div className="flex items-center gap-3 border-b border-yellow-900/30 pb-4">
                      <div className="w-10 h-10 bg-black border border-yellow-900/50 rounded-xl flex items-center justify-center shadow-inner"><Package size={20} className="text-yellow-500" /></div>
                      <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight text-yellow-500 leading-none">Unassigned Goods</h2>
                        <span className="text-[10px] font-black uppercase tracking-widest text-yellow-700">Needs Chamber Assignment</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {unassignedItems.map((item: any) => <StockTile key={item.id} item={item} router={router} />)}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>

          {/* RIGHT COLUMN: INTELLIGENCE & QUICK ACTIONS (Occupies 4/12 cols) */}
          <div className="xl:col-span-4 space-y-6">
            
            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => router.push('/inventory')} className="bg-[#0f0f0f] border border-gray-800 hover:border-purple-500 p-5 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all group shadow-lg">
                <div className="w-12 h-12 bg-purple-900/20 text-purple-400 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><ArrowRightLeft size={20} /></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Transact</span>
              </button>
              <button onClick={() => router.push('/inventory/count')} className="bg-[#0f0f0f] border border-gray-800 hover:border-blue-500 p-5 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all group shadow-lg">
                <div className="w-12 h-12 bg-blue-900/20 text-blue-400 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><ClipboardCheck size={20} /></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Audit Stock</span>
              </button>
              <button onClick={() => router.push('/materials/new')} className="bg-[#0f0f0f] border border-gray-800 hover:border-green-500 p-5 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all group shadow-lg">
                <div className="w-12 h-12 bg-green-900/20 text-green-400 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Plus size={20} /></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Add Item</span>
              </button>
              <button onClick={() => router.push('/shopping-list')} className="bg-[#0f0f0f] border border-gray-800 hover:border-yellow-500 p-5 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all group shadow-lg relative">
                {lowStockCount > 0 && <span className="absolute top-4 right-4 w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></span>}
                <div className="w-12 h-12 bg-yellow-900/20 text-yellow-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><ShoppingCart size={20} /></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Shop List</span>
              </button>
            </div>

            {/* System Pulse Widget */}
            <div className="bg-gradient-to-br from-[#1a0b2e] to-[#0f0f0f] border border-purple-500/20 p-6 rounded-[2.5rem] shadow-2xl flex items-center justify-between">
               <div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-1">Active Roster</p>
                 <p className="text-4xl font-black tracking-tighter">{totalItems}</p>
               </div>
               <div className="h-12 w-px bg-purple-500/20"></div>
               <div className="text-right flex flex-col items-end">
                 <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500 mb-1">Needs Restock</p>
                 <p className={`flex items-baseline gap-1 text-4xl font-black tracking-tighter ${lowStockCount > 0 ? 'text-yellow-500' : 'text-gray-500'}`}>
                   {lowStockCount}
                   <span className="text-lg font-bold text-gray-600 tracking-normal">/ {mrpItemCount}</span>
                 </p>
               </div>
            </div>

            {/* Live Telemetry / Recent Ledger */}
            <div className="bg-[#0f0f0f] border border-gray-800 rounded-[2.5rem] p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-800/50 pb-4 mb-4">
                 <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2"><History size={14} /> Live Telemetry</h3>
                 <Link href="/history" className="text-[9px] font-black uppercase tracking-widest text-purple-500 hover:text-purple-400">View All</Link>
              </div>
              <div className="space-y-4">
                {recentActivity.length === 0 ? (
                  <p className="text-xs text-gray-600 font-bold italic text-center py-4">No recent movements.</p>
                ) : (
                  recentActivity.map(act => (
                    <div key={act.id} className="flex justify-between items-center group">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border ${act.movement_type.includes('IN') ? 'bg-purple-900/20 border-purple-500/30 text-purple-400' : act.movement_type.includes('TRANSFER') ? 'bg-blue-900/20 border-blue-500/30 text-blue-400' : 'bg-yellow-900/20 border-yellow-500/30 text-yellow-500'}`}>
                           {act.movement_type.includes('IN') ? <ArrowDownLeft size={12}/> : act.movement_type.includes('TRANSFER') ? <ArrowRightLeft size={12}/> : <ArrowUpRight size={12}/>}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold text-gray-300 truncate">{act.materials?.name || 'Unknown'}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 truncate">{act.locations?.name || 'Unassigned'}</p>
                        </div>
                      </div>
                      <span className={`shrink-0 ml-2 text-sm font-black ${act.quantity > 0 ? 'text-purple-400' : 'text-yellow-500'}`}>
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
      className={`cursor-pointer border p-4 sm:p-5 rounded-3xl transition-all group relative overflow-hidden flex flex-col justify-between min-h-[110px] shadow-lg ${
        isOut ? 'bg-red-950/10 border-red-900/40 hover:border-red-500/60' :
        isLowStock ? 'bg-yellow-950/10 border-yellow-900/40 hover:border-yellow-500/60' : 
        'bg-black border-gray-800 hover:border-purple-500/50'
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <h3 className={`text-xs font-bold leading-tight transition-colors line-clamp-2 ${
          isOut ? 'text-red-200 group-hover:text-red-100' : 
          isLowStock ? 'text-yellow-200 group-hover:text-yellow-100' : 
          'text-gray-300 group-hover:text-white'
        }`}>
          {item.name}
        </h3>
        
        {/* Quick Transact Button (Replaces the Alert Icon on Hover) */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="group-hover:hidden">
            {isOut ? <AlertCircle size={16} className="text-red-500" /> : 
             isLowStock ? <AlertCircle size={16} className="text-yellow-500" /> : null}
          </div>
          
          <button 
            onClick={(e) => { e.stopPropagation(); router.push(`/inventory?material_id=${item.material_id}`) }}
            className={`hidden group-hover:flex p-1.5 rounded-lg transition-colors ${
              isOut ? 'bg-red-900/50 text-red-100 hover:bg-red-500' : 
              isLowStock ? 'bg-yellow-900/50 text-yellow-100 hover:bg-yellow-500' : 
              'bg-gray-900 text-purple-400 hover:bg-purple-500/20'
            }`}
            title="Quick Transact"
          >
             <ArrowRightLeft size={14} />
          </button>
        </div>
      </div>
      
      <div className="mt-3 flex items-end justify-between">
        <p className={`text-[8px] sm:text-[9px] font-black uppercase tracking-widest truncate max-w-[50px] ${
          isOut ? 'text-red-500/70' : isLowStock ? 'text-yellow-600' : 'text-gray-600'
        }`}>
          {item.unit}
        </p>
        <p className={`text-2xl sm:text-3xl font-black tracking-tighter leading-none ${
          isOut ? 'text-red-500' : isLowStock ? 'text-yellow-500' : 'text-purple-400'
        }`}>
          {item.quantity}
        </p>
      </div>
    </div>
  )
}

export default function DashboardPage() { return <Suspense fallback={<div className="min-h-screen bg-black" />}><DashboardContent /></Suspense> }