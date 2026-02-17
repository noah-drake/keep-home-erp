'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useOrganization } from '../context/OrganizationContext'
import { Shield, Clock, ArrowDownLeft, ArrowUpRight, ArrowRightLeft, MessageSquare } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function HistoryPage() {
  const { organization } = useOrganization()
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      if (!organization) return
      setLoading(true)

      const { data, error } = await supabase
        .from('inventory_movements')
        .select(`
          *,
          materials ( name, unit ), 
          locations ( name )
        `)
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (data) setHistory(data)
      if (error) console.error("Ledger Fetch Error:", error)
      setLoading(false)
    }
    fetchHistory()
  }, [organization])

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-purple-500 font-black uppercase tracking-widest">
      Scanning Ledger...
    </div>
  )

  return (
    <div className="min-h-screen p-4 md:p-8 bg-[#0a0a0a] text-white font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="border-b border-gray-800 pb-6 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic text-gray-100 mb-1">Vault Ledger</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <Shield size={12} className="text-purple-500" /> Audit Trail • {organization?.name}
            </p>
          </div>
        </header>

        {/* TABLE CONTAINER */}
        <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-black/50 border-b border-gray-800">
                  <th className="p-5 font-black uppercase tracking-widest text-gray-500">Timestamp</th>
                  <th className="p-5 font-black uppercase tracking-widest text-gray-500">Operation</th>
                  <th className="p-5 font-black uppercase tracking-widest text-gray-500">Good</th>
                  <th className="p-5 font-black uppercase tracking-widest text-gray-500">Chamber</th>
                  <th className="p-5 font-black uppercase tracking-widest text-gray-500 text-right">Qty</th>
                  <th className="p-5 font-black uppercase tracking-widest text-gray-500"><div className="flex items-center gap-2"><MessageSquare size={12}/> Notes</div></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {history.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-800/50 transition-colors group">
                    <td className="p-5 text-gray-500 font-bold">
                      {new Date(row.created_at).toLocaleDateString()} 
                      <span className="text-[10px] text-gray-700 block">{new Date(row.created_at).toLocaleTimeString()}</span>
                    </td>
                    <td className="p-5">
                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                        row.movement_type === 'INBOUND' || row.movement_type === 'TRANSFER_IN' ? 'bg-purple-900/10 border-purple-500/30 text-purple-400' : 
                        row.movement_type.includes('TRANSFER') ? 'bg-blue-900/10 border-blue-500/30 text-blue-400' : 
                        'bg-yellow-900/10 border-yellow-500/30 text-yellow-500'
                      }`}>
                        {row.movement_type.includes('IN') ? <ArrowDownLeft size={10} /> : row.movement_type.includes('TRANSFER') ? <ArrowRightLeft size={10}/> : <ArrowUpRight size={10}/>}
                        {row.movement_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-5">
                       <p className="font-black text-gray-200">{row.materials?.name || 'Deleted Good'}</p>
                    </td>
                    <td className="p-5 text-gray-400 font-bold">{row.locations?.name || 'Unassigned'}</td>
                    <td className={`p-5 text-right font-black text-sm tracking-tighter ${row.quantity > 0 ? 'text-purple-400' : 'text-yellow-500'}`}>
                      {row.quantity > 0 ? `+${row.quantity}` : row.quantity} 
                      <span className="text-[9px] uppercase tracking-widest text-gray-600 ml-1">{row.materials?.unit}</span>
                    </td>
                    <td className="p-5 max-w-xs">
                      <p className="text-[10px] text-gray-500 font-bold italic truncate group-hover:whitespace-normal group-hover:text-gray-300 transition-all">
                        {row.notes || '-'}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}