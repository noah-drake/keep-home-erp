'use client'
import { useCallback, useEffect, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/utils/supabase'
import type { Tables } from '@/types/database.types'
import { useOrganization } from '../context/OrganizationContext'

/** All storage locations (stores/chambers) for the current organization, ordered by name. */
export function useLocations() {
  const { organization } = useOrganization()
  const [locations, setLocations] = useState<Tables<'locations'>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<PostgrestError | null>(null)

  const refetch = useCallback(async () => {
    if (!organization) return
    setLoading(true)

    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('organization_id', organization.id)
      .order('name')

    if (error) setError(error)
    else {
      setLocations(data ?? [])
      setError(null)
    }
    setLoading(false)
  }, [organization])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { locations, loading, error, refetch }
}
