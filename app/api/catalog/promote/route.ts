import { createClient } from '@supabase/supabase-js'
import { getServiceClient } from '@/utils/supabase-server'
import type { Database, TablesInsert } from '@/types/database.types'

/**
 * POST /api/catalog/promote  { catalogItemId }
 *
 * Promote one of an org's PRIVATE catalog items into the shared GLOBAL catalog so other Keeps
 * can adopt it. This is the safe, server-side replacement for the old client-side "share to
 * global" checkbox: RLS forbids the browser from writing global rows, so this runs the write
 * with the service-role key — AFTER authorizing the caller.
 *
 * Authorization: the caller sends its Supabase access token (Bearer). We read the catalog item
 * as THAT user; RLS only returns a `private` row if it belongs to one of the user's orgs, so a
 * successful private-row read IS the authorization check.
 *
 * Mechanics (visibility/owner_org_id are immutable by trigger, so we can't just flip the row):
 *   1. Find or create a GLOBAL catalog row (deduped by barcode) copying the identity + nutrition.
 *   2. Repoint the org's org_materials.catalog_item_id from the private row to the global one.
 *   3. Delete the now-orphaned private catalog row.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!url || !anon) return Response.json({ error: 'Server not configured' }, { status: 500 })
  if (!token) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  let catalogItemId: string | undefined
  try {
    catalogItemId = (await request.json())?.catalogItemId
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!catalogItemId) return Response.json({ error: 'catalogItemId is required' }, { status: 400 })

  // Caller-scoped client: RLS applies, so this both identifies the user and authorizes them.
  const userClient = createClient<Database>(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  // RLS returns a private row only if the caller's org owns it -> read success == authorized.
  const { data: item } = await userClient
    .from('catalog_items')
    .select('*')
    .eq('id', catalogItemId)
    .maybeSingle()

  if (!item) return Response.json({ error: 'Item not found or not yours to promote' }, { status: 403 })
  if (item.visibility !== 'private') {
    return Response.json({ error: 'This item is already shared globally.' }, { status: 400 })
  }

  const svc = getServiceClient()
  if (!svc) return Response.json({ error: 'Promotion is not configured on the server' }, { status: 500 })

  const barcode = item.barcode?.trim() || null

  // 1. Reuse an existing global row for this barcode, else create one.
  let globalId: string | null = null
  if (barcode) {
    const { data: existing } = await svc
      .from('catalog_items')
      .select('id')
      .eq('visibility', 'global')
      .eq('barcode', barcode)
      .maybeSingle()
    if (existing) globalId = existing.id
  }

  if (!globalId) {
    const newGlobal: TablesInsert<'catalog_items'> = {
      name: item.name,
      description: item.description,
      barcode: item.barcode,
      category: item.category,
      category_id: item.category_id,
      unit_id: item.unit_id,
      nutrition: item.nutrition,
      source: item.source,
      source_url: item.source_url,
      license: item.license,
      visibility: 'global',
      owner_org_id: null,
    }
    const { data: created, error: createErr } = await svc
      .from('catalog_items')
      .insert(newGlobal)
      .select('id')
      .single()
    if (createErr || !created) {
      return Response.json({ error: 'Failed to create global catalog entry' }, { status: 502 })
    }
    globalId = created.id
  }

  // 2. Repoint the org's policy row(s) from the private identity to the global one.
  const { error: repointErr } = await svc
    .from('org_materials')
    .update({ catalog_item_id: globalId })
    .eq('catalog_item_id', catalogItemId)

  if (repointErr) {
    // 23505 => the org already has an org_material on that global identity.
    if (repointErr.code === '23505') {
      return Response.json(
        { error: 'You already have the shared version of this item in your Keep.' },
        { status: 409 }
      )
    }
    return Response.json({ error: 'Failed to switch the item to the shared catalog' }, { status: 502 })
  }

  // 3. The private identity is now unreferenced — remove it.
  await svc.from('catalog_items').delete().eq('id', catalogItemId)

  return Response.json({ ok: true, globalId })
}
