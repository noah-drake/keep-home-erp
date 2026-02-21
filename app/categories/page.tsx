'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState, Suspense } from 'react'
import { useOrganization } from '../context/OrganizationContext'
import { Filter, Plus, Edit2, Trash2, X, Save, Globe } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function CategoriesContent() {
  const { organization } = useOrganization()
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Form State
  const [newName, setNewName] = useState('')
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const fetchCategories = async () => {
    if (!organization) return
    setLoading(true)
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name')
    if (data) setCategories(data)
    setLoading(false)
  }

  useEffect(() => { fetchCategories() }, [organization])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !organization) return
    const { error } = await supabase.from('categories').insert([{ 
      name: newName, 
      organization_id: organization.id 
    }])
    if (error) alert(error.message)
    else { setNewName(''); fetchCategories(); }
  }

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return
    const { error } = await supabase.from('categories').update({ name: editName }).eq('id', id)
    if (error) alert(error.message)
    else { setEditingId(null); fetchCategories(); }
  }

  const handleDelete = async (id: string, name: string) => {
    // Relational Lock: Check if any materials use this category_id
    const { count } = await supabase.from('materials').select('*', { count: 'exact', head: true }).eq('category_id', id)
    if (count && count > 0) return alert(`BLOCKED: Cannot delete "${name}". It is currently assigned to ${count} master goods.`)

    if (confirm(`Are you sure you want to delete the category "${name}"?`)) {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) alert(error.message)
      else fetchCategories()
    }
  }

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-purple-500 font-black uppercase tracking-widest">Loading Library...</div>

  return (
    <div className="min-h-screen p-4 md:p-8 bg-[#0a0a0a] text-white font-sans pb-32">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <header className="border-b border-gray-800 pb-6">
          <h1 className="text-4xl font-black mb-1 uppercase tracking-tighter italic text-gray-100">Category Library</h1>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <Filter size={12} className="text-purple-500" /> Goods Classification
          </p>
        </header>

        {/* CREATE NEW FORM */}
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 bg-[#0f0f0f] p-6 rounded-[2rem] border border-gray-800 shadow-xl">
          <input 
            className="bg-black border border-gray-800 p-4 rounded-2xl flex-1 outline-none focus:border-purple-500 text-sm font-bold transition-colors" 
            placeholder="Category Name (e.g. Perishables, Hardware)" 
            value={newName} 
            onChange={e => setNewName(e.target.value)} 
            required
          />
          <button type="submit" className="bg-purple-600 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-purple-500 transition-colors shadow-lg active:scale-95 flex items-center justify-center gap-2">
            <Plus size={14} /> Add Category
          </button>
        </form>

        {/* LIST GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(c => {
            const isGlobal = c.organization_id === null;
            return (
              <div key={c.id} className={`p-5 rounded-[2rem] border flex flex-col justify-center bg-gray-900 transition-all min-h-[100px] ${isGlobal ? 'border-gray-800 opacity-70' : 'border-purple-900/30 hover:border-purple-500/50'}`}>
                {editingId === c.id ? (
                  <div className="space-y-3">
                    <input className="bg-black border border-purple-500 p-3 rounded-xl w-full outline-none text-sm font-bold" value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
                    <div className="flex gap-2 text-[10px] font-black uppercase w-full mt-2">
                      <button onClick={() => handleUpdate(c.id)} className="flex-1 bg-green-900/20 text-green-500 border border-green-900/50 py-2 rounded-lg hover:bg-green-900/40 flex justify-center"><Save size={12}/></button>
                      <button onClick={() => setEditingId(null)} className="flex-1 bg-gray-800 text-gray-400 border border-gray-700 py-2 rounded-lg hover:bg-gray-700 flex justify-center"><X size={12}/></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <span className="font-black text-lg tracking-tight text-gray-200 block">{c.name}</span>
                    
                    {isGlobal ? (
                       <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-blue-500 bg-blue-950/30 px-2 py-1 rounded-md border border-blue-900/30">
                         <Globe size={10} /> Global
                       </span>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingId(c.id); setEditName(c.name); }} className="p-2 text-gray-500 hover:text-purple-400 bg-black rounded-lg border border-gray-800 transition-colors"><Edit2 size={12}/></button>
                        <button onClick={() => handleDelete(c.id, c.name)} className="p-2 text-gray-500 hover:text-red-500 bg-black rounded-lg border border-gray-800 transition-colors"><Trash2 size={12}/></button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function CategoriesPage() { return <Suspense fallback={<div className="min-h-screen bg-black" />}><CategoriesContent /></Suspense> }