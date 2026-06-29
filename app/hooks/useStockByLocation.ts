'use client'
import { useCallback, useEffect, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/utils/supabase'
import type { Tables } from '@/types/database.types'
import { useOrganization } from '../context/OrganizationContext'

/**
 * Per-location stock balances for the current organization (the `view_stock_by_location`
 * view). Used by the transaction engine to validate draws against on-hand quantities.
 */
export function useStockByLocation() {
  const { organization } = useOrganization()
  const [stockByLocation, setStockByLocation] = useState<Tables<'view_stock_by_location'>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<PostgrestError | null>(null)

  const refetch = useCallback(async () => {
    if (!organization) return
    setLoading(true)

    const { data, error } = await supabase
      .from('view_stock_by_location')
      .select('*')
      .eq('organization_id', organization.id)

    if (error) setError(error)
    else {
      setStockByLocation(data ?? [])
      setError(null)
    }
    setLoading(false)
  }, [organization])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { stockByLocation, loading, error, refetch }
}
