// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { token } = await req.json()
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: invite, error: inviteErr } = await supabase
      .from('team_members')
      .select('id, account_id, email, status, role, invited_at')
      .eq('invite_token', token)
      .maybeSingle()

    if (inviteErr || !invite) {
      return new Response(JSON.stringify({ error: 'Invite not found or expired' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    // Get the account owner's profile for the company name
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_name')
      .eq('user_id', invite.account_id)
      .maybeSingle()

    return new Response(JSON.stringify({
      status: invite.status,
      email: invite.email,
      role: invite.role,
      company: profile?.company_name || 'FieldQuote Team',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
