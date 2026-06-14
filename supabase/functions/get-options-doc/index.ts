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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data, error } = await supabase
      .from('documents')
      .select('doc_number, client, address, contractor, user_id, quote_options, selected_option_idx')
      .eq('options_token', token)
      .maybeSingle()

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404,
      })
    }

    if (!data.quote_options || data.quote_options.length === 0) {
      return new Response(JSON.stringify({ error: 'No options configured for this quote' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404,
      })
    }

    // Fetch contractor logo
    const { data: profile } = await supabase
      .from('profiles')
      .select('logo_url')
      .eq('user_id', data.user_id)
      .maybeSingle()

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const logoPublicUrl = profile?.logo_url
      ? `${supabaseUrl}/storage/v1/object/public/logos/${profile.logo_url}`
      : null

    return new Response(JSON.stringify({ ...data, logo_url: logoPublicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
