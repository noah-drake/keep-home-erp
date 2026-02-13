'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useOrganization } from '../context/OrganizationContext'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function CategoriesPage() {
  const { organization } = useOrganization()
  const [categories, setCategories] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const fetchCats = async () => {
    const { data } = await supabase.from('categories').select('*').order('name')
    if (data) setCategories(data)
  }

  useEffect(() => { fetchCats() }, [])

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return
    const { error } = await supabase.from('categories').update({ name: editName }).eq('id', id)
    if (error) alert(error.message)
    else { setEditingId(null); fetchCats(); }
  }

  const handleDelete = async (id: string) => {
    const { count } = await supabase.from('materials').select('*', { count: 'exact', head: true }).eq('category_id', id)
    if (count && count > 0) return alert("Blocked: This category is currently assigned to materials.")

    if (confirm("Permanently delete this category?")) {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) alert(error.message)
      else fetchCats()
    }
  }

  return (
    <div className="min-h-screen p-8 text-white font-sans">
      <h1 className="text-3xl font-black mb-8 uppercase tracking-tighter">Category Library</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {categories.map(c => {
          const isOwner = c.organization_id === organization?.id;
          return (
            <div key={c.id} className={`p-4 rounded-xl border flex justify-between items-center bg-gray-900 transition-all ${isOwner ? 'border-purple-500/40' : 'border-gray-800 opacity-60'}`}>
              
              {editingId === c.id ? (
                <div className="flex items-center w-full gap-2">
                  {/* Shrink the text box to give the buttons room */}
                  <input 
                    className="bg-black border border-purple-500 p-1 rounded-lg w-3/5 outline-none text-sm" 
                    value={editName} 
                    onChange={e => setEditName(e.target.value)} 
                    autoFocus 
                  />
                  <div className="flex gap-2 text-[9px] font-black uppercase flex-1 justify-end">
                    <button onClick={() => handleUpdate(c.id)} className="text-green-400 hover:text-green-300">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-300">Cancel</button>
                    <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:text-red-400">Delete</button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="font-bold capitalize truncate pr-2">{c.name}</span>
                  {isOwner && (
                    <button 
                      onClick={() => { setEditingId(c.id); setEditName(c.name); }} 
                      className="text-[10px] font-black text-purple-400 uppercase tracking-widest hover:text-white"
                    >
                      Edit
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}