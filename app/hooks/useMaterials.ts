'use client'
import { useCallback, useEffect, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/utils/supabase'
import type { Tables } from '@/types/database.types'
import { useOrganization } from '../context/OrganizationContext'

interface UseMaterialsOptions {
  /** Also include shared/global goods (organization_id is null), e.g. for audits. */
  includeGlobal?: boolean
}

/**
 * Active goods for the current organization, ordered by name. Pass `includeGlobal` to also
 * pull the shared catalog. Returns the list plus loading/error state and a `refetch`.
 */
export function useMaterials({ includeGlobal = false }: UseMaterialsOptions = {}) {
  const { organization } = useOrganization()
  const [materials, setMaterials] = useState<Tables<'materials'>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<PostgrestError | null>(null)

  const refetch = useCallback(async () => {
    if (!organization) return
    setLoading(true)

    const base = supabase.from('materials').select('*').eq('is_active', true)
    const scoped = includeGlobal
      ? base.or(`organization_id.eq.${organization.id},organization_id.is.null`)
      : base.eq('organization_id', organization.id)

    const { data, error } = await scoped.order('name')
    if (error) setError(error)
    else {
      setMaterials(data ?? [])
      setError(null)
    }
    setLoading(false)
  }, [organization, includeGlobal])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { materials, loading, error, refetch }
}
