'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, MapPin, Search } from 'lucide-react'
import { useOrganization } from '../context/OrganizationContext'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function LocationsPage() {
  const { organization } = useOrganization()
  const [locations, setLocations] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [newName, setNewName] = useState('')

  const fetchLocs = async () => {
    if (!organization) return
    const { data } = await supabase.from('locations').select('*').eq('organization_id', organization.id).order('name')
    setLocations(data || [])
  }

  useEffect(() => { fetchLocs() }, [organization])

  const handleUpdate = async (id: string) => {
    await supabase.from('locations').update({ name: editName }).eq('id', id)
    setEditingId(null)
    fetchLocs()
  }

  const handleDelete = async (id: string) => {
    const { data: stock } = await supabase.from('view_stock_by_location').select('quantity').eq('location_id', id).gt('quantity', 0)
    if (stock && stock.length > 0) return alert("Blocked: Location still contains items.")
    if (confirm("Delete this location?")) {
      await supabase.from('locations').delete().eq('id', id)
      fetchLocs()
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !organization) return
    await supabase.from('locations').insert([{ name: newName, organization_id: organization.id }])
    setNewName('')
    fetchLocs()
  }

  return (
    <div className="min-h-screen p-4 md:p-8 text-white font-sans max-w-5xl mx-auto">
      <div className="mb-12">
        <h1 className="text-4xl font-black uppercase tracking-tighter italic">Plant Locations</h1>
        <p className="text-gray-500 font-bold text-[10px] uppercase tracking-widest mt-2">Manage physical storage zones for {organization?.name}</p>
      </div>

      <form onSubmit={handleAdd} className="flex gap-4 mb-10 bg-gray-900 p-4 rounded-3xl border border-gray-800 shadow-xl">
        <input className="flex-1 bg-black border border-gray-700 p-3 rounded-2xl outline-none focus:border-purple-500 transition-colors" placeholder="New Storage Zone Name..." value={newName} onChange={e => setNewName(e.target.value)} />
        <button className="bg-white text-black px-8 rounded-2xl font-black uppercase text-xs hover:bg-purple-600 hover:text-white transition-all">Add Zone</button>
      </form>

      <div className="grid grid-cols-1 gap-4">
        {locations.map(l => (
          <div key={l.id} className="p-6 bg-gray-900/50 border border-gray-800 rounded-[2rem] flex justify-between items-center group hover:border-purple-500/50 transition-all">
            <div className="flex items-center gap-6 flex-1">
              <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-gray-700 group-hover:text-purple-500 transition-colors">
                <MapPin size={24} />
              </div>
              
              {editingId === l.id ? (
                <input className="bg-black border border-purple-500 p-2 rounded-xl w-1/2 outline-none text-purple-400" value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
              ) : (
                <Link href={`/locations/${l.id}`} className="flex-1">
                   <h2 className="text-2xl font-black tracking-tight uppercase group-hover:text-purple-400 transition-colors">{l.name}</h2>
                   <span className="text-[10px] font-bold text-gray-600 uppercase flex items-center gap-1 mt-1">
                        <Search size={10} /> Click to View Contents
                   </span>
                </Link>
              )}
            </div>

            <div className="flex gap-4 text-[10px] font-black uppercase">
              {editingId === l.id ? (
                <>
                  <button onClick={() => handleUpdate(l.id)} className="text-green-400">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-gray-500">Cancel</button>
                  <button onClick={() => handleDelete(l.id)} className="text-red-700">Delete</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditingId(l.id); setEditName(l.name); }} className="text-gray-500 group-hover:text-white transition-colors">Edit</button>
                  <ArrowRight className="text-gray-800 group-hover:text-purple-500 transition-all group-hover:translate-x-1" />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}