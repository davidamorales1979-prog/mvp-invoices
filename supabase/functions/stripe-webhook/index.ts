// @ts-nocheck
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

// Helper: convert Stripe Unix timestamp to ISO string
const toISO = (ts) => (ts ? new Date(ts * 1000).toISOString() : null)

const ok = () =>
  new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature') ?? ''
  const body = await req.text()

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  })

  let event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '',
    )
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    switch (event.type) {
      // Checkout completed — link the Stripe subscription to the user
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode !== 'subscription') break
        const stripeSub = await stripe.subscriptions.retrieve(session.subscription)
        const { data: row } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', session.customer)
          .single()
        if (row) {
          await supabase.from('subscriptions').update({
            stripe_subscription_id: stripeSub.id,
            status: stripeSub.status,
            trial_end: toISO(stripeSub.trial_end),
            current_period_end: toISO(stripeSub.current_period_end),
            updated_at: new Date().toISOString(),
          }).eq('user_id', row.user_id)
        }
        break
      }

      // Subscription renewed, canceled, paused, etc.
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object
        await supabase.from('subscriptions').update({
          status: stripeSub.status,
          trial_end: toISO(stripeSub.trial_end),
          current_period_end: toISO(stripeSub.current_period_end),
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', stripeSub.id)
        break
      }

      // Payment failed — mark as past_due so the app can prompt re-payment
      case 'invoice.payment_failed': {
        const invoice = event.data.object
        if (invoice.subscription) {
          await supabase.from('subscriptions').update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          }).eq('stripe_subscription_id', invoice.subscription)
        }
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err.message)
  }

  return ok()
})
