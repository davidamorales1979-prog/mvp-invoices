// @ts-nocheck
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

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
    console.error('Webhook signature verification failed:', err.message)
    return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // Find the user_id for a given Stripe customer ID.
  // Primary: look up by stripe_customer_id in subscriptions table.
  // Fallback: retrieve the Stripe customer and read user_id from its metadata.
  async function resolveUserId(customerId) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()

    if (data?.user_id) return data.user_id

    if (error) console.error('resolveUserId primary lookup error:', error.message)

    // Fallback: read user_id from Stripe customer metadata
    try {
      const customer = await stripe.customers.retrieve(customerId)
      if (!customer.deleted && customer.metadata?.user_id) {
        console.log('resolveUserId: using metadata fallback for', customerId)
        return customer.metadata.user_id
      }
    } catch (e) {
      console.error('resolveUserId metadata fallback error:', e.message)
    }

    return null
  }

  try {
    console.log('Processing webhook event:', event.type)

    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode !== 'subscription') break
        if (!session.subscription) {
          console.error('checkout.session.completed: no subscription ID on session')
          break
        }

        const stripeSub = await stripe.subscriptions.retrieve(session.subscription)
        const userId = await resolveUserId(session.customer)

        if (!userId) {
          console.error('checkout.session.completed: could not resolve user_id for customer', session.customer)
          break
        }

        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            stripe_customer_id: session.customer,
            stripe_subscription_id: stripeSub.id,
            status: stripeSub.status,
            trial_end: toISO(stripeSub.trial_end),
            current_period_end: toISO(stripeSub.current_period_end),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)

        if (updateError) {
          console.error('checkout.session.completed: update failed:', updateError.message)
        } else {
          console.log('checkout.session.completed: updated subscription for user', userId, '→ status:', stripeSub.status)
        }
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object

        // Try updating by stripe_subscription_id first
        const { error: subUpdateError, count } = await supabase
          .from('subscriptions')
          .update({
            status: stripeSub.status,
            trial_end: toISO(stripeSub.trial_end),
            current_period_end: toISO(stripeSub.current_period_end),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', stripeSub.id)

        if (subUpdateError) {
          console.error(`${event.type}: update by sub ID failed:`, subUpdateError.message)
        }

        // If no row matched by subscription ID, fall back to customer ID
        if (!subUpdateError && count === 0) {
          const userId = await resolveUserId(stripeSub.customer)
          if (userId) {
            const { error: fallbackError } = await supabase
              .from('subscriptions')
              .update({
                stripe_subscription_id: stripeSub.id,
                status: stripeSub.status,
                trial_end: toISO(stripeSub.trial_end),
                current_period_end: toISO(stripeSub.current_period_end),
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId)
            if (fallbackError) console.error(`${event.type}: fallback update failed:`, fallbackError.message)
            else console.log(`${event.type}: fallback update succeeded for user`, userId)
          }
        } else {
          console.log(`${event.type}: updated subscription`, stripeSub.id, '→ status:', stripeSub.status)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        if (!invoice.subscription) break

        const { error: pfError } = await supabase
          .from('subscriptions')
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', invoice.subscription)

        if (pfError) console.error('invoice.payment_failed: update failed:', pfError.message)
        else console.log('invoice.payment_failed: marked past_due for sub', invoice.subscription)
        break
      }

      default:
        console.log('Unhandled event type:', event.type)
    }
  } catch (err) {
    console.error('Webhook handler error:', err.message)
  }

  return ok()
})
