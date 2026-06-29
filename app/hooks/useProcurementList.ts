'use client'
import { useCallback, useEffect, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/utils/supabase'
import { getProcurementList, type StockRow } from '@/lib/mrp'
import { useOrganization } from '../context/OrganizationContext'

/**
 * The list of goods that have fallen to or below their reorder point for the current
 * organization. Fetches current stock from `view_current_stock` and applies the pure MRP
 * filter from `lib/mrp`, so the "what needs restocking" rule lives in one tested place.
 */
export function useProcurementList() {
  const { organization } = useOrganization()
  const [items, setItems] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<PostgrestError | null>(null)

  const refetch = useCallback(async () => {
    if (!organization) return
    setLoading(true)

    const { data, error } = await supabase
      .from('view_current_stock')
      .select('*')
      .eq('organization_id', organization.id)

    if (error) setError(error)
    else {
      setItems(getProcurementList(data ?? []))
      setError(null)
    }
    setLoading(false)
  }, [organization])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { items, loading, error, refetch }
}
