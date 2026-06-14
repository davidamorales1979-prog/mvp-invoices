// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function dollars(n: number) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// Normalize a US phone number to E.164 (+1XXXXXXXXXX). Returns null if unparseable.
function toE164(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`
  if (digits.length > 11 && raw.startsWith('+')) return `+${digits}`
  return null
}

function buildMessage({ type, client_name, contractor_name, company_name, doc_number, total, scheduled_date, address }) {
  const name   = client_name   || 'Valued Client'
  const tech   = contractor_name || company_name || 'Your technician'
  const co     = company_name   || contractor_name || 'us'

  if (type === 'on_my_way') {
    let msg = `Hi ${name}! ${tech} from ${co} is on the way to your appointment`
    if (address) msg += ` at ${address}`
    if (scheduled_date) {
      const d = new Date(scheduled_date + 'T00:00:00') // treat as local date
      const formatted = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      msg += `. Estimated arrival: ${formatted}`
    }
    msg += `. See you soon! – ${co}`
    return msg
  }

  if (type === 'payment_received') {
    return `Hi ${name}! We've received your payment of ${dollars(total)} for ${doc_number} from ${co}. Thank you for your business! – FieldQuote`
  }

  return null
}

async function sendViaTwilio({ accountSid, authToken, from, to, body }) {
  const url  = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const cred = btoa(`${accountSid}:${authToken}`)
  const form = new URLSearchParams({ To: to, From: from, Body: body })

  const res  = await fetch(url, {
    method:  'POST',
    headers: { 'Authorization': `Basic ${cred}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    form.toString(),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || `Twilio error ${res.status}`)
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
    const { type, to, client_name, contractor_name, company_name, doc_number, total, scheduled_date, address } = body

    if (!to || !type) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, type' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    const phone = toE164(to)
    if (!phone) {
      return new Response(JSON.stringify({ error: `Cannot parse phone number: "${to}"` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID') ?? ''
    const authToken  = Deno.env.get('TWILIO_AUTH_TOKEN')  ?? ''
    const fromPhone  = Deno.env.get('TWILIO_PHONE_NUMBER') ?? ''

    if (!accountSid || !authToken || !fromPhone) {
      return new Response(JSON.stringify({ error: 'SMS service not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in Supabase secrets.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      })
    }

    const message = buildMessage({ type, client_name, contractor_name, company_name, doc_number, total, scheduled_date, address })
    if (!message) {
      return new Response(JSON.stringify({ error: `Unknown SMS type: "${type}"` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    const result = await sendViaTwilio({ accountSid, authToken, from: fromPhone, to: phone, body: message })

    console.log(`send-client-sms: ${type} → ${phone} (sid: ${result.sid})`)
    return new Response(JSON.stringify({ ok: true, sid: result.sid }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    })
  } catch (err) {
    console.error('send-client-sms error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
