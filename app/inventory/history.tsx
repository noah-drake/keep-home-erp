'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useOrganization } from '../context/OrganizationContext'
import { Shield, Clock, FileText, ArrowDownLeft, ArrowUpRight, ArrowRightLeft } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function HistoryPage() {
  const { organization } = useOrganization()
  const [movements, setMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      if (!organization) return
      setLoading(true)
      const { data, error } = await supabase
        .from('inventory_movements')
        .select(`id, quantity, movement_type, notes, created_at, materials (name, unit), locations (name)`)
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })

      if (data) setMovements(data)
      setLoading(false)
    }
    fetchHistory()
  }, [organization])

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-purple-500 font-black">READING LEDGER...</div>

  return (
    <div className="min-h-screen p-4 md:p-8 bg-[#0a0a0a] text-white font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <header className="border-b border-gray-800 pb-6 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic text-gray-100 mb-1">Vault Ledger</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <Shield size={12} className="text-purple-500" /> Complete Movement History
            </p>
          </div>
        </header>

        <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-black/50 border-b border-gray-800">
                <th className="p-5 font-black uppercase tracking-widest text-gray-500">Timestamp</th>
                <th className="p-5 font-black uppercase tracking-widest text-gray-500">Operation</th>
                <th className="p-5 font-black uppercase tracking-widest text-gray-500">Good</th>
                <th className="p-5 font-black uppercase tracking-widest text-gray-500">Chamber</th>
                <th className="p-5 font-black uppercase tracking-widest text-gray-500 text-right">Qty</th>
                <th className="p-5 font-black uppercase tracking-widest text-gray-500">Memo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {movements.map((mov) => (
                <tr key={mov.id} className="hover:bg-gray-800/50 transition-colors group">
                  <td className="p-5 text-gray-500 font-bold whitespace-nowrap">
                    {new Date(mov.created_at).toLocaleDateString()} <span className="text-[10px] text-gray-700 block">{new Date(mov.created_at).toLocaleTimeString()}</span>
                  </td>
                  <td className="p-5">
                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                      mov.movement_type.includes('IN') ? 'bg-purple-900/10 border-purple-500/30 text-purple-400' : 
                      mov.movement_type.includes('TRANSFER') ? 'bg-blue-900/10 border-blue-500/30 text-blue-400' : 
                      'bg-yellow-900/10 border-yellow-500/30 text-yellow-500'
                    }`}>
                      {mov.movement_type.includes('IN') ? <ArrowDownLeft size={10} /> : mov.movement_type.includes('TRANSFER') ? <ArrowRightLeft size={10}/> : <ArrowUpRight size={10}/>}
                      {mov.movement_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-5 font-black text-gray-200">{mov.materials?.name || 'Deleted Good'}</td>
                  <td className="p-5 text-gray-400 font-bold">{mov.locations?.name || 'Orphaned'}</td>
                  <td className={`p-5 text-right font-black text-sm tracking-tighter ${mov.quantity > 0 ? 'text-purple-400' : 'text-yellow-500'}`}>
                    {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity} <span className="text-[9px] uppercase tracking-widest text-gray-600">{mov.materials?.unit}</span>
                  </td>
                  <td className="p-5">
                    <p className="text-[10px] text-gray-500 font-bold max-w-[200px] truncate group-hover:whitespace-normal transition-all italic">
                      {mov.notes || '-'}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}