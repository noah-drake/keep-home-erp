'use client'
import { useCallback, useEffect, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/utils/supabase'
import type { Enums } from '@/types/database.types'
import { useOrganization } from '../context/OrganizationContext'

/**
 * Flat per-org good. `id` is the org_materials id (== legacy material id / inventory key); the
 * identity fields (name/barcode/unit_id/category) are pulled from the joined catalog_items row.
 */
export interface KeepMaterial {
  id: string
  name: string
  default_location_id: string | null
  barcode: string | null
  unit_id: string | null
  category: Enums<'material_category'> | null
  is_active: boolean
}

/** Shape of the catalog_items embed Supabase returns for the select below. */
interface CatalogEmbed {
  name: string
  barcode: string | null
  unit_id: string | null
  category: Enums<'material_category'> | null
  category_id: number | null
  description: string | null
}

/**
 * Active goods for the current organization, ordered by name. Reads policy from `org_materials`
 * joined to its `catalog_items` identity. Returns the flat list plus loading/error state and a
 * `refetch`.
 */
export function useMaterials() {
  const { organization } = useOrganization()
  const [materials, setMaterials] = useState<KeepMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<PostgrestError | null>(null)

  const refetch = useCallback(async () => {
    if (!organization) return
    setLoading(true)

    const { data, error } = await supabase
      .from('org_materials')
      .select(
        'id, default_location_id, reorder_point, lot_quantity, is_mrp_enabled, is_active, catalog_items(name, barcode, unit_id, category, category_id, description)'
      )
      .eq('organization_id', organization.id)
      .eq('is_active', true)

    if (error) {
      setError(error)
    } else {
      const mapped: KeepMaterial[] = (data ?? []).map((row) => {
        // Supabase types a to-one embed as an object; guard defensively.
        const catalog = (Array.isArray(row.catalog_items)
          ? row.catalog_items[0]
          : row.catalog_items) as CatalogEmbed | null
        return {
          id: row.id,
          name: catalog?.name ?? '',
          default_location_id: row.default_location_id,
          barcode: catalog?.barcode ?? null,
          unit_id: catalog?.unit_id ?? null,
          category: catalog?.category ?? null,
          is_active: row.is_active,
        }
      })
      // Name lives on the joined table, so order client-side after mapping.
      mapped.sort((a, b) => a.name.localeCompare(b.name))
      setMaterials(mapped)
      setError(null)
    }
    setLoading(false)
  }, [organization])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { materials, loading, error, refetch }
}
