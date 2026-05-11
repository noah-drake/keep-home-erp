'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { supabase } from '@/utils/supabase'
import { useOrganization } from '@/app/context/OrganizationContext'
import type { Tables, TablesInsert } from '@/types/database.types'

const BarcodeScanner = dynamic(() => import('@/app/components/BarcodeScanner'), { ssr: false })

type MaterialInsert = TablesInsert<'materials'>

export default function ScannerPage() {
  const router = useRouter()
  const { organization } = useOrganization()
  const [paused, setPaused] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleScanSuccess = async (decodedText: string) => {
    if (!organization?.id || processing) return

    setPaused(true)
    setProcessing(true)
    setError(null)

    try {
      // Step 1: Check if material exists in local organization
      const { data: localMaterial, error: localError } = await supabase
        .from('materials')
        .select('id')
        .eq('barcode', decodedText)
        .eq('organization_id', organization.id)
        .single()

      if (localMaterial) {
        // Found in local organization - route to inventory
        router.push(`/inventory?material_id=${localMaterial.id}`)
        return
      }

      // Step 2: Check if material exists in global catalog
      const { data: globalMaterial, error: globalError } = await supabase
        .from('materials')
        .select('*')
        .eq('barcode', decodedText)
        .eq('is_global', true)
        .single()

      if (globalMaterial) {
        // Found in global catalog - clone to local organization
        const clonePayload: MaterialInsert = {
          name: globalMaterial.name,
          description: globalMaterial.description,
          category_id: globalMaterial.category_id,
          unit_id: globalMaterial.unit_id,
          reorder_point: globalMaterial.reorder_point,
          lot_quantity: globalMaterial.lot_quantity,
          is_mrp_enabled: globalMaterial.is_mrp_enabled,
          barcode: globalMaterial.barcode,
          default_location_id: null,
          organization_id: organization.id,
          is_global: false,
          is_active: true,
        }

        const { data: newMaterial, error: insertError } = await supabase
          .from('materials')
          .insert(clonePayload)
          .select()
          .single()

        if (insertError) throw insertError

        // Route to inventory with the newly cloned material
        router.push(`/inventory?material_id=${newMaterial.id}`)
        return
      }

      // Step 3: No match found - route to new material creation with barcode pre-filled
      router.push(`/materials/new?barcode=${decodedText}`)
    } catch (err) {
      console.error('Error processing barcode scan:', err)
      setError(err instanceof Error ? err.message : 'Failed to process barcode')
      setPaused(false)
    } finally {
      setProcessing(false)
    }
  }

  const handleBack = () => {
    router.back()
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-bold text-sm uppercase tracking-widest">Back</span>
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${paused || processing ? 'bg-yellow-500' : 'bg-green-500'}`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              {paused || processing ? 'Paused' : 'Scanning'}
            </span>
          </div>
        </div>

        {/* Scanner */}
        <div className="mb-8">
          <h1 className="text-3xl font-black uppercase tracking-tight text-gray-100 mb-2">
            Scan Barcode
          </h1>
          <p className="text-sm text-gray-500 font-bold mb-6">
            Point your camera at a barcode to locate or create inventory items
          </p>

          <BarcodeScanner onScanSuccess={handleScanSuccess} paused={paused} />
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-3 border bg-red-950/20 border-red-900/50 text-red-400 mb-6">
            <span>Error: {error}</span>
            <button
              onClick={() => {
                setError(null)
                setPaused(false)
              }}
              className="ml-auto text-white hover:text-red-300"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Processing Indicator */}
        {processing && (
          <div className="p-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-3 border bg-purple-950/20 border-purple-900/50 text-purple-400">
            <Loader2 size={16} className="animate-spin" />
            <span>Processing barcode...</span>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 p-6 bg-black border border-gray-800 rounded-2xl">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
            How It Works
          </h3>
          <ul className="space-y-2 text-[10px] font-bold text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-purple-500">1.</span>
              <span>Scan a barcode to search your local inventory</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500">2.</span>
              <span>If not found locally, we search the global catalog</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500">3.</span>
              <span>If found globally, we clone it to your organization</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500">4.</span>
              <span>If no match exists, we create a new item with that barcode</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
