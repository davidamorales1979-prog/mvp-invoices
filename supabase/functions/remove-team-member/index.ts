// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authErr } = await supabaseClient.auth.getUser()
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { memberId } = await req.json()
    if (!memberId) {
      return new Response(JSON.stringify({ error: 'Missing memberId' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Verify the caller is the admin of this member's account
    const { data: member, error: memberErr } = await supabase
      .from('team_members')
      .select('id, account_id, user_id, email')
      .eq('id', memberId)
      .maybeSingle()

    if (memberErr || !member) {
      return new Response(JSON.stringify({ error: 'Team member not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    if (member.account_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Only the account admin can remove team members' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // Delete the team_members row
    const { error: deleteErr } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId)

    if (deleteErr) {
      return new Response(JSON.stringify({ error: 'Failed to remove member: ' + deleteErr.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // Reset the removed member's profile so they become their own admin
    if (member.user_id) {
      await supabase
        .from('profiles')
        .update({ account_id: member.user_id, role: 'admin' })
        .eq('user_id', member.user_id)
    }

    console.log(`remove-team-member: removed ${member.email} from account ${member.account_id}`)
    return new Response(JSON.stringify({ ok: true }), {
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
