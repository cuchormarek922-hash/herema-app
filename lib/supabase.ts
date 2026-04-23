import { createBrowserClient } from '@supabase/ssr'

// Browser client — stores session in cookies so middleware can read it
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
