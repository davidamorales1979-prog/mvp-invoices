// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ANALYSIS_PROMPT = `You are an expert plumbing estimator analyzing a civil/utility site plan or subdivision plan to pre-fill a plumbing quote. Your job is to extract measurable infrastructure quantities from the drawing — NOT interior fixtures (those come from floor plans).

Return ONLY valid JSON (no markdown, no code blocks, no explanation) in this exact format:
{
  "units": <number of lots/houses/units shown, or 0 if not determinable>,
  "unit_type": "<subdivision|multi-family|commercial|industrial|unknown>",
  "summary": "<1-2 sentence description of what the site plan shows>",
  "detected": [
    {
      "service_id": "<service_id from the approved list below, or null>",
      "service_name": "<descriptive name>",
      "qty": <integer quantity — linear feet for pipe runs, count for discrete items>,
      "notes": "<pipe size/diameter, material, location, or measurement detail>"
    }
  ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
APPROVED SERVICE IDs AND WHAT THEY MEAN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SEWER:
- sewer: Sewer main line — qty = total linear feet of sewer main shown on plan. Include pipe size in notes (e.g. "8\" PVC SDR-35"). If multiple segments, sum the total LF.
- sewer_tap: Sewer lateral / tap connection — qty = number of individual lot connections or taps to the sewer main.

STORM / DRAINAGE:
- storm: Storm drain pipe / storm sewer — qty = total linear feet of storm pipe shown. Include pipe size and material in notes (e.g. "12\" RCP, 150 LF").
- catch_basin: Catch basin or area drain inlet — qty = count of CB, DI, or inlet symbols on the plan.
- grease: Grease trap / grease interceptor — qty = count, only if explicitly labeled.

WATER:
- water: Water main / water service line — qty = number of water meters or service connections shown. If a water main is shown with multiple service laterals, qty = number of laterals.
- water_tap: Water meter tap / corporation stop — qty = count of individual water taps or corporation stops to the main.

GAS:
- gas_underground: Underground gas main or lateral — qty = total linear feet of gas piping shown on plan. Include pipe size in notes (e.g. "2\" HDPE gas main, 320 LF").
- gas_indoor: Gas service per house/unit — qty = number of lots or units receiving an individual gas service connection. Use this when the plan shows per-lot gas stubs (3+ houses only).
- temp_gas: Temporary gas service — qty = count, only if explicitly labeled as temporary.
- gas_riser: Gas riser / gas meter — qty = count of gas meter symbols or riser locations shown.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITEMS WITHOUT A SERVICE ID (set service_id to null):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Manholes: service_id null, service_name "Manhole", qty = count of MH symbols. Include rim/invert elevations in notes if shown.
- Clean-outs: service_id null, service_name "Clean-out", qty = count of CO symbols.
- Fire hydrants: service_id null, service_name "Fire Hydrant", qty = count.
- Detention / retention basin: service_id null, service_name "Detention Basin", qty = 1.
- Any other infrastructure not in the approved list above.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MEASUREMENT RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- For pipe runs: read the labeled dimension or scale bar. Sum all segments of the same pipe type. qty is always a whole number (round up).
- For per-house gas (gas_indoor): only report when the plan shows 3 or more lots/units each getting individual gas stubs. qty = number of lots served.
- Always put pipe diameter, material, and any relevant measurement detail in the notes field — the contractor needs this to price the work.
- If you can see a scale bar but dimensions are not labeled, estimate from the scale. Note "estimated from scale" in notes.
- If a quantity cannot be determined from the drawing, omit that item entirely — do not guess zero.
- Do NOT detect interior plumbing fixtures (toilets, sinks, showers) — those are for floor plan analysis.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MULTI-LOT / SUBDIVISION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Count the number of labeled lots or building pads for the "units" field.
- For sewer and water laterals, qty should reflect the total number of individual lot connections shown, not just the main.
- Report the main separately from the laterals where both are visible.

If this document is not a site plan or civil utility drawing (e.g. it is a floor plan or architectural drawing), return:
{"units":0,"unit_type":"unknown","summary":"Not a site plan — no civil/utility infrastructure detected","detected":[]}`

function extractJson(text: string): unknown {
  try { return JSON.parse(text) } catch (_) {}
  const stripped = text.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()
  try { return JSON.parse(stripped) } catch (_) {}
  const start = text.indexOf('{')
  const end   = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)) } catch (_) {}
  }
  throw new Error('Could not parse JSON from Claude response')
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
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
      })
    }

    const { file_base64, media_type, filename } = await req.json()
    if (!file_base64 || !media_type) {
      return new Response(JSON.stringify({ error: 'Missing file_base64 or media_type' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured in Supabase secrets.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      })
    }

    const isPdf = media_type === 'application/pdf'
    const fileBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type, data: file_base64 } }
      : { type: 'image',    source: { type: 'base64', media_type, data: file_base64 } }

    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: ANALYSIS_PROMPT }] }],
      }),
    })

    if (!claudeResp.ok) {
      const errText = await claudeResp.text()
      console.error('Anthropic API error:', claudeResp.status, errText)
      return new Response(JSON.stringify({ error: `Claude API error ${claudeResp.status}: ${errText}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502,
      })
    }

    const claudeData = await claudeResp.json()
    const rawText = claudeData.content?.[0]?.text ?? ''

    let parsed: Record<string, unknown>
    try {
      parsed = extractJson(rawText) as Record<string, unknown>
    } catch (e) {
      console.error('JSON parse failed. Raw:', rawText)
      return new Response(JSON.stringify({ error: 'Could not parse AI response. Try again.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502,
      })
    }

    console.log(`analyze-site-plan: user=${user.id} file=${filename || 'unknown'} units=${parsed.units} detected=${(parsed.detected as unknown[])?.length ?? 0}`)

    return new Response(JSON.stringify({ ok: true, ...parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    })
  } catch (err) {
    console.error('analyze-site-plan error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
