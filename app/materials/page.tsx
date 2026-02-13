'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useOrganization } from '../context/OrganizationContext'
import { Package, Plus, Search, Edit2, Shield } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function GoodsPage() {
  const router = useRouter()
  const { organization } = useOrganization()
  
  const [goods, setGoods] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (organization) fetchData()
  }, [organization])

  const fetchData = async () => {
    setLoading(true)
    
    // Fetch both the stock view and locations to map names properly
    const [stockRes, locRes] = await Promise.all([
      supabase.from('view_current_stock').select('*').eq('organization_id', organization.id).order('name'),
      supabase.from('locations').select('id, name').eq('organization_id', organization.id)
    ])

    if (stockRes.data) setGoods(stockRes.data)
    if (locRes.data) setLocations(locRes.data)
      
    setLoading(false)
  }

  // Helper to get location name
  const getLocationName = (locId: string) => {
    if (!locId) return <span className="text-gray-600 italic">Unassigned</span>
    const loc = locations.find(l => l.id === locId)
    return loc ? loc.name : 'Unknown'
  }

  const filteredGoods = goods.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()))

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-purple-500">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Shield size={40} />
          <p className="text-xs font-black uppercase tracking-widest text-gray-500">Loading Records...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic text-gray-100 mb-1">The Goods</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <Package size={12} className="text-purple-500" /> Master Data Registry
            </p>
          </div>
          <button 
            onClick={() => router.push('/materials/new')} 
            className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-purple-900/20"
          >
            <Plus size={16} /> Add Good
          </button>
        </div>

        {/* SEARCH BAR */}
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors" size={18} />
          <input 
            placeholder="Search master data by name..." 
            className="w-full bg-gray-900 border border-gray-800 p-4 pl-12 rounded-xl outline-none focus:border-purple-500 transition-all font-bold text-sm text-gray-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* DATA TABLE */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/50 border-b border-gray-800">
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Item Name</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500 hidden sm:table-cell">Category</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500 hidden md:table-cell">Default Store</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-center">MRP</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">In Stock</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredGoods.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-sm font-bold text-gray-500">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  filteredGoods.map((item) => (
                    <tr key={item.material_id} className="hover:bg-gray-800/50 transition-colors group">
                      <td className="p-4">
                        <p className="font-bold text-sm text-gray-200">{item.name}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 sm:hidden mt-1">{item.category}</p>
                      </td>
                      <td className="p-4 hidden sm:table-cell">
                        <span className="text-xs font-bold text-gray-400 bg-black border border-gray-800 px-2 py-1 rounded-md">
                          {item.category || 'None'}
                        </span>
                      </td>
                      <td className="p-4 hidden md:table-cell text-xs font-bold text-gray-400">
                        {getLocationName(item.default_location_id)}
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-xs font-black text-yellow-500">
                          {item.reorder_point > 0 ? item.reorder_point : '-'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <p className="text-lg font-black tracking-tighter text-purple-400">
                          {item.current_stock || 0}
                        </p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                          {item.unit}
                        </p>
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => router.push(`/materials/${item.material_id}`)}
                          className="p-2 bg-gray-950 border border-gray-800 rounded-lg text-gray-400 hover:text-purple-400 hover:border-purple-500 transition-all inline-flex"
                        >
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}