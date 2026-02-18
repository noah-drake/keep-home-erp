'use client'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useOrganization } from '../context/OrganizationContext'
import { MapPin, Plus, Search, MoreVertical, Edit2, Trash2, Box, ArrowRightLeft, ClipboardCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function StoresPageContent() {
  const router = useRouter()
  const { organization } = useOrganization()
  const [stores, setStores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const fetchStores = async () => {
      if (!organization) return
      setLoading(true)

      const { data, error } = await supabase
        .from('locations')
        .select(`*, stock_count: view_stock_by_location(count)`)
        .eq('organization_id', organization.id)
        .order('name')

      if (data) setStores(data)
      setLoading(false)
    }
    fetchStores()
  }, [organization])

  const handleDelete = async (e: React.MouseEvent, id: string, name: string, stockCount: number) => {
    e.stopPropagation()
    
    if (stockCount > 0) {
      alert(`BLOCKED: "${name}" currently holds active inventory.\n\nYou cannot demolish a store while goods are inside.`)
      return
    }

    const { data: history } = await supabase.from('inventory_movements').select('id').eq('location_id', id).limit(1)
    if (history && history.length > 0) {
      alert(`BLOCKED: "${name}" is referenced in the transaction ledger.\n\nTo force a cascade delete, open the Store Dossier Edit page.`)
      return
    }

    if (!confirm(`Are you sure you want to demolish ${name}?`)) return
    
    const { error } = await supabase.from('locations').delete().eq('id', id)
    if (error) alert(error.message)
    else setStores(stores.filter(s => s.id !== id))
  }

  const filteredStores = stores.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-purple-500 font-black uppercase tracking-widest">Opening Vault...</div>

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans pb-32">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic text-gray-100 mb-1">The Stores</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <MapPin size={12} className="text-purple-500" /> Physical Inventory Hubs
            </p>
          </div>
          <button onClick={() => router.push('/locations/new')} className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-purple-900/20 active:scale-95">
            <Plus size={16} /> New Store
          </button>
        </header>

        {/* SEARCH */}
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors" size={18} />
          <input 
            placeholder="Search stores..." 
            className="w-full bg-gray-900 border border-gray-800 p-4 pl-12 rounded-2xl outline-none focus:border-purple-500 transition-all font-bold text-sm text-gray-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* DENSE DATA TABLE */}
        <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-black/50 border-b border-gray-800">
                  <th className="p-5 text-[9px] font-black uppercase tracking-widest text-gray-500">Store Identity</th>
                  <th className="p-5 text-[9px] font-black uppercase tracking-widest text-gray-500 text-right">Unique SKUs Inside</th>
                  <th className="p-5 text-[9px] font-black uppercase tracking-widest text-gray-500 text-center w-16">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredStores.length === 0 ? (
                  <tr><td colSpan={3} className="p-8 text-center text-sm font-bold text-gray-500">No stores found.</td></tr>
                ) : (
                  filteredStores.map((store) => {
                    const stockCount = store.stock_count?.[0]?.count || 0

                    return (
                      <tr key={store.id} onClick={() => router.push(`/locations/${store.id}`)} className="hover:bg-gray-800/50 transition-colors group cursor-pointer">
                        <td className="p-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center border bg-blue-900/20 border-blue-500/30 text-blue-400">
                              <MapPin size={14} />
                            </div>
                            <div>
                                <p className="font-black text-sm text-gray-200 group-hover:text-white transition-colors">{store.name}</p>
                                <p className="text-[9px] uppercase tracking-widest text-gray-600">ID: {store.id.slice(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                             <Box size={14} className={stockCount > 0 ? "text-purple-500" : "text-gray-600"} />
                             <p className={`text-lg font-black tracking-tighter ${stockCount > 0 ? "text-white" : "text-gray-600"}`}>{stockCount}</p>
                          </div>
                        </td>
                        <td className="p-5 text-center relative" onClick={e => e.stopPropagation()}>
                           <ActionDropdown store={store} router={router} onDelete={(e: React.MouseEvent) => handleDelete(e, store.id, store.name, stockCount)} />
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

function ActionDropdown({ store, router, onDelete }: any) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div className="relative inline-block text-left z-10">
      <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen) }} className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800 transition-colors">
        <MoreVertical size={16} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0" onClick={(e) => { e.stopPropagation(); setIsOpen(false) }}></div>
          <div className="absolute right-0 mt-2 w-48 bg-[#0f0f0f] border border-gray-800 rounded-2xl shadow-2xl py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 z-20">
            <button onClick={(e) => { e.stopPropagation(); router.push(`/locations/${store.id}?edit=true`) }} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-gray-800 transition-colors text-gray-300 flex items-center gap-3"><Edit2 size={14} className="text-blue-500" /> Edit Store Data</button>
            <button onClick={(e) => { e.stopPropagation(); router.push(`/inventory?location_id=${store.id}`) }} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-gray-800 transition-colors text-gray-300 flex items-center gap-3"><ArrowRightLeft size={14} className="text-purple-500" /> Process Goods</button>
            <button onClick={(e) => { e.stopPropagation(); router.push(`/inventory/count?location_id=${store.id}`) }} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-gray-800 transition-colors text-gray-300 flex items-center gap-3"><ClipboardCheck size={14} className="text-blue-500" /> Audit Store</button>
            <div className="border-t border-gray-800 my-1"></div>
            <button onClick={(e) => { setIsOpen(false); onDelete(e) }} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-red-950/50 hover:text-red-400 transition-colors text-red-500 flex items-center gap-3"><Trash2 size={14} /> Demolish</button>
          </div>
        </>
      )}
    </div>
  )
}

export default function StoresPage() { return <Suspense fallback={<div className="min-h-screen bg-black" />}><StoresPageContent /></Suspense> }