// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { token, signerName, signatureData } = await req.json()

    if (!token || !signerName || !signatureData) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: existing, error: lookupErr } = await supabase
      .from('documents')
      .select('id, signed_at')
      .eq('signature_token', token)
      .maybeSingle()

    if (lookupErr || !existing) {
      return new Response(JSON.stringify({ error: 'Invalid or expired signature link' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    if (existing.signed_at) {
      return new Response(JSON.stringify({ error: 'This document has already been signed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 409,
      })
    }

    const { error: updateErr } = await supabase
      .from('documents')
      .update({
        signature_data: signatureData,
        signer_name: signerName,
        signed_at: new Date().toISOString(),
      })
      .eq('signature_token', token)

    if (updateErr) {
      console.error('submit-signature: DB update failed:', updateErr.message)
      return new Response(JSON.stringify({ error: updateErr.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    console.log('submit-signature: signed document with token', token.slice(0, 8))
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
