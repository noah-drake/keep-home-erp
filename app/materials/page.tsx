'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useOrganization } from '../context/OrganizationContext'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function MaterialsMasterPage() {
  const { organization } = useOrganization()
  const [items, setItems] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', active: true })
  const [historyCheck, setHistoryCheck] = useState<Record<string, number>>({})

  const fetchData = async () => {
    if (!organization) return 
    const { data: mats } = await supabase.from('materials').select('*, categories(name), locations(name)').eq('organization_id', organization.id).order('name')
    const { data: moves } = await supabase.from('inventory_movements').select('material_id')
    
    // Count history occurrences for delete logic
    const counts = (moves || []).reduce((acc: any, cur: any) => {
        acc[cur.material_id] = (acc[cur.material_id] || 0) + 1
        return acc
    }, {})

    if (mats) setItems(mats)
    setHistoryCheck(counts)
  }

  useEffect(() => { fetchData() }, [organization])

  const saveQuickEdit = async (id: string) => {
    await supabase.from('materials').update({ name: editForm.name, active: editForm.active }).eq('id', id)
    setEditingId(null)
    fetchData()
  }

  const handleDelete = async (id: string) => {
    if (confirm("Delete this material?")) {
        await supabase.from('materials').delete().eq('id', id)
        fetchData()
    }
  }

  return (
    <div className="min-h-screen p-8 text-white font-sans">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-4xl font-black uppercase tracking-tighter">Materials Master</h1>
        <Link href="/new-material" className="bg-purple-600 px-6 py-2 rounded-xl font-bold hover:bg-purple-500">+ Add New</Link>
      </div>

      <div className="bg-gray-900 rounded-3xl border border-gray-800 overflow-x-auto shadow-2xl">
        <table className="w-full text-left text-sm min-w-[800px]">
          <thead className="bg-black text-gray-500 text-[10px] font-black uppercase tracking-widest border-b border-gray-800">
            <tr>
              <th className="p-6">Material</th>
              <th className="p-6">Category</th>
              <th className="p-6">Description</th>
              <th className="p-6">Def. Location</th>
              <th className="p-6">Unit</th>
              <th className="p-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {items.map((item) => {
              const hasHistory = historyCheck[item.id] > 0;
              return (
                <tr key={item.id} className="hover:bg-gray-800/30">
                  <td className="p-6">
                    {editingId === item.id ? (
                      <input className="bg-black border border-purple-500 p-2 rounded-xl w-full text-purple-400 outline-none" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                    ) : (
                      <Link href={`/materials/${item.id}`} className="font-black hover:text-purple-400">{item.name}</Link>
                    )}
                  </td>
                  <td className="p-6">
                    <span className="bg-purple-900/20 text-purple-400 px-2 py-1 rounded-full text-[10px] font-black uppercase border border-purple-800 tracking-widest">
                        {item.categories?.name || 'General'}
                    </span>
                  </td>
                  <td className="p-6 text-gray-500 text-xs italic truncate max-w-[150px]">{item.description || '-'}</td>
                  <td className="p-6 text-xs font-bold text-gray-400 uppercase">{item.locations?.name || 'Not Set'}</td>
                  <td className="p-6 font-mono text-xs">{item.unit}</td>
                  <td className="p-6 text-right">
                    {editingId === item.id ? (
                      <div className="flex flex-col items-end gap-2 text-[9px] font-black uppercase">
                        <div className="flex gap-3">
                            <button onClick={() => saveQuickEdit(item.id)} className="text-green-400">Save</button>
                            <button onClick={() => setEditingId(null)} className="text-gray-500">Cancel</button>
                            {!hasHistory && <button onClick={() => handleDelete(item.id)} className="text-red-700">Delete</button>}
                        </div>
                        <button onClick={() => setEditForm({...editForm, active: !editForm.active})} className={editForm.active ? 'text-green-500' : 'text-red-500'}>
                            {editForm.active ? '● Active' : '○ Inactive'}
                        </button>
                        {hasHistory && <span className="text-[8px] text-gray-600 lowercase tracking-normal">Locked: Item has history</span>}
                      </div>
                    ) : (
                      <button onClick={() => { setEditingId(item.id); setEditForm({ name: item.name, active: item.active }); }} className="text-gray-500 hover:text-white font-black uppercase text-[10px]">Edit</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}