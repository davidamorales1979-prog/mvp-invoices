// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOLD = '#e8a020'
const NAVY = '#0a1628'
const DARK = '#041827'
const MID  = '#071827'

function dollars(n: number) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function buildHtml({ type, client_name, doc_number, total, address, notes, payment_link, contractor_name, company_name, payment_schedule }) {
  const isQuote   = type === 'quote'
  const isInvoice = type === 'invoice'
  const isReceipt = type === 'payment_receipt'

  const docLabel  = isQuote ? `Quote ${doc_number}` : isInvoice ? `Invoice ${doc_number}` : `Receipt – ${doc_number}`
  const greeting  = isQuote
    ? 'Please find your plumbing quote below. Review the details and feel free to reach out with any questions.'
    : isInvoice
    ? 'Your invoice is ready. Please review the details below and use the button to pay securely online.'
    : `We've received your payment of <strong style="color:${GOLD}">${dollars(total)}</strong> for ${doc_number}. Thank you!`

  const scheduleRows = (payment_schedule || []).map(p =>
    `<tr>
      <td style="color:#9fb0c6;padding:5px 0;font-size:14px">${p.name}</td>
      <td style="color:${GOLD};font-weight:700;text-align:right;padding:5px 0;font-size:14px">${dollars(p.amount)}</td>
    </tr>`
  ).join('')

  const ctaButton = isInvoice && payment_link
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0">
        <tr>
          <td>
            <a href="${payment_link}"
               style="display:inline-block;background:${GOLD};color:${NAVY};text-decoration:none;padding:15px 32px;border-radius:8px;font-weight:700;font-size:16px;letter-spacing:-0.3px">
              Pay Now — ${dollars(total)}
            </a>
            <p style="color:#556a80;font-size:12px;margin:10px 0 0">Secure payment powered by Stripe. No account required.</p>
          </td>
        </tr>
      </table>`
    : ''

  const footerNote = isQuote
    ? 'Reply to this email to ask questions or approve the quote.'
    : isInvoice
    ? 'Payment is due upon receipt. Thank you for choosing us.'
    : 'Keep this email as your payment confirmation.'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${docLabel} from ${company_name}</title>
</head>
<body style="margin:0;padding:0;background:${NAVY};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">

          <!-- Header card -->
          <tr>
            <td style="background:${DARK};border-radius:12px 12px 0 0;border-top:4px solid ${GOLD};padding:28px">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="color:${GOLD};font-size:20px;font-weight:700;letter-spacing:-0.4px">${company_name}</div>
                    <div style="color:#7f98b0;font-size:13px;margin-top:4px">${docLabel}</div>
                  </td>
                  ${!isReceipt ? `<td align="right">
                    <div style="color:${GOLD};font-size:28px;font-weight:700">${dollars(total)}</div>
                    <div style="color:#7f98b0;font-size:12px;margin-top:2px">${isQuote ? 'Estimate Total' : 'Amount Due'}</div>
                  </td>` : ''}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body card -->
          <tr>
            <td style="background:${MID};border-radius:0 0 12px 12px;padding:28px">

              <!-- Greeting -->
              <p style="color:#e2e8f0;font-size:16px;margin:0 0 10px">Dear ${client_name || 'Valued Client'},</p>
              <p style="color:#9fb0c6;font-size:14px;line-height:1.65;margin:0 0 24px">${greeting}</p>

              <!-- Details box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:${DARK};border-radius:8px;padding:18px 20px;margin-bottom:0">
                <tr>
                  <td colspan="2" style="color:#556a80;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;padding-bottom:12px;font-weight:600">Document Details</td>
                </tr>
                <tr>
                  <td style="color:#9fb0c6;padding:5px 0;font-size:14px">Document #</td>
                  <td style="color:#e2e8f0;font-weight:600;text-align:right;padding:5px 0;font-size:14px">${doc_number}</td>
                </tr>
                ${address ? `<tr>
                  <td style="color:#9fb0c6;padding:5px 0;font-size:14px">Address</td>
                  <td style="color:#e2e8f0;font-weight:600;text-align:right;padding:5px 0;font-size:14px">${address}</td>
                </tr>` : ''}
                ${!isReceipt ? `<tr>
                  <td style="color:#9fb0c6;padding:5px 0;font-size:14px">Total</td>
                  <td style="color:${GOLD};font-weight:700;text-align:right;padding:5px 0;font-size:14px">${dollars(total)}</td>
                </tr>` : ''}
                ${scheduleRows ? `<tr>
                  <td colspan="2" style="padding-top:16px">
                    <div style="color:#556a80;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;font-weight:600">Payment Schedule</div>
                    <table width="100%" cellpadding="0" cellspacing="0">${scheduleRows}</table>
                  </td>
                </tr>` : ''}
              </table>

              ${notes ? `<!-- Notes -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:${DARK};border-radius:8px;padding:18px 20px;margin-top:12px">
                <tr><td style="color:#556a80;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;padding-bottom:8px;font-weight:600">Notes</td></tr>
                <tr><td style="color:#9fb0c6;font-size:14px;line-height:1.65">${notes.replace(/\n/g, '<br>')}</td></tr>
              </table>` : ''}

              ${ctaButton}

              <!-- Signature -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid #0f2740;padding-top:20px">
                <tr>
                  <td>
                    <p style="color:#7f98b0;font-size:13px;margin:0 0 12px">${footerNote}</p>
                    <p style="color:#9fb0c6;font-size:14px;margin:0">Best regards,</p>
                    <p style="color:#e2e8f0;font-weight:600;font-size:14px;margin:4px 0">${contractor_name}</p>
                    <p style="color:#7f98b0;font-size:13px;margin:2px 0">${company_name}</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 0;text-align:center">
              <p style="color:#223346;font-size:12px;margin:0">
                Sent via <strong style="color:#334d66">FieldQuote</strong> · Professional Plumbing Invoicing
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

async function sendViaResend({ apiKey, from, to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Resend API error')
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
      })
    }

    const body = await req.json()
    const { type, to, client_name, doc_number, total, address, notes, payment_link, contractor_name, company_name, payment_schedule } = body

    if (!to || !type || !doc_number) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, type, doc_number' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    const apiKey = Deno.env.get('RESEND_API_KEY') ?? ''
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Email service not configured. Set RESEND_API_KEY in Supabase secrets.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      })
    }

    const from   = Deno.env.get('RESEND_FROM_EMAIL') ?? 'FieldQuote <onboarding@resend.dev>'
    const subjects = {
      quote:           `Your Quote from ${company_name} – ${doc_number}`,
      invoice:         `Invoice ${doc_number} from ${company_name} – Payment Due`,
      payment_receipt: `Payment Confirmed – ${doc_number} · ${company_name}`,
    }

    const html = buildHtml({ type, client_name, doc_number, total, address, notes, payment_link, contractor_name, company_name, payment_schedule })
    const result = await sendViaResend({ apiKey, from, to, subject: subjects[type] ?? `Message from ${company_name}`, html })

    console.log(`send-client-email: ${type} → ${to} (id: ${result.id})`)
    return new Response(JSON.stringify({ ok: true, id: result.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    })
  } catch (err) {
    console.error('send-client-email error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
