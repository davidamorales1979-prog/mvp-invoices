// @ts-nocheck
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { doc_id, doc_number, client_name } = await req.json()

    if (!doc_id) {
      return new Response(JSON.stringify({ error: 'Missing required field: doc_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Fetch the invoice total from the database — never trust the caller-supplied amount
    const { data: doc, error: docError } = await supabaseClient
      .from('documents')
      .select('total, doc_number, client')
      .eq('id', doc_id)
      .single()

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    const amount_cents = Math.round(Number(doc.total) * 100)
    if (!amount_cents || amount_cents <= 0) {
      return new Response(JSON.stringify({ error: 'Document has no valid total' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const appUrl = Deno.env.get('APP_URL') ?? 'https://mvp-invoices.vercel.app'

    // Stripe allows 30 min – 24 hours; use the maximum
    const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60

    const resolvedDocNumber = doc.doc_number || doc_number || 'Invoice'
    const resolvedClientName = doc.client || client_name || 'Invoice'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amount_cents,
          product_data: {
            name: `${resolvedDocNumber} — ${resolvedClientName}`,
            description: 'Plumbing services — FieldQuote',
          },
        },
      }],
      metadata: { doc_id },
      expires_at: expiresAt,
      success_url: `${appUrl}/?payment=success`,
      cancel_url: `${appUrl}/`,
    })

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('create-invoice-payment error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
