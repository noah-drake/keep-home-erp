import { getProductLookup } from '@/lib/integrations/product-lookup'

/**
 * GET /api/catalog/lookup?barcode=XXXX
 *
 * Server-side product lookup for a scanned barcode. Runs the configured provider chain
 * (Open Food Facts -> USDA) where the mandatory User-Agent and any API keys stay off the
 * client bundle and CORS is avoided. Returns a normalized CatalogDraft for the new-good form
 * to prefill.
 *
 * NOTE (Phase 1 completion): once the shared-catalog migration is applied and a service-role
 * Supabase client exists (utils/supabase-server.ts), this route should ALSO upsert the draft as
 * a global `catalog_items` row (visibility='global') so every org benefits from one fetch. That
 * write must run as service_role (authenticated users may only insert private rows per RLS).
 * For now it only returns the draft, which works against the current schema.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const barcode = new URL(request.url).searchParams.get('barcode')?.trim()
  if (!barcode) {
    return Response.json({ error: 'barcode query parameter is required' }, { status: 400 })
  }

  try {
    const draft = await getProductLookup().lookup(barcode)
    if (!draft) {
      return Response.json({ found: false }, { status: 404 })
    }
    return Response.json({ found: true, draft })
  } catch (err) {
    console.error('product lookup failed:', err)
    return Response.json({ error: 'product lookup failed' }, { status: 502 })
  }
}
