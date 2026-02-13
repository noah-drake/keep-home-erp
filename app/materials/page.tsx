'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useOrganization } from '../context/OrganizationContext'
import { Package, Plus, Search, MoreVertical, Edit2, Trash2, Ban, ArrowLeftRight, ClipboardList, Shield, AlertCircle, CheckCircle2 } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function GoodsPage() {
  const router = useRouter()
  const { organization } = useOrganization()
  
  const [goods, setGoods] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const [stockRes, locRes] = await Promise.all([
        supabase.from('view_current_stock').select('*').eq('organization_id', organization.id).order('name'),
        supabase.from('locations').select('id, name').eq('organization_id', organization.id)
      ])

      if (stockRes.data) setGoods(stockRes.data)
      if (locRes.data) setLocations(locRes.data)
      setLoading(false)
    }

    if (organization) fetchData()
  }, [organization])

  const getLocationName = (locId: string) => {
    if (!locId) return <span className="text-gray-600 italic">Unassigned</span>
    const loc = locations.find(l => l.id === locId)
    return loc ? loc.name : 'Unknown'
  }

  // Strict Delete Handler
  const handleDelete = async (e: React.MouseEvent, id: string, name: string, currentStock: number) => {
    e.stopPropagation()
    
    if (currentStock > 0) {
      alert(`BLOCKED: "${name}" currently has ${currentStock} in stock.\n\nYou cannot delete an item while it exists in the Keep.`)
      return
    }

    // Pre-flight check: Does this item have a transaction history?
    const { data: history } = await supabase.from('inventory_transactions').select('id').eq('material_id', id).limit(1)
    
    if (history && history.length > 0) {
      alert(`BLOCKED: "${name}" has an existing transaction ledger.\n\nTo force a cascade delete, you must open the Item Master Edit page.`)
      return
    }

    if (!confirm(`Are you sure you want to delete ${name}?`)) return
    
    const { error } = await supabase.from('materials').delete().eq('id', id)
    if (error) alert(error.message)
    else setGoods(goods.filter(g => g.material_id !== id))
  }

  // Strict Active/Inactive Toggle Handler
  const handleToggleActive = async (e: React.MouseEvent, id: string, currentState: boolean, currentStock: number) => {
    e.stopPropagation()
    
    // Don't let them hide an item if it's currently on the shelf
    if (currentState === true && currentStock > 0) {
      alert(`BLOCKED: You cannot flag an item as Inactive while you still have ${currentStock} in stock.`)
      return
    }

    const { error } = await supabase.from('materials').update({ active: !currentState }).eq('id', id)
    if (error) {
      alert(error.message)
    } else {
      // Update local state to reflect the change instantly
      setGoods(goods.map(g => g.material_id === id ? { ...g, active: !currentState } : g))
    }
  }

  const filteredGoods = goods.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()))

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-purple-500">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Shield size={40} />
          <p className="text-xs font-black uppercase tracking-widest text-gray-500">Loading Master Record...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER & SEARCH BAR */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic text-gray-100 mb-1">The Goods</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <Package size={12} className="text-purple-500" /> Master Data Registry
            </p>
          </div>
          <button onClick={() => router.push('/materials/new')} className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-purple-900/20">
            <Plus size={16} /> Add Good
          </button>
        </div>

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
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl pb-24">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-black/50 border-b border-gray-800">
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Name</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500 hidden sm:table-cell">Category</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500 hidden lg:table-cell">Unit</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500 hidden md:table-cell">Default Loc</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">In Stock Qty</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-center">Low Stock</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-center">Status</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-center w-16">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredGoods.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-sm font-bold text-gray-500">No records found.</td>
                  </tr>
                ) : (
                  filteredGoods.map((item) => {
                    const isLowStock = item.reorder_point > 0 && item.current_stock <= item.reorder_point
                    
                    return (
                      <tr 
                        key={item.material_id} 
                        onClick={() => router.push(`/materials/${item.material_id}`)}
                        className={`hover:bg-gray-800/50 transition-colors group cursor-pointer ${item.is_active === false ? 'opacity-50' : ''}`}
                      >
                        <td className="p-4">
                          <p className={`font-bold text-sm transition-colors ${item.is_active === false ? 'text-gray-500 line-through' : 'text-gray-200 group-hover:text-purple-400'}`}>
                            {item.name}
                          </p>
                        </td>
                        <td className="p-4 hidden sm:table-cell">
                          <span className="text-xs font-bold text-gray-400">{item.category || '-'}</span>
                        </td>
                        <td className="p-4 hidden lg:table-cell">
                          <span className="text-xs font-bold text-gray-400 bg-black border border-gray-800 px-2 py-1 rounded-md">{item.unit || 'QTY'}</span>
                        </td>
                        <td className="p-4 hidden md:table-cell text-xs font-bold text-gray-400">
                          {getLocationName(item.default_location_id)}
                        </td>
                        <td className="p-4 text-right">
                          <p className="text-lg font-black tracking-tighter text-purple-400">{item.current_stock || 0}</p>
                        </td>
                        <td className="p-4 text-center">
                          {isLowStock ? (
                            <div className="flex justify-center"><AlertCircle size={16} className="text-yellow-500" /></div>
                          ) : (
                            <span className="text-gray-700">-</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {item.is_active === false ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-red-950/50 text-red-500 px-2 py-1 rounded-md border border-red-900/50">
                              <Ban size={10} /> Inactive
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-green-950/30 text-green-500 px-2 py-1 rounded-md border border-green-900/30">
                              <CheckCircle2 size={10} /> Active
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center relative" onClick={e => e.stopPropagation()}>
                           <ActionDropdown 
                              item={item} 
                              router={router} 
                              onDelete={(e: React.MouseEvent) => handleDelete(e, item.material_id, item.name, item.current_stock || 0)} 
                              onToggleActive={(e: React.MouseEvent) => handleToggleActive(e, item.material_id, item.is_active, item.current_stock || 0)}
                           />
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

// Action Dropdown Component
function ActionDropdown({ item, router, onDelete, onToggleActive }: any) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative inline-block text-left">
      <button 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen) }}
        className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setIsOpen(false) }}></div>
          <div className="absolute right-0 mt-2 w-48 bg-[#0f0f0f] border border-gray-800 rounded-2xl shadow-2xl z-20 py-2 overflow-hidden animate-in fade-in slide-in-from-top-2">
            
            <button onClick={(e) => { e.stopPropagation(); router.push(`/materials/${item.material_id}?edit=true`) }} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-gray-800 transition-colors text-gray-300 flex items-center gap-3">
              <Edit2 size={14} className="text-blue-500" /> Edit Master Data
            </button>
            
            <button onClick={(e) => { e.stopPropagation(); router.push(`/inventory/new?material_id=${item.material_id}`) }} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-gray-800 transition-colors text-gray-300 flex items-center gap-3">
              <ArrowLeftRight size={14} className="text-purple-500" /> Transact
            </button>
            
            <button onClick={(e) => { e.stopPropagation(); alert('Count Tool Coming Soon') }} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-gray-800 transition-colors text-gray-300 flex items-center gap-3">
              <ClipboardList size={14} className="text-yellow-500" /> Count Stock
            </button>
            
            <div className="border-t border-gray-800 my-1"></div>
            
            <button onClick={(e) => { setIsOpen(false); onToggleActive(e) }} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-gray-800 transition-colors text-gray-400 flex items-center gap-3">
              <Ban size={14} /> {item.is_active === false ? 'Flag Active' : 'Flag Inactive'}
            </button>
            
            <button onClick={(e) => { setIsOpen(false); onDelete(e) }} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-red-950/50 hover:text-red-400 transition-colors text-red-500 flex items-center gap-3">
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}