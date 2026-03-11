import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Globally typed Supabase client. Use this everywhere instead of createClient().
 * Typed with Database from @/types/database.types for full table/view/enum inference.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

export type SupabaseClient = ReturnType<typeof createClient<Database>>
