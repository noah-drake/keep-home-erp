'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useOrganization } from '../context/OrganizationContext' // Import

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function HistoryPage() {
  const { organization } = useOrganization() // Context
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      if (!organization) return

      const { data } = await supabase
        .from('inventory_movements')
        .select(`
          *,
          materials ( name, unit ), 
          locations ( name )
        `)
        .eq('organization_id', organization.id) // <--- Filter
        .order('created_at', { ascending: false })
        .limit(50)

      if (data) setHistory(data)
      setLoading(false)
    }
    fetchHistory()
  }, [organization]) // Dependency

  return (
    <div className="min-h-screen p-8 bg-black text-white">
      <h1 className="text-3xl font-bold mb-8">📜 Transaction History</h1>
      {loading ? <div>Loading records...</div> : (
        <div className="bg-gray-900 rounded border border-gray-800 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-950 text-gray-400 uppercase font-bold">
              <tr>
                <th className="p-4">Date</th>
                <th className="p-4">Item</th>
                <th className="p-4">Type</th>
                <th className="p-4 text-right">Qty</th>
                <th className="p-4">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {history.map((row) => (
                <tr key={row.id} className="hover:bg-gray-800/50">
                  <td className="p-4 text-gray-400 font-mono text-xs">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="p-4 font-bold">{row.materials?.name || row.material_name}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${row.movement_type === 'INBOUND' ? 'bg-green-900 text-green-300' : row.movement_type === 'OUTBOUND' ? 'bg-red-900 text-red-300' : 'bg-blue-900 text-blue-300'}`}>
                      {row.movement_type}
                    </span>
                  </td>
                  <td className={`p-4 text-right font-mono font-bold text-lg ${row.quantity > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {row.quantity > 0 ? '+' : ''}{row.quantity} <span className="text-xs text-gray-500 ml-1">{row.materials?.unit}</span>
                  </td>
                  <td className="p-4 text-gray-400">{row.locations?.name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}