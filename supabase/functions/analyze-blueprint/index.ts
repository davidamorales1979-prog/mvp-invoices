// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ANALYSIS_PROMPT = `You are an expert plumbing estimator. Carefully analyze this architectural blueprint and identify ALL plumbing fixtures, rough-ins, connections, and systems visible in the plans.

Return ONLY valid JSON (no markdown, no code blocks, no explanation) in this exact format:
{
  "units": <total number of residential units/houses, or 1 for single home>,
  "unit_type": "<residential|commercial|multi-family|mixed>",
  "summary": "<1-2 sentence project description>",
  "detected": [
    {
      "service_id": "<service_id from the list below, or null if not in list>",
      "service_name": "<descriptive name>",
      "qty": <integer quantity>,
      "notes": "<brief note about location or how detected>"
    }
  ]
}

Map detected items to these service_id values when applicable:

INFRASTRUCTURE & SYSTEMS:
- sewer: Sewer line installation/connection
- sewer_tap: Sewer tap to municipal main
- storm: Storm drain system
- catch_basin: Catch basin / area drain
- grease: Grease trap
- water: Water line / water meter installation
- water_tap: Water meter tap
- temp_gas: Temporary gas connection
- gas_riser: Gas riser / exterior gas meter connection
- gas_underground: Underground gas line
- gas_indoor: General indoor gas rough-in distribution system (not individual appliances)
- water_heater: Water heater unit — new construction install (not a fixture replacement)
- tankless_wh: Tankless water heater
- wh_replacement: Water heater replacement in existing building
- recirc_pump: Hot water recirculation pump
- manablok: Manablok or manifold distribution system
- repiping: Full repiping project
- cut_bust: Concrete cutting and busting required

WATER FIXTURES — count each unit individually, use these IDs:
- fix_toilet: Toilet / Water Closet (count every WC)
- fix_faucet: Faucet / Lavatory sink (count each lav, bathroom sink, bar sink, utility sink)
- fix_shower: Shower (count each shower stall or shower-only unit)
- fix_master_tub: Soaking tub / garden tub / master tub / jacuzzi
- fix_kitchen_sink: Kitchen sink (count each kitchen sink)
- fix_ice_maker: Ice maker rough-in / refrigerator water line
- fix_pot_filler: Pot filler (wall-mounted kitchen pot filler faucet)
- fix_laundry: Laundry room / washer machine rough-in / washing machine connection

GAS FIXTURES — count each appliance individually, use these IDs:
- fix_gas_furnace: Gas furnace / HVAC unit
- fix_gas_wh: Gas water heater (when counted as individual fixture)
- fix_gas_dryer: Gas dryer connection
- fix_gas_stove: Gas stove / range / cooktop / oven

For items NOT in any list above (dishwashers, garbage disposals, water softeners, hose bibs, outdoor BBQ, irrigation, etc.) — set service_id to null and describe accurately in service_name. These become add-ons.

Counting rules:
- Count EVERY toilet, every sink, every shower, every tub as a separate line item with its own qty
- For tub/shower combos: use fix_shower (the shower component is the plumbing work)
- For multi-unit buildings: multiply per-unit fixture counts by the number of units
- Gas fixtures: list each gas appliance type with its own count (range=1, dryer=1, furnace=1, etc.)
- Be thorough — plumbers charge per fixture, so completeness matters

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
