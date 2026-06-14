// @ts-nocheck
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const toISO = (ts) => (ts ? new Date(ts * 1000).toISOString() : null)

function dollars(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function buildReceiptHtml({ client_name, doc_number, total, company_name, contractor_name }) {
  const GOLD = '#e8a020', NAVY = '#0a1628', DARK = '#041827', MID = '#071827'
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment Confirmed</title></head>
<body style="margin:0;padding:0;background:${NAVY};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
        <tr><td style="background:${DARK};border-radius:12px 12px 0 0;border-top:4px solid ${GOLD};padding:28px">
          <div style="color:${GOLD};font-size:20px;font-weight:700">${company_name}</div>
          <div style="color:#7f98b0;font-size:13px;margin-top:4px">Payment Confirmation</div>
        </td></tr>
        <tr><td style="background:${MID};border-radius:0 0 12px 12px;padding:28px">
          <div style="text-align:center;padding:8px 0 24px">
            <div style="color:#4caf50;font-size:48px;line-height:1">✓</div>
            <div style="color:#4caf50;font-size:22px;font-weight:700;margin-top:8px">Payment Received!</div>
          </div>
          <p style="color:#e2e8f0;font-size:16px;margin:0 0 10px">Dear ${client_name || 'Valued Client'},</p>
          <p style="color:#9fb0c6;font-size:14px;line-height:1.65;margin:0 0 24px">
            We've received your payment of <strong style="color:${GOLD}">${dollars(total)}</strong> for invoice <strong style="color:#e2e8f0">${doc_number}</strong>. Thank you for your prompt payment!
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${DARK};border-radius:8px;padding:18px 20px;margin-bottom:24px">
            <tr><td colspan="2" style="color:#556a80;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;padding-bottom:12px;font-weight:600">Payment Summary</td></tr>
            <tr>
              <td style="color:#9fb0c6;padding:5px 0;font-size:14px">Invoice</td>
              <td style="color:#e2e8f0;font-weight:600;text-align:right;font-size:14px">${doc_number}</td>
            </tr>
            <tr>
              <td style="color:#9fb0c6;padding:5px 0;font-size:14px">Amount Paid</td>
              <td style="color:${GOLD};font-weight:700;text-align:right;font-size:14px">${dollars(total)}</td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #0f2740;padding-top:20px">
            <tr><td>
              <p style="color:#7f98b0;font-size:13px;margin:0 0 12px">Keep this email as your payment confirmation.</p>
              <p style="color:#9fb0c6;font-size:14px;margin:0">Best regards,</p>
              <p style="color:#e2e8f0;font-weight:600;font-size:14px;margin:4px 0">${contractor_name}</p>
              <p style="color:#7f98b0;font-size:13px;margin:2px 0">${company_name}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 0;text-align:center">
          <p style="color:#223346;font-size:12px;margin:0">Sent via <strong style="color:#334d66">FieldQuote</strong> · Professional Plumbing Invoicing</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

async function sendReceiptEmail({ to, client_name, doc_number, total, company_name, contractor_name }) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey || !to) return
  const from = Deno.env.get('RESEND_FROM_EMAIL') ?? 'FieldQuote <onboarding@resend.dev>'
  const html = buildReceiptHtml({ client_name, doc_number, total, company_name, contractor_name })
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Payment Confirmed – ${doc_number} · ${company_name}`,
        html,
      }),
    })
    const data = await res.json()
    if (!res.ok) console.error('sendReceiptEmail Resend error:', data.message)
    else console.log('sendReceiptEmail: sent to', to, '(id:', data.id + ')')
  } catch (e) {
    console.error('sendReceiptEmail fetch error:', e.message)
  }
}

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

  // Resolve user_id from a Stripe customer ID.
  // Primary: subscriptions table lookup by stripe_customer_id.
  // Fallback: Stripe customer metadata.user_id.
  async function resolveUserId(customerId) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    if (data?.user_id) return data.user_id
    if (error) console.error('resolveUserId DB error:', error.message)
    try {
      const customer = await stripe.customers.retrieve(customerId)
      if (!customer.deleted && customer.metadata?.user_id) {
        console.log('resolveUserId: metadata fallback for customer', customerId)
        return customer.metadata.user_id
      }
    } catch (e) {
      console.error('resolveUserId Stripe error:', e.message)
    }
    return null
  }

  // Write subscription state for a given user_id.
  async function updateSubscription(userId, stripeSub, label) {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        stripe_subscription_id: stripeSub.id,
        status: stripeSub.status,
        trial_end: toISO(stripeSub.trial_end),
        current_period_end: toISO(stripeSub.current_period_end),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
    if (error) {
      console.error(`${label}: DB update failed:`, error.message)
    } else {
      console.log(`${label}: user ${userId} → status: ${stripeSub.status}`)
    }
  }

  try {
    console.log('Event:', event.type)

    switch (event.type) {

      // Checkout completed — subscription OR one-time invoice payment
      case 'checkout.session.completed': {
        const session = event.data.object

        // One-time invoice payment via "Send Payment Link"
        if (session.mode === 'payment') {
          const docId = session.metadata?.doc_id
          if (!docId) {
            console.log('checkout.session.completed (payment): no doc_id in metadata, skipping')
            break
          }
          const { data: doc, error: docErr } = await supabase
            .from('documents')
            .select('history, status, doc_number, client, client_email, contractor, total, user_id')
            .eq('id', docId)
            .maybeSingle()
          if (docErr || !doc) {
            console.error('checkout.session.completed (payment): doc not found', docId, docErr?.message)
            break
          }
          const amountDollars = (session.amount_total || 0) / 100
          const paidEntry = {
            ts: new Date().toISOString(),
            entry: 'paid:stripe',
            status: 'paid',
            docNumber: doc.doc_number,
            amount_cents: session.amount_total,
            payment_intent: session.payment_intent,
          }
          const newHistory = [paidEntry, ...(doc.history || [])]
          const { error: updateErr } = await supabase
            .from('documents')
            .update({ history: newHistory, status: 'paid' })
            .eq('id', docId)
          if (updateErr) {
            console.error('checkout.session.completed (payment): failed to update doc', updateErr.message)
          } else {
            console.log(`checkout.session.completed (payment): doc ${docId} marked paid`)
          }

          // Send payment receipt email to client
          if (doc.client_email) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('company_name, name1')
              .eq('user_id', doc.user_id)
              .maybeSingle()
            await sendReceiptEmail({
              to: doc.client_email,
              client_name: doc.client,
              doc_number: doc.doc_number,
              total: amountDollars,
              company_name: profile?.company_name || doc.contractor || 'Your Contractor',
              contractor_name: profile?.name1 || profile?.company_name || doc.contractor || 'Your Contractor',
            })
          }
          break
        }

        // Subscription checkout
        if (session.mode !== 'subscription') break
        if (!session.subscription) {
          console.error('checkout.session.completed: missing subscription ID')
          break
        }
        const stripeSub = await stripe.subscriptions.retrieve(session.subscription)
        const userId = await resolveUserId(session.customer)
        if (!userId) {
          console.error('checkout.session.completed: could not resolve user for customer', session.customer)
          break
        }
        // Also save stripe_customer_id in case it wasn't saved during checkout creation
        await supabase
          .from('subscriptions')
          .update({ stripe_customer_id: session.customer })
          .eq('user_id', userId)
          .is('stripe_customer_id', null)
        await updateSubscription(userId, stripeSub, 'checkout.session.completed')
        break
      }

      // New subscription created (fires alongside checkout.session.completed)
      case 'customer.subscription.created':
      // Subscription renewed, upgraded, canceled, paused, etc.
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object
        // Always resolve via customer ID — stripe_subscription_id may not be in DB yet
        const userId = await resolveUserId(stripeSub.customer)
        if (!userId) {
          console.error(`${event.type}: could not resolve user for customer`, stripeSub.customer)
          break
        }
        await updateSubscription(userId, stripeSub, event.type)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        if (!invoice.subscription) break
        const userId = await resolveUserId(invoice.customer)
        if (!userId) {
          console.error('invoice.payment_failed: could not resolve user for customer', invoice.customer)
          break
        }
        const { error } = await supabase
          .from('subscriptions')
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('user_id', userId)
        if (error) console.error('invoice.payment_failed: update failed:', error.message)
        else console.log('invoice.payment_failed: marked past_due for user', userId)
        break
      }

      default:
        console.log('Unhandled event:', event.type)
    }
  } catch (err) {
    console.error('Webhook handler error:', err.message)
  }

  return ok()
})
