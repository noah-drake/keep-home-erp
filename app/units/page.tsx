'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useOrganization } from '../context/OrganizationContext'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function UnitsPage() {
  const { organization } = useOrganization()
  const [units, setUnits] = useState<any[]>([])
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const fetchUnits = async () => {
    const { data } = await supabase.from('units').select('*').order('name')
    if (data) setUnits(data)
  }

  useEffect(() => { fetchUnits() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !organization) return
    const { error } = await supabase.from('units').insert([{ name: newName, organization_id: organization.id }])
    if (error) alert(error.message)
    else { setNewName(''); fetchUnits(); }
  }

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return
    const { error } = await supabase.from('units').update({ name: editName }).eq('id', id)
    if (error) alert(error.message)
    else { setEditingId(null); fetchUnits(); }
  }

  const handleDelete = async (id: string, name: string) => {
    const { count } = await supabase.from('materials').select('*', { count: 'exact', head: true }).eq('unit', name)
    if (count && count > 0) return alert("Blocked: This unit is currently used by materials.")

    if (confirm("Delete this unit globally?")) {
      const { error } = await supabase.from('units').delete().eq('id', id)
      if (error) alert(error.message)
      else fetchUnits()
    }
  }

  return (
    <div className="min-h-screen p-8 text-white font-sans">
      <h1 className="text-3xl font-black mb-2 uppercase tracking-tighter">Unit Library</h1>
      <p className="text-gray-500 text-xs font-bold uppercase mb-8">Shared Standards</p>
      
      <form onSubmit={handleAdd} className="flex gap-4 mb-10 bg-gray-900 p-4 rounded-2xl border border-gray-800">
        <input className="bg-black border border-gray-700 p-3 rounded-xl flex-1 outline-none focus:border-purple-500" placeholder="e.g. Gallons, Liters..." value={newName} onChange={e => setNewName(e.target.value)} />
        <button className="bg-purple-600 px-8 rounded-xl font-bold hover:bg-purple-500 transition-colors">Add Unit</button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {units.map(u => {
          const isOwner = u.organization_id === organization?.id;
          return (
            <div key={u.id} className={`p-4 rounded-xl border flex justify-between items-center bg-gray-900 transition-all ${isOwner ? 'border-purple-500/40' : 'border-gray-800 opacity-60'}`}>
              {editingId === u.id ? (
                <div className="flex items-center w-full gap-2">
                  <input className="bg-black border border-purple-500 p-1 rounded-lg w-3/5 outline-none text-sm" value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
                  <div className="flex gap-2 text-[9px] font-black uppercase flex-1 justify-end">
                    <button onClick={() => handleUpdate(u.id)} className="text-green-400">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-gray-500">Cancel</button>
                    <button onClick={() => handleDelete(u.id, u.name)} className="text-red-600">Del</button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="font-bold truncate pr-2">{u.name}</span>
                  {isOwner && (
                    <button onClick={() => { setEditingId(u.id); setEditName(u.name); }} className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Edit</button>
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