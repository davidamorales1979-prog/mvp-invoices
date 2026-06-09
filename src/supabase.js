import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pytrskbaoreopnwpasjw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5dHJza2Jhb3Jlb3Bud3Bhc2p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDQxNDksImV4cCI6MjA5NjE4MDE0OX0.F_8-r7hs9wksYtKSETP5aEcIrSF1YMkhrC5U9SDlGrk'

export const supabase = createClient(supabaseUrl, supabaseKey)
