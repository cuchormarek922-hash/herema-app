import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Use auth-helpers client — stores session in cookies so middleware can read it
export const supabase = createClientComponentClient()
