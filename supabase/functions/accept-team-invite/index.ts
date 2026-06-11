// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Verify the accepting user's JWT
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authErr } = await supabaseClient.auth.getUser()
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Please sign in to accept the invite' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

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

    // Look up the invite
    const { data: invite, error: inviteErr } = await supabase
      .from('team_members')
      .select('*')
      .eq('invite_token', token)
      .maybeSingle()

    if (inviteErr || !invite) {
      return new Response(JSON.stringify({ error: 'Invite not found or expired' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    if (invite.status === 'active') {
      return new Response(JSON.stringify({ error: 'This invite has already been accepted' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 409,
      })
    }

    // Check this user is not already a member of a different account
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('account_id, role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingProfile?.account_id && existingProfile.account_id !== user.id && existingProfile.account_id !== invite.account_id) {
      return new Response(JSON.stringify({ error: 'You are already a member of another team' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 409,
      })
    }

    // Get admin's profile for company name / contractor names
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('company_name, name1, name2, name3')
      .eq('user_id', invite.account_id)
      .maybeSingle()

    // Mark invite as accepted
    const { error: updateErr } = await supabase
      .from('team_members')
      .update({ user_id: user.id, status: 'active', joined_at: new Date().toISOString() })
      .eq('invite_token', token)

    if (updateErr) {
      return new Response(JSON.stringify({ error: 'Failed to accept invite: ' + updateErr.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // Upsert the member's profile linking them to this account
    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert({
        user_id: user.id,
        account_id: invite.account_id,
        role: 'member',
        company_name: adminProfile?.company_name || '',
        name1: adminProfile?.name1 || null,
        name2: adminProfile?.name2 || null,
        name3: adminProfile?.name3 || null,
      }, { onConflict: 'user_id' })

    if (profileErr) {
      console.error('accept-team-invite: profile upsert failed:', profileErr.message)
    }

    console.log(`accept-team-invite: user ${user.id} joined account ${invite.account_id}`)
    return new Response(JSON.stringify({
      ok: true,
      company: adminProfile?.company_name || 'FieldQuote Team',
      role: 'member',
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
