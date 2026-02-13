'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useOrganization } from './context/OrganizationContext'
import { useRouter } from 'next/navigation'
import { Castle, Zap, Plus, ArrowRight, Check, Package, MapPin, BarChart, AlertTriangle } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function Dashboard() {
  const router = useRouter()
  const { organization } = useOrganization()
  
  const [hasData, setHasData] = useState<boolean | null>(null)
  const [step, setStep] = useState(0) // 0 = Checking, 1 = Locs, 2 = Mats, 3 = Config
  const [loading, setLoading] = useState(false)

  // Global Data
  const [globalLocs, setGlobalLocs] = useState<any[]>([])
  const [globalProducts, setGlobalProducts] = useState<any[]>([])

  // User Selections
  const [selectedLocs, setSelectedLocs] = useState<string[]>([])
  const [selectedProducts, setSelectedProducts] = useState<any[]>([])
  const [productConfigs, setProductConfigs] = useState<Record<string, any>>({})

  // Dashboard Stats
  const [stats, setStats] = useState({ totalItems: 0, lowStock: 0 })

  useEffect(() => {
    async function init() {
      if (!organization) return
      // Check if they already have locations
      const { count } = await supabase.from('locations').select('*', { count: 'exact', head: true }).eq('organization_id', organization.id)
      
      if (count && count > 0) {
          setHasData(true)
          fetchDashboardStats()
      } else {
          setHasData(false)
          setStep(1) // Start Wizard
          
          const { data: locs } = await supabase.from('global_locations').select('*')
          const { data: prods } = await supabase.from('global_products').select('*')
          if (locs) setGlobalLocs(locs)
          if (prods) setGlobalProducts(prods)
      }
    }
    init()
  }, [organization])

  const fetchDashboardStats = async () => {
      // Get Total Items
      const { count: total } = await supabase.from('materials').select('*', { count: 'exact', head: true }).eq('organization_id', organization.id)
      
      // Get Low Stock Items (Current Stock <= Min Stock AND MRP is enabled)
      const { data: lowStockData } = await supabase.from('materials')
          .select('id')
          .eq('organization_id', organization.id)
          .eq('is_mrp_enabled', true)
          .lte('current_stock', 'min_stock_level') // Supabase filter for column comparison is tricky, doing simple fetch for now

      // More reliable low stock calculation for the frontend
      const { data: allItems } = await supabase.from('materials').select('*').eq('organization_id', organization.id).eq('is_mrp_enabled', true)
      const lowCount = allItems?.filter(item => item.current_stock <= item.min_stock_level).length || 0

      setStats({ totalItems: total || 0, lowStock: lowCount })
  }

  const toggleLoc = (name: string) => setSelectedLocs(prev => prev.includes(name) ? prev.filter(l => l !== name) : [...prev, name])
  const toggleProduct = (prod: any) => setSelectedProducts(prev => prev.find(p => p.id === prod.id) ? prev.filter(p => p.id !== prod.id) : [...prev, prod])

  const updateConfig = (prodId: string, field: string, value: any) => {
      setProductConfigs(prev => ({
          ...prev,
          [prodId]: { ...prev[prodId], [field]: value }
      }))
  }

  // --- THE MASSIVE BULK INSERT ---
  const handleFinalizeSetup = async () => {
      setLoading(true)
      try {
          // 1. Clone Locations
          const { data: newLocs, error: locError } = await supabase.from('locations')
              .insert(selectedLocs.map(name => ({ name, organization_id: organization.id })))
              .select()
          if (locError) throw new Error("Locations Error: " + locError.message)

          // 2. Clone Categories & Units
          const categoriesToClone = Array.from(new Set(selectedProducts.map(p => p.category_name).filter(Boolean)))
          const unitsToClone = Array.from(new Set(selectedProducts.map(p => p.unit_name).filter(Boolean)))
          
          let localCats: any[] = []
          let localUnits: any[] = []

          if (categoriesToClone.length > 0) {
              const { data, error: catError } = await supabase.from('categories').insert(categoriesToClone.map(name => ({ name, organization_id: organization.id }))).select()
              if (catError) throw new Error("Categories Error: " + catError.message)
              if (data) localCats = data
          }
          if (unitsToClone.length > 0) {
              const { data, error: unitError } = await supabase.from('units').insert(unitsToClone.map(name => ({ name, organization_id: organization.id }))).select()
              if (unitError) throw new Error("Units Error: " + unitError.message)
              if (data) localUnits = data
          }

          // 3. Insert the Configured Materials
          const materialsToInsert = selectedProducts.map(prod => {
              const config = productConfigs[prod.id] || {}
              const catId = localCats.find(c => c.name === prod.category_name)?.id
              const unitId = localUnits.find(u => u.name === prod.unit_name)?.id
              const locId = newLocs?.find(l => l.name === config.locationName)?.id

              return {
                  organization_id: organization.id,
                  name: prod.name,
                  category_id: catId || null,
                  unit_id: unitId || null,
                  default_location_id: locId || null,
                  is_mrp_enabled: config.is_mrp_enabled || false,
                  min_stock_level: config.is_mrp_enabled ? (config.min_stock || 0) : 0,
                  reorder_quantity: config.is_mrp_enabled ? (config.reorder_qty || 0) : 0,
                  current_stock: 0
              }
          })

          if (materialsToInsert.length > 0) {
              const { error: matError } = await supabase.from('materials').insert(materialsToInsert)
              if (matError) throw new Error("Materials Error: " + matError.message)
          }

          setHasData(true)
          fetchDashboardStats()
      } catch (err: any) {
          console.error(err)
          alert("Setup Failed: " + err.message)
      } finally {
          setLoading(false)
      }
  }

  if (hasData === null) return null 

  if (!hasData) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 text-white font-sans">
        <div className="max-w-2xl w-full bg-gray-900 p-8 md:p-12 rounded-[2.5rem] border border-gray-800 shadow-2xl">
            
            {/* STEP 1: LOCATIONS */}
            {step === 1 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <MapPin size={40} className="text-purple-500 mb-6" />
                    <h1 className="text-3xl font-black uppercase tracking-tighter mb-2">Define Your Zones</h1>
                    <p className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-8">Select the locations in {organization?.name}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                        {globalLocs.map(loc => (
                            <button 
                                key={loc.id} onClick={() => toggleLoc(loc.name)}
                                className={`p-4 rounded-2xl border-2 text-sm font-bold transition-all ${selectedLocs.includes(loc.name) ? 'border-purple-500 bg-purple-500/10 text-purple-400' : 'border-gray-800 bg-black hover:border-gray-600'}`}
                            >
                                {loc.name}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => setStep(2)} disabled={selectedLocs.length === 0} className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase text-xs hover:bg-purple-600 hover:text-white transition-all disabled:opacity-50 flex justify-center items-center gap-2">
                        Next Step <ArrowRight size={16} />
                    </button>
                </div>
            )}

            {/* STEP 2: MATERIALS */}
            {step === 2 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Package size={40} className="text-blue-500 mb-6" />
                    <h1 className="text-3xl font-black uppercase tracking-tighter mb-2">The Starter Stash</h1>
                    <p className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-8">Select standard items from the Global Registry to track.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                        {globalProducts.map(prod => (
                            <div key={prod.id} onClick={() => toggleProduct(prod)} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex justify-between items-center ${selectedProducts.find(p => p.id === prod.id) ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800 bg-black hover:border-gray-600'}`}>
                                <div>
                                    <p className="font-bold text-sm">{prod.name}</p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">{prod.category_name} • {prod.unit_name}</p>
                                </div>
                                {selectedProducts.find(p => p.id === prod.id) && <Check size={18} className="text-blue-500" />}
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setStep(1)} className="px-6 bg-transparent border border-gray-700 text-gray-400 py-4 rounded-2xl font-black uppercase text-xs hover:bg-gray-800 transition-all">Back</button>
                        <button onClick={() => setStep(3)} disabled={selectedProducts.length === 0} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs hover:bg-blue-500 transition-all disabled:opacity-50">Configure Selection</button>
                    </div>
                </div>
            )}

            {/* STEP 3: DEEP CONFIG */}
            {step === 3 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <BarChart size={40} className="text-green-500 mb-6" />
                    <h1 className="text-3xl font-black uppercase tracking-tighter mb-2">Configure Rules</h1>
                    <p className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-8">Where do these live, and do you want MRP restocking alerts?</p>
                    
                    <div className="space-y-4 mb-8 max-h-[50vh] overflow-y-auto pr-2">
                        {selectedProducts.map(prod => {
                            const conf = productConfigs[prod.id] || {}
                            return (
                                <div key={prod.id} className="bg-black border border-gray-800 p-6 rounded-3xl space-y-4">
                                    <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                                        <h3 className="font-bold text-lg">{prod.name}</h3>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">MRP Rules</span>
                                            <input type="checkbox" className="w-4 h-4 accent-green-500" checked={conf.is_mrp_enabled || false} onChange={e => updateConfig(prod.id, 'is_mrp_enabled', e.target.checked)} />
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className={conf.is_mrp_enabled ? "col-span-1" : "col-span-3"}>
                                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">Home Location</label>
                                            <select className="w-full bg-gray-900 border border-gray-700 p-3 rounded-xl outline-none text-xs font-bold" value={conf.locationName || ''} onChange={e => updateConfig(prod.id, 'locationName', e.target.value)}>
                                                <option value="">Select Room...</option>
                                                {selectedLocs.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                                            </select>
                                        </div>

                                        {conf.is_mrp_enabled && (
                                            <>
                                                <div>
                                                    <label className="text-[9px] font-black text-green-500 uppercase tracking-widest block mb-1">Min Stock</label>
                                                    <input type="number" min="0" className="w-full bg-gray-900 border border-green-900/50 focus:border-green-500 p-3 rounded-xl outline-none text-xs font-bold" placeholder="e.g. 2" value={conf.min_stock || ''} onChange={e => updateConfig(prod.id, 'min_stock', parseInt(e.target.value))} />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-black text-green-500 uppercase tracking-widest block mb-1">Lot Qty</label>
                                                    <input type="number" min="0" className="w-full bg-gray-900 border border-green-900/50 focus:border-green-500 p-3 rounded-xl outline-none text-xs font-bold" placeholder="e.g. 1" value={conf.reorder_qty || ''} onChange={e => updateConfig(prod.id, 'reorder_qty', parseInt(e.target.value))} />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="flex gap-4">
                        <button onClick={() => setStep(2)} className="px-6 bg-transparent border border-gray-700 text-gray-400 py-4 rounded-2xl font-black uppercase text-xs hover:bg-gray-800 transition-all">Back</button>
                        <button onClick={handleFinalizeSetup} disabled={loading} className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-black uppercase text-xs hover:bg-green-500 transition-all shadow-lg shadow-green-900/20">
                            {loading ? 'Building Workspace...' : 'Initialize Keep Workspace'}
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    )
  }

  // --- THE TRUE DASHBOARD ---
  return (
    <div className="p-4 md:p-8 text-white max-w-7xl mx-auto font-sans space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center gap-4 border-b border-gray-800 pb-6">
            <Castle size={32} className="text-purple-500" />
            <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter italic">Keep Command</h1>
                <p className="text-gray-500 font-bold text-[10px] uppercase tracking-widest">Active Workspace: {organization?.name}</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Quick Action: Materials */}
            <button 
                onClick={() => router.push('/materials')}
                className="bg-gray-900 p-8 rounded-[2.5rem] border border-gray-800 flex flex-col items-center justify-center text-center cursor-pointer hover:border-purple-500 hover:bg-purple-500/5 transition-all group shadow-xl"
            >
                <div className="w-16 h-16 bg-purple-500/20 rounded-3xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Plus size={32} className="text-purple-500" />
                </div>
                <h3 className="font-black text-sm uppercase tracking-widest">Master Data</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-2">{stats.totalItems} Items Tracked</p>
            </button>

            {/* Quick Action: Stock Count */}
            <button 
                onClick={() => router.push('/inventory')}
                className="bg-gray-900 p-8 rounded-[2.5rem] border border-gray-800 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-500 hover:bg-blue-500/5 transition-all group shadow-xl"
            >
                <div className="w-16 h-16 bg-blue-500/20 rounded-3xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <BarChart size={32} className="text-blue-500" />
                </div>
                <h3 className="font-black text-sm uppercase tracking-widest">Update Inventory</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-2">Log Transactions</p>
            </button>

            {/* Status Card: Low Stock */}
            <div className={`p-8 rounded-[2.5rem] border flex flex-col items-center justify-center text-center shadow-xl ${stats.lowStock > 0 ? 'bg-red-500/10 border-red-500/50' : 'bg-gray-900 border-gray-800'}`}>
                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-4 ${stats.lowStock > 0 ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                    {stats.lowStock > 0 ? <AlertTriangle size={32} className="text-red-500" /> : <Check size={32} className="text-green-500" />}
                </div>
                <h3 className={`font-black text-sm uppercase tracking-widest ${stats.lowStock > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {stats.lowStock > 0 ? 'Action Required' : 'All Stock Healthy'}
                </h3>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-2">
                    {stats.lowStock} Items Below Min. Level
                </p>
            </div>
            
        </div>
    </div>
  )
}