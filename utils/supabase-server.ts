import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client — SERVER ONLY. It bypasses Row-Level Security, so it must never
 * be imported into a client component or exposed to the browser. Use it only inside route
 * handlers / server code for privileged writes the anon client can't do (e.g. inserting GLOBAL
 * catalog_items, which RLS forbids to normal users).
 *
 * Returns null until SUPABASE_SERVICE_ROLE_KEY is configured, so callers degrade gracefully
 * (the app keeps working without the privileged path until the key + migration are in place).
 */
export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
