'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function HistoryPage() {
  const [movements, setMovements] = useState<any[]>([])

  useEffect(() => {
    const fetchHistory = async () => {
      // We join tables to get names instead of just IDs
      const { data, error } = await supabase
        .from('inventory_movements')
        .select(`
          id,
          quantity,
          movement_type,
          created_at,
          materials (name),
          locations (name)
        `)
        .order('created_at', { ascending: false }) // Newest first

      if (data) setMovements(data)
      if (error) console.error(error)
    }
    fetchHistory()
  }, [])

  return (
    <div className="min-h-screen p-8 bg-black text-white">
      <h1 className="text-3xl font-bold mb-8">📜 Transaction History</h1>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-gray-900 text-gray-200 uppercase font-bold">
            <tr>
              <th className="p-4">Date</th>
              <th className="p-4">Type</th>
              <th className="p-4">Material</th>
              <th className="p-4">Location</th>
              <th className="p-4 text-right">Qty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {movements.map((mov) => (
              <tr key={mov.id} className="hover:bg-gray-900/50 transition-colors">
                <td className="p-4">{new Date(mov.created_at).toLocaleString()}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${mov.movement_type === 'INBOUND' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                    {mov.movement_type}
                  </span>
                </td>
                <td className="p-4 font-medium text-white">{mov.materials?.name || 'Unknown'}</td>
                <td className="p-4">{mov.locations?.name || 'Unknown'}</td>
                <td className={`p-4 text-right font-mono font-bold ${mov.quantity > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}