'use client'

import { Suspense, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Barcode } from 'lucide-react'
import { supabase } from '@/utils/supabase'
import { useOrganization } from '../context/OrganizationContext'
import BarcodeScanner from '../components/BarcodeScanner'

function ScannerContent() {
  const router = useRouter()
  const { organization } = useOrganization()
  const [routing, setRouting] = useState(false)

  // Resolve a decoded barcode to a destination: a known good jumps straight into the
  // transaction engine pre-selected; an unknown code opens the new-good form with the
  // barcode pre-filled so the next scan will find it.
  const handleScan = useCallback(async (decodedText: string) => {
    const code = decodedText.trim()
    if (!code) return
    setRouting(true)

    if (!organization) {
      router.replace(`/materials/new?barcode=${encodeURIComponent(code)}`)
      return
    }

    const { data, error } = await supabase
      .from('materials')
      .select('id')
      .eq('barcode', code)
      .or(`organization_id.eq.${organization.id},organization_id.is.null`)
      .limit(1)

    if (!error && data && data.length > 0) {
      router.replace(`/inventory?material_id=${data[0].id}`)
    } else {
      router.replace(`/materials/new?barcode=${encodeURIComponent(code)}`)
    }
  }, [organization, router])

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans">
      <div className="max-w-lg mx-auto space-y-6">

        <header className="border-b border-gray-800 pb-4 flex items-center gap-4">
          <button onClick={() => router.back()} className="p-3 bg-gray-900 border border-gray-800 rounded-xl text-gray-400 hover:text-white transition-all" aria-label="Go back">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-2">
              <Barcode size={22} className="text-purple-500" /> Optics Scan
            </h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mt-1">Point the camera at a barcode</p>
          </div>
        </header>

        <BarcodeScanner onScanSuccess={handleScan} />

        <p className="text-center text-[10px] font-black uppercase tracking-widest text-gray-600">
          {routing ? 'Locating Good...' : 'Hold steady — the reticle will lock on automatically'}
        </p>
      </div>
    </div>
  )
}

export default function ScannerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <ScannerContent />
    </Suspense>
  )
}
