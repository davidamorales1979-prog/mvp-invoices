import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pytrskbaoreopnwpasjw.supabase.co'
const supabaseKey = 'sb_publishable_WVeMdssSPUomRkywaYjTuA_cE9pWtnm'

export const supabase = createClient(supabaseUrl, supabaseKey)
