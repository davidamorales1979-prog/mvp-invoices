// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOLD = '#c9a84c'

function dollars(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

async function notifyContractor({ apiKey, from, contractorEmail, contractorName, clientName, optionLabel, optionTotal, docNumber, companyName }) {
  if (!apiKey || !contractorEmail) return

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
          <tr>
            <td style="background:#041827;border-radius:12px;border-top:4px solid ${GOLD};padding:28px">
              <div style="color:${GOLD};font-size:18px;font-weight:700;margin-bottom:4px">${companyName || contractorName || 'FieldQuote'}</div>
              <div style="color:#7f98b0;font-size:13px;margin-bottom:20px">Quote ${docNumber} · Option Selected</div>
              <div style="color:#4caf50;font-size:20px;font-weight:700;margin-bottom:14px">✅ Client Selected an Option</div>
              <p style="color:#9fb0c6;font-size:15px;line-height:1.6;margin:0 0 20px">
                <strong style="color:#fff">${clientName || 'Your client'}</strong> has reviewed your multi-option quote and selected the
                <strong style="color:${GOLD}">${optionLabel}</strong> option for
                <strong style="color:${GOLD}">${dollars(optionTotal)}</strong>.
              </p>
              <div style="background:#0a1628;border-radius:8px;padding:16px 20px;margin:0 0 20px">
                <div style="color:#556a80;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;font-weight:600">Selection Details</div>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr><td style="color:#9fb0c6;padding:4px 0;font-size:14px">Quote</td><td style="color:#e2e8f0;font-weight:600;text-align:right;font-size:14px">${docNumber}</td></tr>
                  <tr><td style="color:#9fb0c6;padding:4px 0;font-size:14px">Option</td><td style="color:${GOLD};font-weight:700;text-align:right;font-size:14px">${optionLabel}</td></tr>
                  <tr><td style="color:#9fb0c6;padding:4px 0;font-size:14px">Amount</td><td style="color:${GOLD};font-weight:700;text-align:right;font-size:16px">${dollars(optionTotal)}</td></tr>
                </table>
              </div>
              <p style="color:#7f98b0;font-size:13px;margin:0;line-height:1.6">Log in to FieldQuote to apply the selection to the quote and follow up with your client.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 0;text-align:center">
              <p style="color:#223346;font-size:12px;margin:0">Sent via <strong style="color:#334d66">FieldQuote</strong> · Professional Plumbing Invoicing</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [contractorEmail],
        subject: `${clientName || 'Your client'} selected "${optionLabel}" on quote ${docNumber}`,
        html,
      }),
    })
  } catch (e) {
    console.error('Resend notification failed:', e.message)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { token, option_idx } = await req.json()

    if (!token || option_idx == null) {
      return new Response(JSON.stringify({ error: 'Missing required fields: token, option_idx' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: doc, error: lookupErr } = await supabase
      .from('documents')
      .select('id, doc_number, client, contractor, user_id, quote_options')
      .eq('options_token', token)
      .maybeSingle()

    if (lookupErr || !doc) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404,
      })
    }

    if (!doc.quote_options || !doc.quote_options[option_idx]) {
      return new Response(JSON.stringify({ error: 'Invalid option' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    const { error: updateErr } = await supabase
      .from('documents')
      .update({ selected_option_idx: option_idx })
      .eq('options_token', token)

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      })
    }

    // Notify contractor (best-effort)
    try {
      const { data: userData }  = await supabase.auth.admin.getUserById(doc.user_id)
      const contractorEmail     = userData?.user?.email
      const { data: profile }   = await supabase.from('profiles').select('company_name').eq('user_id', doc.user_id).maybeSingle()
      const selectedOpt         = doc.quote_options[option_idx]
      const apiKey = Deno.env.get('RESEND_API_KEY') ?? ''
      const from   = Deno.env.get('RESEND_FROM_EMAIL') ?? 'FieldQuote <onboarding@resend.dev>'
      await notifyContractor({
        apiKey, from, contractorEmail,
        contractorName: doc.contractor,
        clientName:     doc.client,
        optionLabel:    selectedOpt.label,
        optionTotal:    selectedOpt.total,
        docNumber:      doc.doc_number,
        companyName:    profile?.company_name,
      })
    } catch (notifyErr) {
      console.error('Contractor notification failed:', notifyErr.message)
    }

    console.log(`submit-option-selection: idx=${option_idx} on doc ${doc.doc_number}`)
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    })
  } catch (err) {
    console.error('submit-option-selection error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
