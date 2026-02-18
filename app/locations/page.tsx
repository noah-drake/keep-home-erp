'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useOrganization } from '../context/OrganizationContext'
import { MapPin, Plus, Search, MoreVertical, Edit2, Trash2, Shield, Box, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function StoresPage() {
  const router = useRouter()
  const { organization } = useOrganization()
  const [stores, setStores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const fetchStores = async () => {
      if (!organization) return
      setLoading(true)

      // We join with view_stock_by_location to get a count of items in each store
      const { data, error } = await supabase
        .from('locations')
        .select(`
          *,
          stock_count: view_stock_by_location(count)
        `)
        .eq('organization_id', organization.id)
        .order('name')

      if (data) setStores(data)
      setLoading(false)
    }
    fetchStores()
  }, [organization])

  const filteredStores = stores.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-purple-500 font-black uppercase tracking-widest">Opening Vault...</div>

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic text-gray-100 mb-1">The Stores</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <MapPin size={12} className="text-purple-500" /> Physical Inventory Hubs
            </p>
          </div>
          <button className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-purple-900/20 active:scale-95">
            <Plus size={16} /> New Store
          </button>
        </header>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors" size={18} />
          <input 
            placeholder="Search stores..." 
            className="w-full bg-gray-900 border border-gray-800 p-4 pl-12 rounded-2xl outline-none focus:border-purple-500 transition-all font-bold text-sm text-gray-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStores.map((store) => (
            <div key={store.id} className="bg-[#0f0f0f] border border-gray-800 p-6 rounded-[2.5rem] hover:border-purple-500/50 transition-all group relative overflow-hidden">
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 bg-black border border-gray-800 rounded-2xl flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform">
                  <MapPin size={24} />
                </div>
                <button className="p-2 text-gray-600 hover:text-white transition-colors">
                  <MoreVertical size={18} />
                </button>
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-black uppercase tracking-tight text-gray-200 group-hover:text-purple-400 transition-colors">{store.name}</h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-600">ID: {store.id.slice(0, 8)}</p>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-800/50 flex justify-between items-end">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Unique SKUs</p>
                  <div className="flex items-center gap-2">
                    <Box size={14} className="text-purple-500" />
                    <span className="text-2xl font-black tracking-tighter">{store.stock_count?.[0]?.count || 0}</span>
                  </div>
                </div>
                <button 
                  onClick={() => router.push(`/inventory?location_id=${store.id}`)}
                  className="p-3 bg-gray-900 border border-gray-800 rounded-xl text-gray-400 hover:text-white hover:bg-purple-600 hover:border-purple-500 transition-all"
                >
                  <ArrowRight size={18} />
                </button>
              </div>

              {/* Decorative background element */}
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] pointer-events-none group-hover:opacity-[0.07] transition-opacity">
                <MapPin size={120} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}