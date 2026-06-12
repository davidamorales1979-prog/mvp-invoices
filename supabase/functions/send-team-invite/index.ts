// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APP_URL = 'https://mvp-invoices.vercel.app'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Verify the caller's JWT
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authErr } = await supabaseClient.auth.getUser()
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
      })
    }

    const { email } = await req.json()
    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing email' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Verify caller is an account admin
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role, company_name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (callerProfile?.role !== 'admin' && callerProfile?.role !== 'owner') {
      return new Response(JSON.stringify({ error: 'Only account admins can invite team members.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403,
      })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const company = callerProfile?.company_name || 'FieldQuote'

    // Check for an existing invite for this email + account
    const { data: existing } = await supabase
      .from('team_members')
      .select('id, invite_token, status')
      .eq('account_id', user.id)
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existing?.status === 'active') {
      return new Response(JSON.stringify({ error: `${normalizedEmail} is already an active team member.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409,
      })
    }

    // Create invite record if none exists; reuse token if pending
    let inviteToken: string
    if (existing?.invite_token) {
      inviteToken = existing.invite_token
    } else {
      const { data: newMember, error: insertErr } = await supabase
        .from('team_members')
        .insert([{
          account_id: user.id,
          email: normalizedEmail,
          role: 'member',
          status: 'pending',
        }])
        .select('invite_token')
        .single()

      if (insertErr || !newMember) {
        return new Response(JSON.stringify({ error: insertErr?.message || 'Failed to create invite' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
        })
      }
      inviteToken = newMember.invite_token
    }

    const redirectTo = `${APP_URL}/?join=${inviteToken}`

    // Send invite email via Supabase Auth Admin
    const { error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(normalizedEmail, {
      redirectTo,
      data: { invited_by: user.id, company },
    })

    if (inviteErr) {
      // User already has a confirmed account — return the join link for manual sharing
      const alreadyExists =
        inviteErr.message?.toLowerCase().includes('already') ||
        inviteErr.message?.toLowerCase().includes('registered') ||
        inviteErr.status === 422

      if (alreadyExists) {
        console.log(`send-team-invite: ${normalizedEmail} already exists, returning manual link`)
        return new Response(JSON.stringify({
          ok: true,
          manualLink: redirectTo,
          message: `${normalizedEmail} already has a FieldQuote account. Share this link to invite them:`,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
        })
      }
      return new Response(JSON.stringify({ error: 'Failed to send invite email: ' + inviteErr.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      })
    }

    console.log(`send-team-invite: emailed ${normalizedEmail} for account ${user.id} (${company})`)
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
