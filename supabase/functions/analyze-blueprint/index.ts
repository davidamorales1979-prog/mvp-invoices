// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ANALYSIS_PROMPT = `You are an expert plumbing estimator analyzing a floor plan to pre-fill a plumbing quote. Follow every rule below exactly — do not improvise.

Return ONLY valid JSON (no markdown, no code blocks, no explanation) in this exact format:
{
  "units": <total number of residential units/houses, or 1 for single home>,
  "unit_type": "<residential|commercial|multi-family|mixed>",
  "summary": "<1-2 sentence project description>",
  "detected": [
    {
      "service_id": "<service_id from the approved list below, or null>",
      "service_name": "<descriptive name>",
      "qty": <integer quantity>,
      "notes": "<brief note about location or how detected>"
    }
  ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 1 — NEVER INCLUDE THESE (omit entirely from detected[], do not set qty=0):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
× sewer / sewer_tap — requires site plan, not determinable from a floor plan
× water / water_tap — requires site plan, not determinable from a floor plan
× gas_underground — requires site plan, not determinable from a floor plan
× cut_bust — contractor decision, not shown in floor plans
× gas_indoor — cannot be confirmed from floor plan alone; use specific fix_gas_* IDs instead

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 2 — INFRASTRUCTURE (include only if explicitly shown on this floor plan):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- storm: Storm drain system — only if drain symbol visible on plan
- catch_basin: Catch basin — only if CB symbol explicitly labeled
- grease: Grease trap — only if GT symbol explicitly labeled
- temp_gas: Temporary gas — only if labeled on plan
- gas_riser: Gas riser / meter — only if meter symbol shown
- water_heater: Water heater (new construction) — if WH symbol found; qty governed by Rule 4
- tankless_wh: Tankless water heater — only if explicitly labeled TANKLESS or TW
- wh_replacement: Water heater replacement — only if plan notes existing building
- recirc_pump: Recirculation pump — only if RECIRC or RP symbol found
- manablok: Manablok manifold — only if explicitly shown
- repiping: Repiping — only if plan notes full repipe
- grease: Grease trap — only if GT symbol shown

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 3 — GAS FIXTURES (only mark if clearly shown in the floor plan):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- fix_gas_furnace: Mark ONLY if a furnace symbol or label (FURN, FAU, AC/HEAT) is visible
- fix_gas_wh: Mark ONLY if a gas water heater symbol is found (as an individual unit fixture)
- fix_gas_stove: Mark ONLY if the kitchen has a gas range / stove symbol or label (GAS RNG, RANGE, STOVE)
- fix_gas_dryer: Mark ONLY if laundry room is present (infer gas dryer hookup from laundry room)
- fix_gas_bbq: Mark ONLY if outdoor BBQ / grill stub or label is shown on plan
- fix_gas_generator: Mark ONLY if generator symbol or label is visible
- fix_gas_kitchen_patio: Mark ONLY if outdoor kitchen gas stub is explicitly shown

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 4 — QUANTITY RULES FOR WATER HEATER & LAUNDRY (based on bathroom count):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Count total bathrooms (full + half) first, then apply:
- 1 to 3.5 bathrooms → water_heater qty = 1, fix_laundry qty = 1
- 4+ bathrooms       → water_heater qty = 2, fix_laundry qty = 2
These quantities override what you visually count from WH symbols.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 5 — WATER FIXTURES (count exactly as shown in floor plan):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- fix_toilet: Every toilet / WC symbol — count exactly
- fix_bathroom_sink: Every lavatory / vanity / bathroom sink — count exactly
- fix_faucet: Generic faucet not covered by a more specific ID
- fix_shower: Every shower stall (for tub+shower combos use fix_shower for the shower valve)
- fix_master_tub: Every soaking tub / garden tub / whirlpool / jacuzzi — count exactly
- fix_kitchen_sink: Every indoor kitchen sink — count exactly
- fix_wet_bar: Every wet bar sink
- fix_laundry_sink: Every laundry / utility / service sink
- fix_ice_maker: Every ice maker or fridge water line rough-in
- fix_pot_filler: Every pot filler symbol
- fix_kitchen_patio: Outdoor kitchen water connection / patio kitchen sink
- fix_hose_bib: Exterior hose bib / sillcock (HB symbol on exterior walls or laundry area) — count each one shown

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 6 — ADD-ONS (set service_id to null):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dishwashers, garbage disposals, water softeners, irrigation, and anything else not in the approved lists above → service_id: null. They become add-ons. (Hose bibs are now mapped to fix_hose_bib — do NOT send them as add-ons.)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 7 — MULTI-UNIT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For multi-unit buildings, multiply per-unit fixture counts by the number of units before reporting qty.

If you cannot identify plumbing fixtures (e.g., this is not a blueprint), return {"units":0,"unit_type":"unknown","summary":"No plumbing fixtures detected","detected":[]}`

function extractJson(text: string): unknown {
  // Try direct parse first
  try { return JSON.parse(text) } catch (_) {}
  // Strip markdown code fences
  const stripped = text.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()
  try { return JSON.parse(stripped) } catch (_) {}
  // Find first { ... } block
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
    // Authenticate caller
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

    // Build the content block — PDFs use "document" type, images use "image" type
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
        messages: [
          {
            role: 'user',
            content: [fileBlock, { type: 'text', text: ANALYSIS_PROMPT }],
          },
        ],
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

    console.log(`analyze-blueprint: user=${user.id} file=${filename || 'unknown'} units=${parsed.units} detected=${(parsed.detected as unknown[])?.length ?? 0}`)

    return new Response(JSON.stringify({ ok: true, ...parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    })
  } catch (err) {
    console.error('analyze-blueprint error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
