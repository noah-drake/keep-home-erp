'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useOrganization } from '../context/OrganizationContext'
import { Package, CheckCircle2, Loader2, Database } from 'lucide-react'

export default function StarterKits({ onComplete }: { onComplete: () => void }) {
  const { organization } = useOrganization()
  const [kits, setKits] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState<string | null>(null)
  const [finished, setFinished] = useState<string[]>([])

  useEffect(() => {
    const fetchGlobalKits = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .is('organization_id', null) // Fetch ONLY global items
        .eq('is_active', true)

      if (data) {
        const grouped = data.reduce((acc: Record<string, any[]>, item) => {
          const kitName = item.category || 'General Essentials'
          if (!acc[kitName]) acc[kitName] = []
          acc[kitName].push(item)
          return acc
        }, {})
        setKits(grouped)
      }
      setLoading(false)
    }
    fetchGlobalKits()
  }, [])

  const handleImport = async (kitName: string, items: any[]) => {
    if (!organization) return
    setImporting(kitName)

    // Strip global IDs so Supabase assigns new primary keys for the local plant
    const payload = items.map(item => {
      const { material_id, created_at, organization_id, ...rest } = item
      return { ...rest, organization_id: organization.id, is_active: true }
    })

    const { error } = await supabase.from('materials').insert(payload)

    if (error) {
      alert(error.message)
      setImporting(null)
    } else {
      setFinished(prev => [...prev, kitName])
      setImporting(null)
      setTimeout(() => onComplete(), 1000) // Triggers the dashboard refresh
    }
  }

  if (loading) return <div className="p-12 border border-gray-800 rounded-[2.5rem] bg-[#0f0f0f] flex items-center justify-center"><Loader2 className="animate-spin text-purple-500 mr-3" size={16} /><span className="text-[10px] font-black uppercase tracking-widest text-purple-500">Querying Global Database...</span></div>
  
  const kitNames = Object.keys(kits).sort()

  if (kitNames.length === 0) return (
      <div className="text-center p-12 border-2 border-dashed border-gray-800 rounded-[2.5rem] bg-[#0f0f0f]">
        <Database className="mx-auto text-gray-700 mb-4" size={32} />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">No Global Kits Found</p>
        <p className="text-[9px] font-bold text-gray-600 mt-2 max-w-sm mx-auto">To see kits here, ensure your Supabase database has materials with a NULL organization_id.</p>
      </div>
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {kitNames.map((kitName) => {
        const items = kits[kitName]
        const isFinished = finished.includes(kitName)
        const isCurrent = importing === kitName

        return (
          <button key={kitName} disabled={!!importing || isFinished} onClick={() => handleImport(kitName, items)} className={`relative bg-[#0f0f0f] border p-8 rounded-[2.5rem] transition-all text-left group overflow-hidden shadow-xl ${isFinished ? 'border-green-500/30' : 'border-gray-800 hover:border-purple-500'}`}>
            <div className={`w-12 h-12 bg-black border border-gray-800 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${isFinished ? 'text-green-500 border-green-500/30' : 'text-purple-500'}`}>
              {isFinished ? <CheckCircle2 size={20} /> : isCurrent ? <Loader2 className="animate-spin" size={20} /> : <Package size={20} />}
            </div>
            <h3 className="font-black uppercase tracking-tight text-xl mb-1 text-gray-200">{kitName}</h3>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Import {items.length} master records.</p>
            {isFinished && <div className="absolute inset-0 bg-green-500/5 flex items-center justify-center"><span className="text-[10px] font-black uppercase tracking-widest text-green-500 bg-black border border-green-500/30 px-3 py-1 rounded-full shadow-2xl">Deployed</span></div>}
          </button>
        )
      })}
    </div>
  )
}