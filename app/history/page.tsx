'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useOrganization } from '../context/OrganizationContext'
import { Shield, ArrowDownLeft, ArrowUpRight, ArrowRightLeft, MessageSquare, Search, Filter, Database, Loader2 } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function HistoryPage() {
  const { organization } = useOrganization()
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filtering State
  const [materials, setMaterials] = useState<any[]>([])
  const [filterType, setFilterType] = useState('')
  const [filterMaterial, setFilterMaterial] = useState('')

  useEffect(() => {
    const fetchLedger = async () => {
      if (!organization) return
      setLoading(true)

      // 1. Fetch Materials for the Filter Dropdown
      const { data: matData } = await supabase
        .from('materials')
        .select('id, name')
        .or(`organization_id.eq.${organization.id},organization_id.is.null`)
        .order('name')
      
      if (matData) setMaterials(matData)

      // 2. Fetch the Ledger (Removed the broken 'unit' query)
      let query = supabase
        .from('inventory_movements')
        .select(`
          *,
          materials ( name ), 
          locations ( name )
        `)
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(200)

      // Apply active filters
      if (filterType) query = query.ilike('movement_type', `%${filterType}%`)
      if (filterMaterial) query = query.eq('material_id', filterMaterial)

      const { data, error } = await query

      if (data) setHistory(data)
      if (error) console.error("Ledger Fetch Error:", error)
      
      setLoading(false)
    }
    
    fetchLedger()
  }, [organization, filterType, filterMaterial])

  const getBadgeStyle = (type: string) => {
    if (type.includes('IN')) return { bg: 'bg-purple-900/20 border-purple-500/30 text-purple-400', icon: <ArrowDownLeft size={10} /> }
    if (type.includes('TRANSFER')) return { bg: 'bg-blue-900/20 border-blue-500/30 text-blue-400', icon: <ArrowRightLeft size={10} /> }
    return { bg: 'bg-yellow-900/20 border-yellow-500/30 text-yellow-500', icon: <ArrowUpRight size={10} /> }
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-[#0a0a0a] text-white font-sans pb-32">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER & FILTERS */}
        <header className="border-b border-gray-800 pb-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black uppercase tracking-tighter italic text-gray-100 mb-1">Vault Ledger</h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                <Shield size={12} className="text-purple-500" /> Immutable Audit Trail • {organization?.name}
              </p>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {/* Type Filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                <select 
                  value={filterType} 
                  onChange={e => setFilterType(e.target.value)}
                  className="bg-[#0f0f0f] border border-gray-800 text-xs font-bold text-gray-300 py-3 pl-9 pr-4 rounded-xl outline-none focus:border-purple-500 appearance-none min-w-[140px]"
                >
                  <option value="">All Operations</option>
                  <option value="IN">Inbound & Adjustments (+)</option>
                  <option value="OUT">Outbound & Adjustments (-)</option>
                  <option value="TRANSFER">Transfers (A → B)</option>
                </select>
              </div>

              {/* Material Filter */}
              <div className="relative">
                <Database className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                <select 
                  value={filterMaterial} 
                  onChange={e => setFilterMaterial(e.target.value)}
                  className="bg-[#0f0f0f] border border-gray-800 text-xs font-bold text-gray-300 py-3 pl-9 pr-4 rounded-xl outline-none focus:border-purple-500 appearance-none min-w-[180px]"
                >
                  <option value="">All Materials</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </header>

        {/* TABLE CONTAINER */}
        <div className="bg-[#0f0f0f] border border-gray-800 rounded-[2.5rem] overflow-hidden shadow-2xl relative min-h-[400px]">
          {loading && (
            <div className="absolute inset-0 z-10 bg-[#0f0f0f]/80 backdrop-blur-sm flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-purple-500 mb-4" size={32} />
              <p className="text-[10px] font-black uppercase tracking-widest text-purple-500">Querying Ledger...</p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-black/50 border-b border-gray-800">
                  <th className="p-5 font-black uppercase tracking-widest text-gray-500">Timestamp</th>
                  <th className="p-5 font-black uppercase tracking-widest text-gray-500">Operation</th>
                  <th className="p-5 font-black uppercase tracking-widest text-gray-500">Master Good</th>
                  <th className="p-5 font-black uppercase tracking-widest text-gray-500">Chamber</th>
                  <th className="p-5 font-black uppercase tracking-widest text-gray-500 text-right">Delta</th>
                  <th className="p-5 font-black uppercase tracking-widest text-gray-500"><div className="flex items-center gap-2"><MessageSquare size={12}/> Notes</div></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {history.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-gray-500 font-bold italic">No records found matching your criteria.</td>
                  </tr>
                ) : (
                  history.map((row) => {
                    const style = getBadgeStyle(row.movement_type)
                    return (
                      <tr key={row.id} className="hover:bg-gray-800/30 transition-colors group">
                        <td className="p-5 text-gray-500 font-bold">
                          {new Date(row.created_at).toLocaleDateString()} 
                          <span className="text-[10px] text-gray-700 block mt-0.5">{new Date(row.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </td>
                        <td className="p-5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${style.bg}`}>
                            {style.icon}
                            {row.movement_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-5">
                          <p className="font-black text-gray-200 group-hover:text-white transition-colors">{row.materials?.name || 'Deleted Good'}</p>
                        </td>
                        <td className="p-5 text-gray-400 font-bold">{row.locations?.name || 'Unassigned'}</td>
                        <td className={`p-5 text-right font-black text-sm tracking-tighter ${row.quantity > 0 ? 'text-purple-400' : 'text-yellow-500'}`}>
                          {row.quantity > 0 ? `+${row.quantity}` : row.quantity} 
                        </td>
                        <td className="p-5 max-w-xs">
                          <p className="text-[10px] text-gray-500 font-bold italic truncate group-hover:whitespace-normal group-hover:text-gray-300 transition-all max-w-[200px]">
                            {row.notes || '-'}
                          </p>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}