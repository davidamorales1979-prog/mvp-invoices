import React, { useEffect, useMemo, useState, useCallback } from 'react'
import './App.css'
import { supabase } from './supabase'

const NAVY = '#0a1628'
const GOLD = '#c9a84c'

function useCounter(key = 'mvp_invoice_counter_v1') {
  const [n, setN] = useState(() => Number(localStorage.getItem(key) || 1001))
  useEffect(() => { localStorage.setItem(key, String(n)) }, [key, n])
  const bump = useCallback(() => setN(x => x + 1), [])
  const reset = useCallback((v = 1001) => setN(v), [])
  return useMemo(() => ({ bump, raw: n, reset }), [bump, reset, n])
}

const SERVICES = [
  // Sewer
  { id: 'sewer',        name: 'Sewer Line',                    unit: 1200 },
  { id: 'sewer_tap',    name: 'Sewer Tap',                     unit: 0, desc: '' },
  { id: 'storm',        name: 'Storm Drain',                   unit: 700 },
  { id: 'grease',       name: 'Grease Trap',                   unit: 450 },
  // Water
  { id: 'water',        name: 'Water Line Meter',              unit: 800 },
  { id: 'water_tap',    name: 'Water Meter Tap',               unit: 0, desc: '' },
  // Gas
  { id: 'temp_gas',     name: 'Temp Gas',                      unit: 250 },
  { id: 'gas_riser',    name: 'Gas Riser',                     unit: 400 },
  { id: 'gas_underground', name: 'Underground Gas Line',       unit: 0 },
  { id: 'gas_indoor',   name: 'Gas System Indoor',             unit: 300 },
  // Others
  { id: 'water_heater',    name: 'Water Heater',                  unit: 600 },
  { id: 'tankless_wh',     name: 'Tankless Water Heater',         unit: 0 },
  { id: 'recirc_pump',     name: 'Recirculation Pump System',     unit: 0 },
  { id: 'wh_replacement',  name: 'Water Heater Replacement',      unit: 0, garageQty: 0, garageUnit: 0, atticQty: 0, atticUnit: 0 },
  { id: 'manablok',        name: 'Manablok System',               unit: 950 },
  { id: 'repiping',        name: 'Repiping',                      unit: 1500 },
  { id: 'cut_bust',        name: 'Cut and Bust Concrete',         unit: 200 },
  // Remodeling / Fixtures
  { id: 'fixture_replace',    name: 'Fixture Replacement',            unit: 0 },
  { id: 'toilet_replace',     name: 'Toilet Replacement',             unit: 0 },
  { id: 'kitchen_faucet',     name: 'Kitchen Faucet Replacement',     unit: 0 },
  { id: 'garbage_disposal',   name: 'Garbage Disposal Replacement',   unit: 0 },
]

const SERVICE_GROUPS = [
  { label: 'Sewer',                ids: ['sewer', 'sewer_tap', 'storm', 'grease'] },
  { label: 'Water',                ids: ['water', 'water_tap'] },
  { label: 'Gas',                  ids: ['temp_gas', 'gas_riser', 'gas_underground', 'gas_indoor'] },
  { label: 'Others',               ids: ['water_heater', 'tankless_wh', 'recirc_pump', 'wh_replacement', 'manablok', 'repiping', 'cut_bust'] },
  { label: 'Remodeling / Fixtures', ids: ['fixture_replace', 'toilet_replace', 'kitchen_faucet', 'garbage_disposal'] },
]

const BASE_SERVICE_IDS = ['water', 'water_heater', 'tankless_wh', 'recirc_pump', 'manablok', 'gas_indoor']

function mergeServices(saved) {
  const map = new Map((saved || []).map(s => [s.id, s]))
  return SERVICES.map(s => ({
    ...s,
    enabled: false,
    qty: 0,
    ...(BASE_SERVICE_IDS.includes(s.id) ? { billingMode: 'pct' } : {}),
    ...(map.get(s.id) || {}),
  }))
}

function formatCurrency(n){ return '$' + Number(n || 0).toLocaleString() }
function getPhotoUrl(path){ const { data } = supabase.storage.from('job-photos').getPublicUrl(path); return data.publicUrl }
function getLogoUrl(path){ const { data } = supabase.storage.from('logos').getPublicUrl(path); return data.publicUrl }

function calcDocBase(doc) {
  const svcAmt = (doc.services || []).reduce((sum, s) => {
    if (doc.project_type !== 'New Construction') return sum
    if (!BASE_SERVICE_IDS.includes(s.id)) return sum
    if ((s.billingMode ?? 'pct') !== 'pct') return sum
    return sum + (s.enabled ? (s.qty || 0) * (s.unit || 0) : 0)
  }, 0)
  return (doc.houses || 0) * (doc.fixtures_per_house || 0) * (doc.price_per_fixture || 0) + svcAmt
}

function isPhasePaid(doc, phaseKey) {
  return (doc.history || []).some(h => h.entry === `phase:${phaseKey}:paid`)
}
function getUnitLabel(type) {
  if (type === 'Residential') return 'Houses'
  if (type === 'Industrial') return 'Buildings'
  return 'Units'
}
function formatMoneyInput(n){ return '$' + (Number(n || 0).toString()) }
function parseMoneyInput(value){ const numeric = Number(String(value).replace(/[^0-9.]/g, '')); return Number.isNaN(numeric) ? 0 : numeric }
function formatDocNumber(raw, type){
  let serialNumber = raw > 1000 ? raw - 1000 : raw
  if (serialNumber < 1) serialNumber = 1
  const serial = String(serialNumber).padStart(3,'0')
  return type === 'invoice' ? `INV-${serial}` : `Q-${serial}`
}

export default function AppNew(){
  const counter = useCounter()
  const { reset } = counter
  const [contractor, setContractor] = useState('MVP Solutions')
  const [showLogo, setShowLogo] = useState(true)
  const [docType, setDocType] = useState('quote')
  const docNumber = formatDocNumber(counter.raw, docType)
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileChecked, setProfileChecked] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [profileCompany, setProfileCompany] = useState('')
  const [profileName1, setProfileName1] = useState('')
  const [profileName2, setProfileName2] = useState('')
  const [profileName3, setProfileName3] = useState('')

  const [client, setClient] = useState('')
  const [address, setAddress] = useState('')

  const [houses, setHouses] = useState(0)
  const [fixturesPerHouse, setFixturesPerHouse] = useState(0)
  const [pricePerFixture, setPricePerFixture] = useState(0)
  const [fixtureType, setFixtureType] = useState('Residential')
  const [projectType, setProjectType] = useState('New Construction')
  const [includeUnderground, setIncludeUnderground] = useState(true)
  const [includeRough, setIncludeRough] = useState(true)
  const [includeTrim, setIncludeTrim] = useState(true)
  const [serviceStartPercent, setServiceStartPercent] = useState(50)
  const [serviceCompletionPercent, setServiceCompletionPercent] = useState(50)
  const [undergroundPct, setUndergroundPct] = useState(30)
  const [roughPct, setRoughPct] = useState(50)
  const [trimPct, setTrimPct] = useState(20)

  const [services, setServices] = useState(() => mergeServices(null))
  const [addons, setAddons] = useState([])
  const [notes, setNotes] = useState('')
  const [history, setHistory] = useState([])
  const [status, setStatus] = useState('draft')
  const [savedDocId, setSavedDocId] = useState(null)
  const [saveMessage, setSaveMessage] = useState('')
  const [savedDocs, setSavedDocs] = useState([])
  const [trips, setTrips] = useState([])
  const [tripsLoading, setTripsLoading] = useState(false)
  const [showTripLog, setShowTripLog] = useState(false)
  const [tripOrigin, setTripOrigin] = useState('')
  const [tripDest, setTripDest] = useState('')
  const [tripMiles, setTripMiles] = useState('')
  const [tripSaving, setTripSaving] = useState(false)
  const [tripMsg, setTripMsg] = useState('')
  const [clientPhotos, setClientPhotos] = useState([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [includePhotos, setIncludePhotos] = useState(false)
  const [photoMessage, setPhotoMessage] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)
  const [allScheduledDocs, setAllScheduledDocs] = useState([])
  const [showClients, setShowClients] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [subscription, setSubscription] = useState(null)
  const [subLoading, setSubLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [billingPortalLoading, setBillingPortalLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showQuickEstimate, setShowQuickEstimate] = useState(false)
  const signToken = useMemo(() => new URLSearchParams(window.location.search).get('sign'), [])
  const [signatureToken, setSignatureToken] = useState(null)
  const [signatureData, setSignatureData] = useState(null)
  const [signedAt, setSignedAt] = useState(null)
  const [signerName, setSignerName] = useState('')
  const [showSigModal, setShowSigModal] = useState(false)
  const [sigRequestLoading, setSigRequestLoading] = useState(false)
  const [showPaymentLinkModal, setShowPaymentLinkModal] = useState(false)
  const [paymentLinkUrl, setPaymentLinkUrl] = useState(null)
  const [paymentLinkLoading, setPaymentLinkLoading] = useState(false)
  const [clientEmail, setClientEmail] = useState('')
  const [accountId, setAccountId] = useState(null)
  const [userRole, setUserRole] = useState('admin')
  const [logoUrl, setLogoUrl] = useState('')
  const joinToken = useMemo(() => new URLSearchParams(window.location.search).get('join'), [])
  const paymentToken = useMemo(() => new URLSearchParams(window.location.search).get('payment'), [])

  const contractorNames = [profile?.name1, profile?.name2, profile?.name3].filter(Boolean)
  const defaultContractor = contractorNames[0] || profile?.company_name || 'MVP Solutions'
  const isNewConstruction = projectType === 'New Construction'
  const baseServiceAmount = services.reduce((sum,s) => {
    if (!isNewConstruction) return sum
    if (!BASE_SERVICE_IDS.includes(s.id)) return sum
    if ((s.billingMode ?? 'pct') !== 'pct') return sum
    return sum + ((s.enabled ? (s.qty||0) : 0) * (s.unit||0))
  }, 0)
  const base = houses * fixturesPerHouse * pricePerFixture + baseServiceAmount
  const phases = useMemo(() => {
    if (projectType === 'New Construction') {
      return { underground: base*(undergroundPct/100), rough: base*(roughPct/100), trim: base*(trimPct/100) }
    }
    return {
      start: base * (serviceStartPercent / 100),
      completion: base * (serviceCompletionPercent / 100)
    }
  }, [base, projectType, serviceStartPercent, serviceCompletionPercent, undergroundPct, roughPct, trimPct])
  const phasePctSum = undergroundPct + roughPct + trimPct
  const showFixturesPrint = base > 0
  const showNewConstructionSchedule = projectType === 'New Construction' && (includeUnderground || includeRough || includeTrim)
  const selectedPhaseNames = []
  if (includeUnderground) selectedPhaseNames.push(`${undergroundPct}% Underground`)
  if (includeRough) selectedPhaseNames.push(`${roughPct}% Rough-In`)
  if (includeTrim) selectedPhaseNames.push(`${trimPct}% Trim`)
  const selectedPhaseLabel = selectedPhaseNames.length === 0 ? '' : selectedPhaseNames.length === 1 ? selectedPhaseNames[0] : selectedPhaseNames.length === 2 ? `${selectedPhaseNames[0]} and ${selectedPhaseNames[1]}` : selectedPhaseNames.join(', ')
  const selectedPhaseAmount = (includeUnderground ? phases.underground : 0) + (includeRough ? phases.rough : 0) + (includeTrim ? phases.trim : 0)
  const paymentScheduleList = []
  if (includeUnderground) paymentScheduleList.push({ name: `${undergroundPct}% Underground`, pct: undergroundPct, amount: phases.underground })
  if (includeRough) paymentScheduleList.push({ name: `${roughPct}% Rough-In`, pct: roughPct, amount: phases.rough })
  if (includeTrim) paymentScheduleList.push({ name: `${trimPct}% Trim`, pct: trimPct, amount: phases.trim })
  const showPrintNote = projectType === 'New Construction' && selectedPhaseNames.length > 0 && (docType === 'quote' || selectedPhaseNames.length < 3)
  const printAddress = address || ''

  const servicesTotal = useMemo(()=> services.reduce((sum,it)=> {
    if (!it.enabled) return sum
    if (isNewConstruction && BASE_SERVICE_IDS.includes(it.id) && (it.billingMode ?? 'pct') === 'pct') return sum
    if (it.id === 'wh_replacement') return sum + (it.garageQty||0)*(it.garageUnit||0) + (it.atticQty||0)*(it.atticUnit||0)
    return sum + (it.qty||0)*(it.unit||0)
  }, 0), [services, isNewConstruction])
  const printServices = services.flatMap(s => {
    if (!s.enabled) return []
    if (isNewConstruction && BASE_SERVICE_IDS.includes(s.id) && (s.billingMode ?? 'pct') === 'pct') return []
    if (s.id === 'wh_replacement') {
      const rows = []
      if ((s.garageQty||0) > 0) rows.push({ ...s, name: 'Water Heater Replacement — Garage', qty: s.garageQty||0, unit: s.garageUnit||0 })
      if ((s.atticQty||0) > 0) rows.push({ ...s, name: 'Water Heater Replacement — Attic', qty: s.atticQty||0, unit: s.atticUnit||0 })
      return rows
    }
    if (!(s.qty||0)) return []
    const name = (s.id === 'water_tap' || s.id === 'sewer_tap') && s.desc ? `${s.name} — ${s.desc}` : s.name
    return [{ ...s, name }]
  })
  const addonsTotal = useMemo(()=> addons.reduce((s,a)=> s + (a.qty||0)*(a.unit||0), 0), [addons])
  const subtotal = base + servicesTotal + addonsTotal
  const isPhaseInvoice = docType === 'invoice' && projectType === 'New Construction' && selectedPhaseNames.length > 0
  const displayTotal = isPhaseInvoice ? selectedPhaseAmount + servicesTotal : subtotal
  const schedule = useMemo(() => {
    if (projectType === 'New Construction') {
      return { underground: subtotal*(undergroundPct/100), rough: subtotal*(roughPct/100), trim: subtotal*(trimPct/100) }
    }
    return { start: subtotal*0.5, completion: subtotal*0.5 }
  }, [subtotal, projectType, undergroundPct, roughPct, trimPct])

  const _now = new Date()
  // Allow access while loading or when table doesn't exist yet (subscription === null after load)
  const isSubActive = subLoading || !subscription || subscription.status === 'active' ||
    (subscription.status === 'trialing' && subscription.trial_end && new Date(subscription.trial_end) > _now)
  const trialDaysLeft = subscription?.status === 'trialing' && subscription.trial_end
    ? Math.max(0, Math.ceil((new Date(subscription.trial_end) - _now) / 86400000))
    : 0
  const isAdmin = userRole === 'admin' || userRole === 'owner'
  const isReadOnly = userRole === 'member' && docType === 'invoice'

  const fetchSavedDocs = useCallback(async () => {
    if (!user || !accountId) return
    const col = isAdmin ? 'user_id' : 'created_by'
    const val = isAdmin ? accountId : user.id
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq(col, val)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase fetch saved docs error:', error)
      return
    }
    setSavedDocs(data || [])
  }, [user, accountId, isAdmin])

  const fetchScheduledDocs = useCallback(async () => {
    if (!user || !accountId) return
    const col = isAdmin ? 'user_id' : 'created_by'
    const val = isAdmin ? accountId : user.id
    const { data, error } = await supabase
      .from('documents')
      .select('id, doc_number, doc_type, client, address, total, status, scheduled_date')
      .eq(col, val)
      .not('scheduled_date', 'is', null)
      .order('scheduled_date', { ascending: true })
    if (error) { console.error('Supabase fetch scheduled docs error:', error); return }
    setAllScheduledDocs(data || [])
  }, [user, accountId, isAdmin])

  const paymentAlerts = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0)
    const alerts = []
    savedDocs.forEach(doc => {
      if (!doc.scheduled_date) return
      const sched = new Date(doc.scheduled_date + 'T00:00:00')
      const daysUntil = Math.round((sched - today) / 86400000)
      if (doc.project_type === 'New Construction' || !doc.project_type) {
        const base = calcDocBase(doc)
        ;[
          { key:'underground', label:`${doc.underground_pct ?? 30}% Underground`, amount: base * ((doc.underground_pct ?? 30)/100), included: doc.include_underground !== false },
          { key:'rough',       label:`${doc.rough_pct ?? 50}% Rough-In`,    amount: base * ((doc.rough_pct ?? 50)/100), included: doc.include_rough !== false },
          { key:'trim',        label:`${doc.trim_pct ?? 20}% Trim`,         amount: base * ((doc.trim_pct ?? 20)/100), included: doc.include_trim !== false },
        ].forEach(p => {
          if (!p.included || isPhasePaid(doc, p.key)) return
          alerts.push({ doc, phaseKey: p.key, phaseLabel: p.label, amount: p.amount, daysUntil })
        })
      } else {
        const base = calcDocBase(doc)
        const startPct  = doc.service_start_percent  ?? 50
        const endPct    = doc.service_completion_percent ?? 50
        ;[
          { key:'start',      label:`${startPct}% Start`,       amount: base * startPct / 100 },
          { key:'completion', label:`${endPct}% Completion`,    amount: base * endPct / 100 },
        ].forEach(p => {
          if (isPhasePaid(doc, p.key)) return
          alerts.push({ doc, phaseKey: p.key, phaseLabel: p.label, amount: p.amount, daysUntil })
        })
      }
    })
    return alerts.sort((a, b) => a.daysUntil - b.daysUntil)
  }, [savedDocs])

  const markPhasePaid = useCallback(async (doc, phaseKey) => {
    const entry = { ts: new Date().toISOString(), entry: `phase:${phaseKey}:paid`, status: doc.status, docNumber: doc.doc_number }
    const newHistory = [entry, ...(doc.history || [])]
    const { error } = await supabase.from('documents').update({ history: newHistory }).eq('id', doc.id).eq('user_id', accountId || user?.id)
    if (!error) fetchSavedDocs()
  }, [user, accountId, fetchSavedDocs])

  async function startCheckout(){
    setCheckoutLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { origin: window.location.origin }
      })
      if (error || !data?.url) throw new Error(error?.message || 'No checkout URL returned')
      window.location.href = data.url
    } catch (e) {
      alert('Could not start checkout: ' + e.message)
      setCheckoutLoading(false)
    }
  }

  async function openBillingPortal(){
    setBillingPortalLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        body: { origin: window.location.origin }
      })
      if (error || !data?.url) throw new Error(error?.message || 'No portal URL returned')
      window.location.href = data.url
    } catch (e) {
      alert('Could not open billing portal: ' + e.message)
      setBillingPortalLoading(false)
    }
  }

  async function requestSignature() {
    if (!savedDocId) {
      const saved = await persistDocument()
      if (!saved) return
      await fetchSavedDocs()
    }
    setSigRequestLoading(true)
    let token = signatureToken
    if (!token) {
      token = crypto.randomUUID()
      const { error } = await supabase
        .from('documents')
        .update({ signature_token: token })
        .eq('id', savedDocId)
        .eq('user_id', user.id)
      if (error) {
        setSaveMessage('Failed to create signature link: ' + error.message)
        setSigRequestLoading(false)
        return
      }
      setSignatureToken(token)
    }
    setSigRequestLoading(false)
    setShowSigModal(true)
  }

  async function generatePaymentLink() {
    if (!savedDocId) {
      const saved = await persistDocument()
      if (!saved) return
      await fetchSavedDocs()
    }

    // Reuse existing link if already generated (stored in history)
    const existingLink = history.find(h => h.entry === 'payment_link_created')
    if (existingLink?.url) {
      setPaymentLinkUrl(existingLink.url)
      setShowPaymentLinkModal(true)
      return
    }

    setPaymentLinkLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-invoice-payment', {
        body: {
          doc_id: savedDocId,
          amount_cents: Math.round(displayTotal * 100),
          doc_number: docNumber,
          client_name: client,
        }
      })
      if (error || !data?.url) throw new Error(error?.message || 'No payment link returned')

      const entry = { ts: new Date().toISOString(), entry: 'payment_link_created', status, docNumber, url: data.url }
      const newHistory = [entry, ...history]
      setHistory(newHistory)
      persistDocument({ history: newHistory })

      setPaymentLinkUrl(data.url)
      setShowPaymentLinkModal(true)
    } catch (e) {
      alert('Could not create payment link: ' + e.message)
    } finally {
      setPaymentLinkLoading(false)
    }
  }

  async function signUp(){
    setAuthMessage('')
    if (!agreedToTerms) {
      setAuthMessage('Please agree to the Terms of Service and Privacy Policy to create an account.')
      return
    }
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setAuthMessage(error.message)
      return
    }
    setAuthMessage('Signup successful — check your email to confirm or sign in.')
  }

  async function signIn(){
    setAuthMessage('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setAuthMessage(error.message)
      return
    }
    setAuthMessage('Signed in successfully')
    setUser(data.user)
  }

  async function signOut(){
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setProfileChecked(false)
    setSubscription(null)
    setAccountId(null)
    setUserRole('admin')
    setLogoUrl('')
    setAuthMessage('Logged out')
  }

  async function loadProfile(){
    if (!user) return
    setProfileLoading(true)
    const fallback = setTimeout(() => {
      setProfileLoading(false)
      setProfileChecked(true)
    }, 10000)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) {
        console.error('Supabase load profile error:', error)
        return
      }
      if (data) {
        setProfile(data)
        setUserRole(data.role || 'admin')
        const resolvedAccountId = data.account_id || user.id
        setAccountId(resolvedAccountId)

        if (data.role === 'member' && data.account_id && data.account_id !== user.id) {
          // Load admin's profile for company name, contractor names, and logo
          const { data: adminProfile } = await supabase
            .from('profiles').select('*').eq('user_id', data.account_id).maybeSingle()
          const src = adminProfile || data
          setProfileCompany(src.company_name || '')
          setProfileName1(src.name1 || '')
          setProfileName2(src.name2 || '')
          setProfileName3(src.name3 || '')
          setContractor(src.name1 || src.company_name || 'MVP Solutions')
          setLogoUrl(src.logo_url ? getLogoUrl(src.logo_url) : '')
        } else {
          setProfileCompany(data.company_name || '')
          setProfileName1(data.name1 || '')
          setProfileName2(data.name2 || '')
          setProfileName3(data.name3 || '')
          setContractor(data.name1 || data.company_name || 'MVP Solutions')
          setLogoUrl(data.logo_url ? getLogoUrl(data.logo_url) : '')
        }
      } else {
        // No profile yet — check if this email has a pending team invite
        // (handles case where user arrives without ?join=TOKEN in URL)
        try {
          const { data: invite } = await supabase
            .from('team_members')
            .select('invite_token, account_id')
            .eq('email', user.email.toLowerCase())
            .eq('status', 'pending')
            .maybeSingle()

          if (invite?.invite_token) {
            const { data: acceptResult, error: acceptErr } = await supabase.functions.invoke('accept-team-invite', {
              body: { token: invite.invite_token }
            })
            if (!acceptErr && !acceptResult?.error) {
              // Re-fetch the newly created profile
              const { data: newProfile } = await supabase
                .from('profiles').select('*').eq('user_id', user.id).maybeSingle()
              if (newProfile) {
                setProfile(newProfile)
                setUserRole('member')
                setAccountId(invite.account_id)
                const { data: adminP } = await supabase
                  .from('profiles').select('*').eq('user_id', invite.account_id).maybeSingle()
                const src = adminP || newProfile
                setProfileCompany(src.company_name || '')
                setProfileName1(src.name1 || '')
                setProfileName2(src.name2 || '')
                setProfileName3(src.name3 || '')
                setContractor(src.name1 || src.company_name || 'MVP Solutions')
                setLogoUrl(src.logo_url ? getLogoUrl(src.logo_url) : '')
                return
              }
            }
          }
        } catch (inviteCheckErr) {
          console.warn('Invite check failed, treating as new user:', inviteCheckErr)
        }

        // No invite found — treat as new independent user
        setProfile(null)
        setAccountId(user.id)
        setUserRole('admin')
      }
    } catch (e) {
      console.error('Error loading profile', e)
    } finally {
      clearTimeout(fallback)
      setProfileLoading(false)
      setProfileChecked(true)
    }
  }

  async function saveProfile(){
    setProfileMessage('')
    if (!user) {
      setProfileMessage('Please sign in first.')
      return
    }
    if (!profileCompany.trim() || !profileName1.trim()) {
      setProfileMessage('Please enter a company name and at least one contractor name.')
      return
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert([{
          user_id: user.id,
          company_name: profileCompany.trim(),
          name1: profileName1.trim() || null,
          name2: profileName2.trim() || null,
          name3: profileName3.trim() || null
        }], { onConflict: 'user_id' })
        .select()
        .maybeSingle()
      if (error) {
        setProfileMessage(error.message)
        return
      }
      setProfile(data)
      setContractor(data.name1 || data.company_name)
      setProfileMessage('Profile saved successfully')
    } catch (e) {
      console.error('Error saving profile', e)
      setProfileMessage('Unable to save profile.')
    }
  }

  async function uploadLogo(file) {
    if (!user) return { error: 'Not logged in' }
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${user.id}/logo.${ext}`
    // Remove old file if it exists (upsert via overwrite)
    const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
    if (upErr) return { error: upErr.message }
    const { error: dbErr } = await supabase.from('profiles')
      .upsert([{ user_id: user.id, logo_url: path }], { onConflict: 'user_id' })
    if (dbErr) return { error: dbErr.message }
    setLogoUrl(getLogoUrl(path) + '?t=' + Date.now())
    return { ok: true }
  }

  async function removeLogo() {
    if (!user || !profile?.logo_url) return
    await supabase.storage.from('logos').remove([profile.logo_url])
    await supabase.from('profiles').upsert([{ user_id: user.id, logo_url: null }], { onConflict: 'user_id' })
    setLogoUrl('')
    setProfile(p => p ? { ...p, logo_url: null } : p)
  }

  function applyDocumentData(data){
    if (data.raw_counter != null) counter.reset(data.raw_counter)
    setSavedDocId(data.id ?? null)
    setContractor(data.contractor ?? 'MVP Solutions')
    setShowLogo(data.show_logo ?? true)
    setDocType(data.doc_type ?? 'quote')
    setClient(data.client ?? '')
    setAddress(data.address ?? '')
    setHouses(data.houses ?? 0)
    setFixturesPerHouse(data.fixtures_per_house ?? 0)
    setPricePerFixture(data.price_per_fixture ?? 0)
    setFixtureType(data.fixture_type ?? 'Residential')
    setProjectType(data.project_type ?? 'New Construction')
    setIncludeUnderground(data.include_underground ?? true)
    setIncludeRough(data.include_rough ?? true)
    setIncludeTrim(data.include_trim ?? true)
    setServiceStartPercent(data.service_start_percent ?? 50)
    setServiceCompletionPercent(data.service_completion_percent ?? 50)
    setUndergroundPct(data.underground_pct ?? 30)
    setRoughPct(data.rough_pct ?? 50)
    setTrimPct(data.trim_pct ?? 20)
    setServices(mergeServices(data.services))
    setAddons(data.addons ?? [])
    setNotes(data.notes ?? '')
    setHistory(data.history ?? [])
    setStatus(data.status ?? 'draft')
    setScheduleDate(data.scheduled_date ?? '')
    setSignatureToken(data.signature_token ?? null)
    setSignatureData(data.signature_data ?? null)
    setSignedAt(data.signed_at ?? null)
    setSignerName(data.signer_name ?? '')
    const savedLink = (data.history ?? []).find(h => h.entry === 'payment_link_created')
    setPaymentLinkUrl(savedLink?.url ?? null)
    setClientEmail(data.client_email ?? '')
    setSaveMessage(`Loaded document ${data.doc_number || ''}`)
  }

  // Use an already-fetched document row to populate the form state
  function openDocument(doc){
    if (!doc) return
    applyDocumentData(doc)
  }

  

  async function deleteDocument(id){
    if (!id) return
    if (!isAdmin) { setSaveMessage('Only admins can delete documents'); return }
    if (!window.confirm('Delete this document?')) return
    const { error } = await supabase.from('documents').delete().eq('id', id).eq('user_id', accountId || user?.id)
    if (error) {
      console.error('Supabase delete error:', error)
      setSaveMessage('Delete failed')
      return
    }
    await fetchSavedDocs()
    setSaveMessage('Document deleted')
  }

  useEffect(() => {
    async function initAuth(){
      const fallback = setTimeout(() => setAuthLoading(false), 10000)
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Supabase auth session error:', error)
        }
        setUser(data?.session?.user ?? null)
      } catch (e) {
        console.error('Error getting auth session', e)
      } finally {
        clearTimeout(fallback)
        setAuthLoading(false)
      }
    }

    initAuth()
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })
    return () => {
      if (authListener?.subscription?.unsubscribe) {
        authListener.subscription.unsubscribe()
      } else if (authListener?.unsubscribe) {
        authListener.unsubscribe()
      }
    }
  }, [])

  useEffect(() => {
    if (user) {
      loadProfile()
    } else {
      setProfileChecked(false)
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!savedDocId || !user) { setTrips([]); return }
    setTripsLoading(true)
    supabase.from('mileage_trips').select('*').eq('doc_id', String(savedDocId)).order('trip_date', { ascending: false })
      .then(({ data }) => { setTrips(data || []) })
      .finally(() => setTripsLoading(false))
  }, [savedDocId, user])

  useEffect(() => {
    if (!user) { setSubscription(null); setSubLoading(false); return }
    if (!accountId) return  // wait for profile/accountId to be resolved
    let cancelled = false
    setSubLoading(true)
    ;(async () => {
      try {
        const { data, error } = await supabase.from('subscriptions').select('*').eq('user_id', accountId).single()
        let sub = data
        // PGRST116 = no rows — create a trial only for independent account owners (never for team members)
        if (!sub && error?.code === 'PGRST116' && accountId === user.id && userRole !== 'member') {
          const trialEnd = new Date()
          trialEnd.setDate(trialEnd.getDate() + 30)
          const ins = await supabase.from('subscriptions')
            .insert({ user_id: accountId, status: 'trialing', trial_end: trialEnd.toISOString() })
            .select().single()
          sub = ins?.data ?? null
        }
        if (!cancelled) setSubscription(sub)
      } catch (e) {
        console.error('Subscription load error:', e)
      } finally {
        if (!cancelled) setSubLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user, accountId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') !== 'success') return
    window.history.replaceState({}, '', window.location.pathname)
    let attempts = 0
    const MAX = 15 // 15 × 2s = 30 seconds
    const poll = async () => {
      const { data } = await supabase.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle()
      if (data?.status === 'active') {
        setSubscription(data)
      } else if (attempts++ < MAX) {
        setTimeout(poll, 2000)
      } else {
        // Polling ended — load whatever is in the DB now so the UI isn't stale
        if (data) setSubscription(data)
      }
    }
    setTimeout(poll, 2000)
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showSchedule) fetchScheduledDocs()
  }, [showSchedule, fetchScheduledDocs])

  useEffect(() => {
    if (!user || !accountId || !client.trim()) { setClientPhotos([]); return }
    let cancelled = false
    const t = setTimeout(async () => {
      setPhotosLoading(true)
      try {
        const { data } = await supabase.from('photos').select('*').eq('user_id', accountId || user.id).eq('client_name', client.trim()).order('created_at', { ascending: true })
        if (!cancelled) setClientPhotos(data || [])
      } catch(e){ console.error('Load photos error', e) }
      finally { if (!cancelled) setPhotosLoading(false) }
    }, 400)
    return () => { cancelled = true; clearTimeout(t) }
  }, [client, user, accountId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const docCol = isAdmin ? 'user_id' : 'created_by'
    const docVal = isAdmin ? accountId : user?.id

    async function getMaxRawCounter(){
      if (!user || !accountId) return null
      try{
        const { data, error } = await supabase
          .from('documents')
          .select('raw_counter')
          .eq(docCol, docVal)
          .order('raw_counter', { ascending: false })
          .limit(1)

        if (error) {
          console.error('Supabase max raw_counter error:', error)
          return null
        }
        if (!Array.isArray(data) || data.length === 0 || data[0].raw_counter == null) return null
        return data[0].raw_counter
      } catch (e) {
        console.error('Error fetching max raw_counter', e)
        return null
      }
    }

    async function loadLastDocument() {
      if (!user || !accountId) return
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq(docCol, docVal)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Supabase load error:', error)
        return
      }
      if (!data) return

      // Do NOT reset the counter to the document's raw_counter on mount —
      // the counter should start at max(raw_counter)+1 instead.
      setSavedDocId(data.id ?? null)
      setContractor(data.contractor ?? 'MVP Solutions')
      setShowLogo(data.show_logo ?? true)
      setDocType(data.doc_type ?? 'quote')
      setClient(data.client ?? '')
      setAddress(data.address ?? '')
      setHouses(data.houses ?? 0)
      setFixturesPerHouse(data.fixtures_per_house ?? 0)
      setPricePerFixture(data.price_per_fixture ?? 0)
      setFixtureType(data.fixture_type ?? 'Residential')
      setProjectType(data.project_type ?? 'New Construction')
      setIncludeUnderground(data.include_underground ?? true)
      setIncludeRough(data.include_rough ?? true)
      setIncludeTrim(data.include_trim ?? true)
      setServiceStartPercent(data.service_start_percent ?? 50)
      setServiceCompletionPercent(data.service_completion_percent ?? 50)
      setUndergroundPct(data.underground_pct ?? 30)
      setRoughPct(data.rough_pct ?? 50)
      setTrimPct(data.trim_pct ?? 20)
      setServices(mergeServices(data.services))
      setAddons(data.addons ?? [])
      setNotes(data.notes ?? '')
      setHistory(data.history ?? [])
      setStatus(data.status ?? 'draft')
      setScheduleDate(data.scheduled_date ?? '')
      setSignatureToken(data.signature_token ?? null)
      setSignatureData(data.signature_data ?? null)
      setSignedAt(data.signed_at ?? null)
      setSignerName(data.signer_name ?? '')
      const savedLink = (data.history ?? []).find(h => h.entry === 'payment_link_created')
      setPaymentLinkUrl(savedLink?.url ?? null)
      setClientEmail(data.client_email ?? '')
    }

    async function init() {
      if (!user || !accountId) return
      const max = await getMaxRawCounter()
      const start = (max != null && typeof max === 'number') ? (max + 1) : 1
      try { reset(start) } catch (e) { /* ignore */ }
      await Promise.all([loadLastDocument(), fetchSavedDocs()])
    }
    init()
  }, [reset, fetchSavedDocs, user, accountId, isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  async function persistDocument(overrides = {}){
    if (!user?.id) { setSaveMessage('Not logged in'); return false }

    const payload = {
      contractor,
      show_logo: showLogo,
      doc_type: docType,
      client,
      address,
      houses,
      fixtures_per_house: fixturesPerHouse,
      price_per_fixture: pricePerFixture,
      fixture_type: fixtureType,
      project_type: projectType,
      include_underground: includeUnderground,
      include_rough: includeRough,
      include_trim: includeTrim,
      service_start_percent: serviceStartPercent,
      service_completion_percent: serviceCompletionPercent,
      underground_pct: undergroundPct,
      rough_pct: roughPct,
      trim_pct: trimPct,
      services,
      addons,
      notes,
      history,
      status,
      total: displayTotal,
      user_id: accountId || user.id,
      created_by: user.id,
      doc_number: docNumber,
      raw_counter: counter.raw,
      scheduled_date: scheduleDate || null,
      signature_token: signatureToken,
      signature_data: signatureData,
      signed_at: signedAt,
      signer_name: signerName || null,
      client_email: clientEmail || null,
      ...overrides
    }

    try {
      if (savedDocId) {
        const { error } = await supabase.from('documents').update(payload).eq('id', savedDocId).eq('user_id', accountId || user.id)
        if (error) {
          console.error('Supabase update error:', error)
          setSaveMessage(`Save failed: ${error.message}`)
          return null
        }
        setSaveMessage('Document saved successfully')
        return savedDocId
      }

      const { data, error } = await supabase.from('documents').insert([payload]).select('id').single()
      if (error) {
        console.error('Supabase insert error:', error)
        setSaveMessage(`Save failed: ${error.message}`)
        return null
      }
      setSavedDocId(data.id)
      setSaveMessage('Document saved successfully')
      return data.id
    } catch (e) {
      console.error('persistDocument exception:', e)
      setSaveMessage(`Save failed: ${e.message}`)
      return null
    }
  }

  async function saveDocument(){
    const saved = await persistDocument()
    if (saved) fetchSavedDocs()
  }
  function pushHistory(entry){ setHistory(h=> [{ ts:new Date().toISOString(), entry, status, docNumber }, ...h]) }
  function setDocStatus(next){
    const nextHistory = [{ ts:new Date().toISOString(), entry:`status:${next}`, status: next, docNumber }, ...history]
    setStatus(next)
    setHistory(nextHistory)
    persistDocument({ status: next, history: nextHistory })
  }
  async function convertToInvoice(){
    if (docType !== 'invoice'){
      counter.bump()
      setDocType('invoice')
      const convertEntry = { ts: new Date().toISOString(), entry: 'converted:quote->invoice', status, docNumber }
      const newHistory = [convertEntry, ...history]
      setHistory(newHistory)
      const docId = await persistDocument({ doc_type: 'invoice', history: newHistory })
      if (!docId) return

      if (clientEmail) {
        // Auto-generate a payment link for the invoice email
        let payLink = newHistory.find(h => h.entry === 'payment_link_created')?.url
        if (!payLink) {
          try {
            const { data: plData } = await supabase.functions.invoke('create-invoice-payment', {
              body: { doc_id: docId, amount_cents: Math.round(displayTotal * 100), doc_number: docNumber, client_name: client }
            })
            if (plData?.url) {
              payLink = plData.url
              const withLink = [{ ts: new Date().toISOString(), entry: 'payment_link_created', status: 'draft', docNumber, url: payLink }, ...newHistory]
              setHistory(withLink)
              persistDocument({ history: withLink })
              setPaymentLinkUrl(payLink)
            }
          } catch (e) { console.error('auto payment link on convert:', e) }
        }

        // Send invoice email with payment link
        try {
          await supabase.functions.invoke('send-client-email', {
            body: {
              type: 'invoice',
              to: clientEmail,
              client_name: client,
              doc_number: docNumber,
              total: displayTotal,
              address,
              notes,
              payment_link: payLink,
              contractor_name: contractor,
              company_name: profileCompany || contractor,
              payment_schedule: buildPaymentSchedule(),
            }
          })
          setSaveMessage(`Invoice emailed to ${clientEmail}`)
        } catch (e) {
          console.error('invoice email on convert:', e)
        }
      }
    }
  }
  function printDoc(){ pushHistory('printed'); window.print() }
  async function newNumber(){
    // Determine next raw counter based on the highest value in Supabase
    try{
      const query = supabase
        .from('documents')
        .select('raw_counter')
        .order('raw_counter', { ascending: false })
        .limit(1)

      const { data, error } = user
        ? (isAdmin
            ? await query.eq('user_id', accountId || user.id)
            : await query.eq('created_by', user.id))
        : await query

      let next
      if (!error && Array.isArray(data) && data.length > 0 && data[0].raw_counter != null) {
        next = data[0].raw_counter + 1
      } else if (!error && (!Array.isArray(data) || data.length === 0 || data[0]?.raw_counter == null)) {
        // No documents exist — start at 1
        next = 1
      } else {
        next = counter.raw + 1
      }
      counter.reset(next)
    } catch (e) {
      // fallback: increment local counter
      counter.reset(counter.raw + 1)
    }

    // Reset all form fields to defaults
    setSavedDocId(null)
    setSaveMessage('')
    setTrips([])
    setTripOrigin('')
    setTripDest('')
    setTripMiles('')
    setTripMsg('')
    setShowTripLog(false)
    setContractor(defaultContractor)
    setShowLogo(true)
    setDocType('quote')
    setClient('')
    setAddress('')
    setHouses(0)
    setFixturesPerHouse(0)
    setPricePerFixture(0)
    setFixtureType('Residential')
    setProjectType('New Construction')
    setIncludeUnderground(true)
    setIncludeRough(true)
    setIncludeTrim(true)
    setServiceStartPercent(50)
    setServiceCompletionPercent(50)
    setUndergroundPct(30)
    setRoughPct(50)
    setTrimPct(20)
    setServices(mergeServices(null))
    setAddons([])
    setNotes('')
    setHistory([])
    setStatus('draft')
    setScheduleDate('')
    setSignatureToken(null)
    setSignatureData(null)
    setSignedAt(null)
    setSignerName('')
    setShowSigModal(false)
    setShowPaymentLinkModal(false)
    setPaymentLinkUrl(null)
    setClientEmail('')
    pushHistory('reset:number')
  }

  function toggleService(i, enabled){ setServices(s=>{ const c=[...s]; c[i].enabled = enabled; return c }) }
  function updateService(i, field, value){ setServices(s=>{ const c=[...s]; c[i] = { ...c[i], [field]: value }; return c }) }
  function addAddon(desc, qty, unit){ setAddons(a=>[...a, { desc, qty, unit }]); pushHistory('addon:added') }
  function removeAddon(i){ setAddons(a=> a.filter((_,idx)=>idx!==i)); pushHistory('addon:removed') }

  async function uploadPhoto(file){
    if (!user || !client.trim()) return
    setPhotoUploading(true)
    setPhotoMessage('')
    try {
      const slug = client.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${user.id}/${slug}/${Date.now()}-${safeName}`
      const { error: upErr } = await supabase.storage.from('job-photos').upload(path, file)
      if (upErr) { setPhotoMessage(upErr.message); return }
      const { error: dbErr } = await supabase.from('photos').insert([{ user_id: accountId || user.id, client_name: client.trim(), file_path: path, storage_path: path, file_name: file.name }])
      if (dbErr) { setPhotoMessage(dbErr.message); return }
      const { data } = await supabase.from('photos').select('*').eq('user_id', accountId || user.id).eq('client_name', client.trim()).order('created_at', { ascending: true })
      setClientPhotos(data || [])
      setPhotoMessage('Uploaded!')
      setTimeout(() => setPhotoMessage(''), 2000)
    } catch(e){ console.error('Upload error', e); setPhotoMessage('Upload failed') }
    finally { setPhotoUploading(false) }
  }

  async function deletePhoto(photo){
    if (!window.confirm('Delete this photo?')) return
    try {
      await supabase.storage.from('job-photos').remove([photo.file_path || photo.storage_path])
      await supabase.from('photos').delete().eq('id', photo.id)
      setClientPhotos(p => p.filter(x => x.id !== photo.id))
    } catch(e){ console.error('Delete photo error', e) }
  }

  async function logTrip() {
    const miles = parseFloat(tripMiles) || 0
    if (!tripOrigin.trim() || !tripDest.trim() || !miles) {
      setTripMsg('Please fill in origin, destination, and miles.')
      return
    }
    const docId = savedDocId || await persistDocument()
    if (!docId) { setTripMsg('Save the document first.'); return }
    setTripSaving(true)
    setTripMsg('')
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('mileage_trips').insert([{
      user_id: user.id,
      account_id: accountId,
      doc_id: String(docId),
      trip_date: today,
      origin: tripOrigin.trim(),
      destination: tripDest.trim(),
      miles,
      purpose: client || '',
    }])
    if (error) { setTripMsg('Failed: ' + error.message); setTripSaving(false); return }
    setTripOrigin('')
    setTripDest('')
    setTripMiles('')
    setTripMsg('Trip logged!')
    setTimeout(() => setTripMsg(''), 2000)
    const { data } = await supabase.from('mileage_trips').select('*').eq('doc_id', String(docId)).order('trip_date', { ascending: false })
    setTrips(data || [])
    setTripSaving(false)
  }

  async function deleteTrip(id) {
    if (!window.confirm('Delete this trip?')) return
    await supabase.from('mileage_trips').delete().eq('id', id)
    setTrips(t => t.filter(x => x.id !== id))
  }

  function buildPaymentSchedule() {
    if (projectType === 'New Construction') {
      const ps = []
      if (includeUnderground) ps.push({ name: `${undergroundPct}% Underground`, amount: schedule.underground })
      if (includeRough)       ps.push({ name: `${roughPct}% Rough-In`, amount: schedule.rough })
      if (includeTrim)        ps.push({ name: `${trimPct}% Trim`, amount: schedule.trim })
      return ps
    }
    return [
      { name: `${serviceStartPercent}% Start`, amount: schedule.start },
      { name: `${serviceCompletionPercent}% Completion`, amount: schedule.completion },
    ]
  }

  async function sendEmail(){
    if (clientEmail) {
      // Send branded HTML email via Resend
      const payLink = docType === 'invoice' ? history.find(h => h.entry === 'payment_link_created')?.url : null
      setSaveMessage('Sending email…')
      try {
        const { error } = await supabase.functions.invoke('send-client-email', {
          body: {
            type: docType === 'invoice' ? 'invoice' : 'quote',
            to: clientEmail,
            client_name: client,
            doc_number: docNumber,
            total: displayTotal,
            address,
            notes,
            payment_link: payLink,
            contractor_name: contractor,
            company_name: profileCompany || contractor,
            payment_schedule: buildPaymentSchedule(),
          }
        })
        if (error) throw new Error(error.message)
        setSaveMessage(`Email sent to ${clientEmail}`)
      } catch (e) {
        setSaveMessage('Email failed: ' + e.message)
      }
      return
    }
    // Fallback: open device mail app when no client email is on file
    const subject = `${docNumber} - ${contractor}`
    const paymentLines = buildPaymentSchedule().map(p => `  - ${p.name}: ${formatCurrency(p.amount)}`)
    const bodyParts = [
      `Dear ${client || 'Client'},`,
      '',
      `Please find your ${docType === 'invoice' ? 'invoice' : 'quote'} details below.`,
      '',
      `Document: ${docNumber}`,
      client ? `Client: ${client}` : null,
      address ? `Address: ${address}` : null,
      `Total: ${formatCurrency(displayTotal)}`,
      '',
      'Payment Schedule:',
      ...paymentLines,
    ]
    if (notes) bodyParts.push('', `Notes: ${notes}`)
    bodyParts.push('', 'Please contact us if you have any questions.', '', contractor)
    const body = bodyParts.filter(l => l !== null).join('\n')
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  async function markDocumentPaid() {
    setDocStatus('paid')
    if (clientEmail) {
      try {
        await supabase.functions.invoke('send-client-email', {
          body: {
            type: 'payment_receipt',
            to: clientEmail,
            client_name: client,
            doc_number: docNumber,
            total: displayTotal,
            contractor_name: contractor,
            company_name: profileCompany || contractor,
          }
        })
        setSaveMessage(`Payment receipt sent to ${clientEmail}`)
      } catch (e) {
        console.error('receipt email failed:', e)
      }
    }
  }

  function handleQuickSaved(savedDoc) {
    applyDocumentData(savedDoc)
    counter.bump()
    fetchSavedDocs()
    setShowQuickEstimate(false)
    setSaveMessage('Quick estimate saved!')
  }

  if (signToken) return <SignaturePage token={signToken} />
  if (joinToken) return <JoinPage token={joinToken} user={user} authLoading={authLoading} />
  if (paymentToken === 'success') return <PaymentThankYouPage />

  if (authLoading || (user && !profileChecked)) {
    return (
      <div className='invoice-root' style={{ minHeight:'100vh', background:NAVY, color:'#fff', padding:20, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ textAlign:'center' }}>Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className='invoice-root' style={{ minHeight:'100vh', background:NAVY, color:'#fff', padding:20, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:360, padding:24, background:'#071827', borderRadius:12, boxShadow:'0 10px 40px rgba(0,0,0,0.4)' }}>
          <div style={{ textAlign:'center', marginBottom:20 }}>
            <img src='/logo.svg' alt='FieldQuote' style={{ height:90, width:'auto' }} />
          </div>
          <h2 style={{ color:GOLD, marginBottom:12, textAlign:'center' }}>Login or Sign Up</h2>
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block', marginBottom:6, color:'#9fb0c6' }}>Email</label>
            <input type='email' value={email} onChange={e=>setEmail(e.target.value)} style={{ width:'100%', padding:10, borderRadius:6, border:'1px solid #223' }} />
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', marginBottom:6, color:'#9fb0c6' }}>Password</label>
            <input type='password' value={password} onChange={e=>setPassword(e.target.value)} style={{ width:'100%', padding:10, borderRadius:6, border:'1px solid #223' }} />
          </div>
          <div style={{ marginBottom:14, display:'flex', alignItems:'flex-start', gap:10 }}>
            <input type='checkbox' id='agreeTerms' checked={agreedToTerms} onChange={e=>setAgreedToTerms(e.target.checked)} style={{ marginTop:3, accentColor:GOLD, flexShrink:0, width:15, height:15, cursor:'pointer' }} />
            <label htmlFor='agreeTerms' style={{ color:'#9fb0c6', fontSize:12, lineHeight:1.5, cursor:'pointer' }}>
              I agree to the{' '}
              <a href='/terms' target='_blank' rel='noopener noreferrer' style={{ color:GOLD, textDecoration:'none' }}>Terms of Service</a>
              {' '}and{' '}
              <a href='/privacy' target='_blank' rel='noopener noreferrer' style={{ color:GOLD, textDecoration:'none' }}>Privacy Policy</a>
              {' '}(required for Sign Up)
            </label>
          </div>
          {authMessage ? <div style={{ color:GOLD, marginBottom:12, fontSize:13 }}>{authMessage}</div> : null}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <button onClick={signIn} style={{ flex:1, padding:10, borderRadius:6, background:GOLD, color:NAVY, border:'none' }}>Sign In</button>
            <button onClick={signUp} style={{ flex:1, padding:10, borderRadius:6, background:'#0f2740', color:'#fff', border:`1px solid ${GOLD}`, opacity: agreedToTerms ? 1 : 0.55 }}>Sign Up</button>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className='invoice-root' style={{ minHeight:'100vh', background:NAVY, color:'#fff', padding:20, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:420, padding:28, background:'#071827', borderRadius:12, boxShadow:'0 10px 40px rgba(0,0,0,0.4)' }}>
          <h2 style={{ color:GOLD, marginBottom:6 }}>Welcome! Set Up Your Profile</h2>
          <p style={{ color:'#9fb0c6', marginBottom:20, fontSize:14 }}>Signed in as {user.email}</p>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', marginBottom:6, color:'#9fb0c6' }}>Company Name *</label>
            <input value={profileCompany} onChange={e=>setProfileCompany(e.target.value)} placeholder='Your company name' style={{ width:'100%', padding:10, borderRadius:6, border:'1px solid #223', boxSizing:'border-box', background:'#0a1e32', color:'#fff' }} />
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', marginBottom:6, color:'#9fb0c6' }}>Contractor Name 1 *</label>
            <input value={profileName1} onChange={e=>setProfileName1(e.target.value)} placeholder='e.g. John Smith' style={{ width:'100%', padding:10, borderRadius:6, border:'1px solid #223', boxSizing:'border-box', background:'#0a1e32', color:'#fff' }} />
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', marginBottom:6, color:'#9fb0c6' }}>Contractor Name 2 <span style={{ color:'#7f98b0', fontWeight:400 }}>(optional)</span></label>
            <input value={profileName2} onChange={e=>setProfileName2(e.target.value)} placeholder='e.g. Jane Smith' style={{ width:'100%', padding:10, borderRadius:6, border:'1px solid #223', boxSizing:'border-box', background:'#0a1e32', color:'#fff' }} />
          </div>
          <div style={{ marginBottom:22 }}>
            <label style={{ display:'block', marginBottom:6, color:'#9fb0c6' }}>Contractor Name 3 <span style={{ color:'#7f98b0', fontWeight:400 }}>(optional)</span></label>
            <input value={profileName3} onChange={e=>setProfileName3(e.target.value)} placeholder='e.g. Bob Smith' style={{ width:'100%', padding:10, borderRadius:6, border:'1px solid #223', boxSizing:'border-box', background:'#0a1e32', color:'#fff' }} />
          </div>
          {profileMessage ? <div style={{ color: profileMessage.includes('success') ? '#4caf50' : GOLD, marginBottom:14 }}>{profileMessage}</div> : null}
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={saveProfile} disabled={profileLoading} style={{ flex:1, padding:10, borderRadius:6, background:GOLD, color:NAVY, border:'none', fontWeight:700, cursor:'pointer' }}>
              {profileLoading ? 'Saving…' : 'Save & Continue'}
            </button>
            <button onClick={signOut} style={{ padding:10, borderRadius:6, background:'transparent', color:'#9fb0c6', border:'1px solid #334', cursor:'pointer' }}>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!isSubActive) {
    const isExpired = subscription?.status === 'trialing' && trialDaysLeft === 0
    const isPastDue = subscription?.status === 'past_due'
    const isCanceled = subscription?.status === 'canceled'

    // Team members never see Stripe — they don't pay, their owner does
    if (userRole === 'member') {
      return (
        <div className='invoice-root' style={{ minHeight:'100vh', background:NAVY, color:'#fff', padding:20, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ width:400, padding:32, background:'#071827', borderRadius:14, boxShadow:'0 10px 40px rgba(0,0,0,0.5)', textAlign:'center' }}>
            <img src='/logo.svg' alt='FieldQuote' style={{ height:80, width:'auto', marginBottom:24 }} />
            <h2 style={{ color:GOLD, marginBottom:8 }}>Account Inactive</h2>
            <p style={{ color:'#9fb0c6', marginBottom:24, lineHeight:1.6 }}>
              Your team account is currently inactive. Please ask your account owner to renew their FieldQuote subscription to restore access.
            </p>
            <button onClick={signOut} style={{ background:'transparent', border:`1px solid ${GOLD}`, color:GOLD, padding:'10px 24px', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:14 }}>Sign Out</button>
          </div>
        </div>
      )
    }

    return (
      <div className='invoice-root' style={{ minHeight:'100vh', background:NAVY, color:'#fff', padding:20, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:400, padding:32, background:'#071827', borderRadius:14, boxShadow:'0 10px 40px rgba(0,0,0,0.5)', textAlign:'center' }}>
          <img src='/logo.svg' alt='FieldQuote' style={{ height:80, width:'auto', marginBottom:24 }} />
          {isPastDue ? (
            <>
              <h2 style={{ color:GOLD, marginBottom:8 }}>Payment Failed</h2>
              <p style={{ color:'#9fb0c6', marginBottom:20, lineHeight:1.5 }}>We couldn't process your last payment. Please update your billing info to continue using FieldQuote.</p>
            </>
          ) : isCanceled ? (
            <>
              <h2 style={{ color:GOLD, marginBottom:8 }}>Subscription Canceled</h2>
              <p style={{ color:'#9fb0c6', marginBottom:20, lineHeight:1.5 }}>Your subscription has been canceled. Resubscribe to continue using FieldQuote.</p>
            </>
          ) : isExpired ? (
            <>
              <h2 style={{ color:GOLD, marginBottom:8 }}>Free Trial Ended</h2>
              <p style={{ color:'#9fb0c6', marginBottom:20, lineHeight:1.5 }}>Your 30-day free trial has ended. Subscribe to keep creating quotes and invoices.</p>
            </>
          ) : (
            <>
              <h2 style={{ color:GOLD, marginBottom:8 }}>Subscribe to FieldQuote</h2>
              <p style={{ color:'#9fb0c6', marginBottom:20, lineHeight:1.5 }}>Start your 30-day free trial. No charge until your trial ends.</p>
            </>
          )}
          <div style={{ background:'#0a1e32', borderRadius:10, padding:'16px 20px', marginBottom:24 }}>
            <div style={{ fontSize:36, fontWeight:700, color:GOLD }}>$29<span style={{ fontSize:16, color:'#9fb0c6', fontWeight:400 }}>/month</span></div>
            <div style={{ color:'#7f98b0', fontSize:13, marginTop:4 }}>Unlimited quotes &amp; invoices · All features</div>
          </div>
          <button
            onClick={startCheckout}
            disabled={checkoutLoading}
            style={{ width:'100%', padding:'13px 0', borderRadius:8, background:GOLD, color:NAVY, border:'none', fontWeight:700, fontSize:16, cursor:'pointer', marginBottom:12 }}
          >
            {checkoutLoading ? 'Redirecting to Stripe…' : isPastDue || isCanceled ? 'Resubscribe — $29/month' : 'Start Free Trial'}
          </button>
          <button onClick={signOut} style={{ background:'transparent', border:'none', color:'#7f98b0', cursor:'pointer', fontSize:13 }}>Sign out ({user.email})</button>
        </div>
      </div>
    )
  }

  return (
    <div className='invoice-root' style={{ minHeight:'100vh', background:NAVY, color:'#fff', padding:20 }}>
      <div className='invoice-shell' style={{ maxWidth:980, margin:'0 auto', background:'#071827', padding:18, borderRadius:8 }}>

        {subscription?.status === 'trialing' && (
          <div className='no-print trial-banner' style={{ margin:'-18px -18px 18px -18px', padding:'10px 20px', background: trialDaysLeft <= 7 ? '#2a0e00' : '#0f1e0a', borderBottom:`2px solid ${trialDaysLeft <= 7 ? '#e87040' : GOLD}`, borderRadius:'8px 8px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:18, lineHeight:1 }}>{trialDaysLeft <= 7 ? '⚠' : '🕐'}</span>
              <div>
                <span style={{ color: trialDaysLeft <= 7 ? '#e87040' : GOLD, fontWeight:700, fontSize:13 }}>
                  {trialDaysLeft === 0 ? 'Free trial expired' : `Free trial — ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} remaining`}
                </span>
                <span style={{ color:'#9fb0c6', fontSize:12, marginLeft:8 }}>
                  {trialDaysLeft === 0 ? 'Subscribe to keep your access.' : 'Subscribe before your trial ends to avoid interruption.'}
                </span>
              </div>
            </div>
            <button onClick={startCheckout} disabled={checkoutLoading} className='trial-subscribe-btn' style={{ background:GOLD, color:NAVY, border:'none', padding:'7px 16px', borderRadius:6, cursor:'pointer', fontWeight:700, fontSize:13, whiteSpace:'nowrap', flexShrink:0 }}>
              {checkoutLoading ? 'Redirecting…' : 'Subscribe — $29/mo'}
            </button>
          </div>
        )}

        <div className='invoice-header screen-only' style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <img src={logoUrl || '/logo.svg'} alt={logoUrl ? profileCompany || 'Logo' : 'FieldQuote'} style={{ height:64, width:'auto', maxWidth:200, objectFit:'contain' }} />
          <div style={{ textAlign:'right' }}><div style={{ color:'#9fb0c6' }}>{docType.toUpperCase()}</div><div style={{ color:GOLD, fontWeight:700 }}>{docNumber}</div></div>
        </div>

        <div className='screen-only'>
          <div className='no-print' style={{ marginTop:12, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <button onClick={()=>setShowQuickEstimate(true)}
            style={{ background:GOLD, color:NAVY, border:'none', padding:'8px 14px', borderRadius:6, fontWeight:700, fontSize:13, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap', letterSpacing:'-0.2px' }}>
            ⚡ Quick Estimate
          </button>
          {contractorNames.map(name => (
            <button key={name} onClick={()=>setContractor(name)} style={{ padding:8, borderRadius:6, background: contractor===name ? GOLD : '#0f2740', color: contractor===name ? NAVY : '#fff' }}>{name}</button>
          ))}
          {/* Hamburger — only visible on mobile via CSS */}
          <button className='mobile-menu-btn' onClick={()=>setMenuOpen(m=>!m)}
            style={{ marginLeft:'auto', background: menuOpen ? GOLD : '#0f2740', color: menuOpen ? NAVY : '#fff', border:`1px solid ${GOLD}`, padding:'8px 12px', borderRadius:6, fontSize:18, lineHeight:1, flexShrink:0, cursor:'pointer' }}>
            {menuOpen ? '✕' : '☰'}
          </button>
          {/* Nav buttons — hidden on mobile, shown as column when menuOpen */}
          <div className={`toolbar-nav${menuOpen ? ' toolbar-nav-open' : ''}`} style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <label style={{ color:'#9fb0c6' }}><input type='radio' checked={docType==='quote'} onChange={()=>setDocType('quote')} /> Quote</label>
            <label style={{ color:'#9fb0c6' }}><input type='radio' checked={docType==='invoice'} onChange={()=>setDocType('invoice')} /> Invoice</label>
            <button onClick={convertToInvoice} style={{ background:GOLD, color:NAVY, padding:8, borderRadius:6 }}>Convert to Invoice</button>
            <button onClick={saveDocument} disabled={isReadOnly} style={{ background: isReadOnly ? '#1a1a2e' : '#0f2740', color: isReadOnly ? '#555' : '#fff', border:`1px solid ${isReadOnly ? '#333' : GOLD}`, padding:8, borderRadius:6, cursor: isReadOnly ? 'not-allowed' : 'pointer' }}>Save Document</button>
            {isAdmin && <button onClick={()=>setShowDashboard(s=>!s)} style={{ background:showDashboard ? GOLD : '#0f2740', color:showDashboard ? NAVY : '#fff', border:`1px solid ${GOLD}`, padding:8, borderRadius:6 }}>Dashboard</button>}
            <button onClick={()=>setShowSchedule(s=>!s)} style={{ background:showSchedule ? GOLD : '#0f2740', color:showSchedule ? NAVY : '#fff', border:`1px solid ${GOLD}`, padding:8, borderRadius:6 }}>Schedule</button>
            <button onClick={()=>setShowClients(s=>!s)} style={{ background:showClients ? GOLD : '#0f2740', color:showClients ? NAVY : '#fff', border:`1px solid ${GOLD}`, padding:8, borderRadius:6 }}>Clients</button>
            <button onClick={sendEmail} style={{ background:'#0f2740', color:'#fff', border:`1px solid ${GOLD}`, padding:8, borderRadius:6 }}>Send Email</button>
            <label style={{ color:'#9fb0c6', display:'flex', alignItems:'center', gap:4, userSelect:'none' }}><input type='checkbox' checked={includePhotos} onChange={e=>setIncludePhotos(e.target.checked)} /> Photos</label>
            <button onClick={printDoc} style={{ background:GOLD, color:NAVY, padding:8, borderRadius:6 }}>Print / PDF</button>
            <button onClick={()=>setShowHelp(s=>!s)} style={{ background:showHelp ? GOLD : '#0f2740', color:showHelp ? NAVY : '#fff', border:`1px solid ${GOLD}`, padding:8, borderRadius:6 }}>Help</button>
            {isAdmin && <button onClick={()=>setShowSettings(s=>!s)} style={{ background:showSettings ? GOLD : '#0f2740', color:showSettings ? NAVY : '#fff', border:`1px solid ${GOLD}`, padding:8, borderRadius:6 }}>Settings</button>}
            <button onClick={requestSignature} disabled={sigRequestLoading}
              style={{ background: signedAt ? '#1a3d1a' : showSigModal ? GOLD : '#0f2740', color: signedAt ? '#4caf50' : showSigModal ? NAVY : '#fff', border:`1px solid ${signedAt ? '#4caf50' : GOLD}`, padding:8, borderRadius:6, cursor:'pointer' }}>
              {sigRequestLoading ? '…' : signedAt ? '✓ Signed' : '✍ Signature'}
            </button>
            {docType === 'invoice' && (
              <button onClick={generatePaymentLink} disabled={paymentLinkLoading}
                style={{ background: showPaymentLinkModal ? GOLD : '#0f2740', color: showPaymentLinkModal ? NAVY : '#fff', border:`1px solid ${GOLD}`, padding:8, borderRadius:6, cursor:'pointer' }}>
                {paymentLinkLoading ? '…' : '$ Pay Link'}
              </button>
            )}
            <button onClick={signOut} style={{ background:'#7a0a0a', color:'#fff', padding:8, borderRadius:6, border:`1px solid ${GOLD}` }}>Logout</button>
            <span className='toolbar-email' style={{ color:'#9fb0c6' }}>{user?.email}</span>
          </div>
          {!isAdmin && (
            <div style={{ width:'100%', marginTop:6, display:'flex', gap:8, alignItems:'center' }}>
              <span style={{ background:'#1a2840', color:'#9fb0c6', border:'1px solid #334', padding:'3px 10px', borderRadius:10, fontSize:11, fontWeight:600, letterSpacing:'0.5px' }}>
                Team Member
              </span>
              <span style={{ color:'#7f98b0', fontSize:12 }}>
                You can create &amp; edit quotes, convert to invoice, and log your own mileage.
              </span>
            </div>
          )}
          {isReadOnly && (
            <div style={{ width:'100%', marginTop:6, background:'#1a0a00', border:'1px solid #7a3a00', borderRadius:6, padding:'8px 14px', display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ color:'#e87040', fontSize:13, fontWeight:700 }}>Read-only:</span>
              <span style={{ color:'#c9a06c', fontSize:13 }}>This invoice has been created and cannot be edited by team members.</span>
            </div>
          )}
          {saveMessage ? <div style={{ color:GOLD, marginTop:8, fontWeight:700, width:'100%' }}>{saveMessage}</div> : null}
        </div>

        {showSigModal && (
          <div className='no-print' style={{ marginTop:12, background:'#041827', borderRadius:10, padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h4 style={{ color:GOLD, margin:0 }}>Signature Request</h4>
              <button onClick={()=>setShowSigModal(false)} style={{ background:'transparent', color:'#9fb0c6', border:'1px solid #334', padding:'4px 10px', borderRadius:6, cursor:'pointer' }}>✕ Close</button>
            </div>
            {signedAt ? (
              <div>
                <div style={{ color:'#4caf50', fontWeight:700, marginBottom:6, fontSize:15 }}>✓ Signed by {signerName}</div>
                <div style={{ color:'#9fb0c6', fontSize:13, marginBottom:12 }}>Signed on {new Date(signedAt).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}</div>
                {signatureData && <img src={signatureData} alt='Client signature' style={{ height:72, background:'#fff', borderRadius:6, padding:8, display:'block' }} />}
              </div>
            ) : (
              <>
                <div style={{ color:'#9fb0c6', marginBottom:12, fontSize:14 }}>
                  Share this link with <strong style={{ color:'#fff' }}>{client || 'your client'}</strong> so they can sign on their phone or computer:
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  <input readOnly value={`${window.location.origin}/?sign=${signatureToken}`}
                    style={{ flex:1, minWidth:200, padding:10, borderRadius:6, border:'1px solid #334', background:'#0a1e32', color:'#9fb0c6', fontSize:13 }} />
                  <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/?sign=${signatureToken}`).then(()=>setSaveMessage('Signature link copied!'))}
                    style={{ background:GOLD, color:NAVY, border:'none', padding:'10px 16px', borderRadius:6, cursor:'pointer', fontWeight:700, fontSize:13, whiteSpace:'nowrap' }}>
                    Copy Link
                  </button>
                </div>
                <div style={{ marginTop:10, color:'#7f98b0', fontSize:12 }}>
                  The client opens the link, sees the {docType} summary, draws their signature with a finger, and submits. The signed copy will appear here automatically.
                </div>
              </>
            )}
          </div>
        )}

        {showPaymentLinkModal && docType === 'invoice' && (
          <div className='no-print' style={{ marginTop:12, background:'#041827', borderRadius:10, padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h4 style={{ color:GOLD, margin:0 }}>Payment Link</h4>
              <button onClick={()=>setShowPaymentLinkModal(false)} style={{ background:'transparent', color:'#9fb0c6', border:'1px solid #334', padding:'4px 10px', borderRadius:6, cursor:'pointer' }}>✕ Close</button>
            </div>
            <div style={{ color:'#9fb0c6', marginBottom:12, fontSize:14 }}>
              Send this link to <strong style={{ color:'#fff' }}>{client || 'your client'}</strong> so they can pay <strong style={{ color:GOLD }}>{formatCurrency(displayTotal)}</strong> securely online:
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <input readOnly value={paymentLinkUrl || ''}
                style={{ flex:1, minWidth:200, padding:10, borderRadius:6, border:'1px solid #334', background:'#0a1e32', color:'#9fb0c6', fontSize:13 }} />
              <button
                onClick={() => navigator.clipboard.writeText(paymentLinkUrl).then(() => setSaveMessage('Payment link copied!'))}
                style={{ background:GOLD, color:NAVY, border:'none', padding:'10px 16px', borderRadius:6, cursor:'pointer', fontWeight:700, fontSize:13, whiteSpace:'nowrap' }}>
                Copy Link
              </button>
            </div>
            <div style={{ marginTop:10, color:'#7f98b0', fontSize:12 }}>
              The client clicks the link, enters their card details, and pays securely via Stripe. This invoice will be marked Paid automatically once payment clears.
            </div>
            {history.find(h => h.entry === 'paid:stripe') && (
              <div style={{ marginTop:10, color:'#4caf50', fontWeight:700, fontSize:14 }}>✓ Payment received via Stripe</div>
            )}
          </div>
        )}

        {showSettings ? (
          <div className='no-print'>
            <SettingsPanel
              user={user}
              company={profileCompany}
              name1={profileName1}
              name2={profileName2}
              name3={profileName3}
              subscription={subscription}
              trialDaysLeft={trialDaysLeft}
              subscribeLoading={checkoutLoading}
              billingPortalLoading={billingPortalLoading}
              onSubscribe={startCheckout}
              onManageBilling={openBillingPortal}
              onSave={async (company, n1, n2, n3) => {
                const { data, error } = await supabase
                  .from('profiles')
                  .upsert([{ user_id: user.id, company_name: company, name1: n1 || null, name2: n2 || null, name3: n3 || null }], { onConflict: 'user_id' })
                  .select().maybeSingle()
                if (error) return error.message
                setProfile(data)
                setProfileCompany(data.company_name || '')
                setProfileName1(data.name1 || '')
                setProfileName2(data.name2 || '')
                setProfileName3(data.name3 || '')
                setContractor(data.name1 || data.company_name || 'MVP Solutions')
                return null
              }}
              onClose={()=>setShowSettings(false)}
              isAdmin={isAdmin}
              accountId={accountId}
              logoUrl={logoUrl}
              onUploadLogo={uploadLogo}
              onRemoveLogo={removeLogo}
            />
          </div>
        ) : null}

        {(() => {
          const overdue  = paymentAlerts.filter(a => a.daysUntil < 0).length
          const dueToday = paymentAlerts.filter(a => a.daysUntil === 0).length
          const dueSoon  = paymentAlerts.filter(a => a.daysUntil > 0 && a.daysUntil <= 7).length
          const urgent   = overdue + dueToday + dueSoon
          if (!urgent) return null
          const parts = []
          if (overdue)  parts.push(`${overdue} overdue`)
          if (dueToday) parts.push(`${dueToday} due today`)
          if (dueSoon)  parts.push(`${dueSoon} due this week`)
          return (
            <div className='no-print' style={{ margin:'10px 0 0', padding:'10px 16px', background:'#1c0e00', border:'1px solid #e8a020', borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:20, lineHeight:1 }}>⚠</span>
                <div>
                  <span style={{ color:'#e8a020', fontWeight:700 }}>{parts.join(' · ')}</span>
                  <span style={{ color:'#9fb0c6', marginLeft:8, fontSize:13 }}>payment phase{urgent !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <button onClick={()=>setShowDashboard(true)} style={{ background:'#e8a020', color:NAVY, border:'none', padding:'6px 14px', borderRadius:6, cursor:'pointer', fontWeight:700, fontSize:12, whiteSpace:'nowrap' }}>View</button>
            </div>
          )
        })()}


        <div className='form-grid-3' style={{ marginTop:14, display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12 }}>
          <div>
            <label style={{ color:'#9fb0c6' }}>Client</label>
            <input value={client} onChange={e=>setClient(e.target.value)} style={{ width:'100%', padding:8, marginTop:6 }} />
          </div>
          <div className='no-print'>
            <label style={{ color:'#9fb0c6' }}>Client Email <span style={{ color:'#556a80', fontWeight:400, fontSize:11 }}>— for auto emails</span></label>
            <input type='email' value={clientEmail} onChange={e=>setClientEmail(e.target.value)} placeholder='client@example.com'
              style={{ width:'100%', padding:8, marginTop:6, background:'#0a1e32', color:'#fff', border:'1px solid #223', borderRadius:4 }} />
          </div>
          <div>
            <label style={{ color:'#9fb0c6' }}>Address</label>
            <input value={address} onChange={e=>setAddress(e.target.value)} style={{ width:'100%', padding:8, marginTop:6 }} />
          </div>
          <div className='no-print'>
            <label style={{ color:'#9fb0c6' }}>Schedule Date</label>
            <input type='date' value={scheduleDate} onChange={e=>setScheduleDate(e.target.value)} style={{ width:'100%', padding:8, marginTop:6, background:'#0a1e32', color:'#fff', border:'1px solid #223', borderRadius:4 }} />
          </div>
        </div>

        <section className='no-print' style={{ marginTop:14, background:'#041827', padding:12, borderRadius:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
            <h4 style={{ color:GOLD, margin:0 }}>Client Photos</h4>
            {client.trim() ? (
              <label style={{ background:GOLD, color:NAVY, padding:'5px 12px', borderRadius:6, cursor:'pointer', fontSize:13, fontWeight:600 }}>
                {photoUploading ? 'Uploading…' : '+ Add Photos'}
                <input type='file' multiple accept='image/*' style={{ display:'none' }} disabled={photoUploading}
                  onChange={e => { Array.from(e.target.files).forEach(f => uploadPhoto(f)); e.target.value = '' }} />
              </label>
            ) : <span style={{ color:'#7f98b0', fontSize:12 }}>Enter a client name to manage photos</span>}
            {photoMessage ? <span style={{ color:GOLD, fontSize:12 }}>{photoMessage}</span> : null}
          </div>
          {photosLoading ? (
            <div style={{ color:'#9fb0c6', fontSize:13 }}>Loading…</div>
          ) : clientPhotos.length === 0 && client.trim() ? (
            <div style={{ color:'#7f98b0', fontSize:13 }}>No photos yet for this client.</div>
          ) : (
            <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
              {clientPhotos.map(photo => (
                <div key={photo.id} style={{ position:'relative' }}>
                  <img src={getPhotoUrl(photo.file_path || photo.storage_path)} alt={photo.file_name || 'photo'}
                    style={{ width:130, height:130, objectFit:'cover', borderRadius:6, border:'1px solid #1a3450', display:'block' }} />
                  <button onClick={()=>deletePhoto(photo)}
                    style={{ position:'absolute', top:4, right:4, background:'rgba(122,10,10,0.9)', color:'#fff', border:'none', borderRadius:4, padding:'2px 7px', cursor:'pointer', fontSize:12 }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={!showFixturesPrint ? 'no-print' : undefined} style={{ marginTop:14, background:'#041827', padding:12, borderRadius:8 }}>
          <div className='fixtures-row' style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
            <div><label style={{ color:'#9fb0c6' }}>{getUnitLabel(fixtureType)}</label><input type='number' value={houses} onChange={e=>setHouses(Number(e.target.value)||0)} style={{ width:80, marginLeft:6 }} /></div>
            <div><label style={{ color:'#9fb0c6' }}>Property Type</label><select value={fixtureType} onChange={e=>setFixtureType(e.target.value)} style={{ padding:8, marginLeft:6, borderRadius:4 }}><option>Residential</option><option>Multi-family</option><option>Commercial</option><option>Industrial</option></select></div>
            <div><label style={{ color:'#9fb0c6' }}>Project Type</label><select value={projectType} onChange={e=>setProjectType(e.target.value)} style={{ padding:8, marginLeft:6, borderRadius:4 }}><option>New Construction</option><option>Service/Replacement</option><option>Commercial</option><option>Industrial</option></select></div>
            <div><label style={{ color:'#9fb0c6' }}>Fixtures / {getUnitLabel(fixtureType).replace(/s$/, '')}</label><input type='number' value={fixturesPerHouse} onChange={e=>setFixturesPerHouse(Number(e.target.value)||0)} style={{ width:80, marginLeft:6 }} /></div>
            <div><label style={{ color:'#9fb0c6' }}>Price / Fixture</label><input type='text' value={formatMoneyInput(pricePerFixture)} onChange={e=>setPricePerFixture(parseMoneyInput(e.target.value))} style={{ width:100, marginLeft:6 }} /></div>
            <div style={{ marginLeft:'auto', textAlign:'right' }}><div style={{ color:'#9fb0c6' }}>Base</div><div style={{ color:GOLD, fontWeight:700 }}>{formatCurrency(base)}</div></div>
          </div>
          <div className='phase-boxes' style={{ marginTop:10, display:'flex', gap:10, flexWrap:'wrap' }}>
            {projectType === 'New Construction' ? (
              <>
                {phasePctSum !== 100 && (
                  <div className='no-print' style={{ width:'100%', padding:'6px 10px', background:'#3a2000', border:'1px solid #c9a84c', borderRadius:6, color:'#f5c94a', fontSize:13, marginBottom:4 }}>
                    Warning: phase percentages add up to {phasePctSum}% (should be 100%)
                  </div>
                )}
                <div className={!includeUnderground ? 'no-print' : undefined} style={{ padding:8, background:'#022026', borderRadius:6, flex:1, minWidth:200 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <input type='checkbox' checked={includeUnderground} onChange={e=>setIncludeUnderground(e.target.checked)} />
                    <input className='no-print' type='number' value={undergroundPct} onChange={e=>setUndergroundPct(Number(e.target.value)||0)} style={{ width:52, padding:'3px 5px', borderRadius:4, fontSize:13 }} />
                    <span style={{ color:'#9fb0c6' }}>% Underground</span>
                  </label>
                  <div><strong style={{ color:GOLD }}>{formatCurrency(phases.underground)}</strong></div>
                </div>
                <div className={!includeRough ? 'no-print' : undefined} style={{ padding:8, background:'#022026', borderRadius:6, flex:1, minWidth:200 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <input type='checkbox' checked={includeRough} onChange={e=>setIncludeRough(e.target.checked)} />
                    <input className='no-print' type='number' value={roughPct} onChange={e=>setRoughPct(Number(e.target.value)||0)} style={{ width:52, padding:'3px 5px', borderRadius:4, fontSize:13 }} />
                    <span style={{ color:'#9fb0c6' }}>% Rough-In</span>
                  </label>
                  <div><strong style={{ color:GOLD }}>{formatCurrency(phases.rough)}</strong></div>
                </div>
                <div className={!includeTrim ? 'no-print' : undefined} style={{ padding:8, background:'#022026', borderRadius:6, flex:1, minWidth:200 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <input type='checkbox' checked={includeTrim} onChange={e=>setIncludeTrim(e.target.checked)} />
                    <input className='no-print' type='number' value={trimPct} onChange={e=>setTrimPct(Number(e.target.value)||0)} style={{ width:52, padding:'3px 5px', borderRadius:4, fontSize:13 }} />
                    <span style={{ color:'#9fb0c6' }}>% Trim</span>
                  </label>
                  <div><strong style={{ color:GOLD }}>{formatCurrency(phases.trim)}</strong></div>
                </div>
              </>
            ) : (
              <>
                <div style={{ padding:8, background:'#022026', borderRadius:6, flex:1 }}>
                  <div style={{ marginBottom:6, color:'#9fb0c6' }}>Start %</div>
                  <input className='no-print' type='number' value={serviceStartPercent} onChange={e=>setServiceStartPercent(Number(e.target.value)||0)} style={{ width:80, padding:6, marginBottom:8, borderRadius:4 }} />
                  <div><strong style={{ color:GOLD }}>{formatCurrency(phases.start)}</strong></div>
                </div>
                <div style={{ padding:8, background:'#022026', borderRadius:6, flex:1 }}>
                  <div style={{ marginBottom:6, color:'#9fb0c6' }}>Completion %</div>
                  <input className='no-print' type='number' value={serviceCompletionPercent} onChange={e=>setServiceCompletionPercent(Number(e.target.value)||0)} style={{ width:80, padding:6, marginBottom:8, borderRadius:4 }} />
                  <div><strong style={{ color:GOLD }}>{formatCurrency(phases.completion)}</strong></div>
                </div>
              </>
            )}
          </div>
        </section>

        <section className={servicesTotal===0 ? 'no-print' : undefined} style={{ marginTop:14 }}>
          <h4 style={{ color:GOLD }}>Independent Services</h4>
          <div style={{ background:'#041827', padding:8, borderRadius:6, marginTop:8 }}>
            {SERVICE_GROUPS.map(group => {
              const entries = group.ids
                .map(id => { const i = services.findIndex(s => s.id === id); return i >= 0 ? { s: services[i], i } : null })
                .filter(Boolean)
              return (
                <React.Fragment key={group.label}>
                  <div className='no-print' style={{ padding:'5px 0 3px', color:GOLD, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', borderBottom:`1px solid ${GOLD}33`, marginTop:6 }}>
                    {group.label}
                  </div>
                  {entries.map(({ s, i }) => {
                    // Water Heater Replacement — Garage + Attic sub-rows
                    if (s.id === 'wh_replacement') {
                      const whTotal = s.enabled ? (s.garageQty||0)*(s.garageUnit||0)+(s.atticQty||0)*(s.atticUnit||0) : 0
                      return (
                        <div key={s.id} className='no-print' style={{ padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.02)' }}>
                          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                            <input type='checkbox' checked={s.enabled} onChange={e=>toggleService(i, e.target.checked)} />
                            <span style={{ flex:1 }}>{s.name}</span>
                            <div style={{ color:GOLD, minWidth:110, textAlign:'right' }}>{formatCurrency(whTotal)}</div>
                          </div>
                          {s.enabled && (
                            <div style={{ paddingLeft:24, marginTop:6, display:'flex', flexDirection:'column', gap:6 }}>
                              {[['Garage','garageQty','garageUnit'],['Attic','atticQty','atticUnit']].map(([label,qKey,uKey])=>(
                                <div key={label} style={{ display:'flex', gap:8, alignItems:'center' }}>
                                  <span style={{ color:'#9fb0c6', fontSize:12, width:52, flexShrink:0 }}>{label}</span>
                                  <input type='number' value={s[qKey]||0} onChange={e=>updateService(i,qKey,Number(e.target.value)||0)} style={{ width:70 }} placeholder='Qty' />
                                  <input type='text' value={formatMoneyInput(s[uKey]||0)} onChange={e=>updateService(i,uKey,parseMoneyInput(e.target.value))} style={{ width:100 }} placeholder='Price/unit' />
                                  <div style={{ color:GOLD, minWidth:90, textAlign:'right' }}>{formatCurrency((s[qKey]||0)*(s[uKey]||0))}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    }

                    // Standard row (with optional desc field for water_tap / sewer_tap)
                    const isTap = s.id === 'water_tap' || s.id === 'sewer_tap'
                    const tapPlaceholder = s.id === 'water_tap' ? 'Distance (e.g. 150 ft from meter)' : 'Depth (e.g. 8 ft deep)'
                    return (
                      <div key={s.id} className={!s.enabled || !(s.qty||0) ? 'no-print' : undefined} style={{ display:'flex', gap:8, alignItems:'center', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.02)', flexWrap: isTap ? 'wrap' : undefined }}>
                        <input className='no-print' type='checkbox' checked={s.enabled} onChange={e=>toggleService(i, e.target.checked)} />
                        <div style={{ flex:1, minWidth: isTap ? 160 : undefined }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                            <span>{s.name}</span>
                            {isNewConstruction && BASE_SERVICE_IDS.includes(s.id) ? (
                              <div className='no-print' style={{ display:'flex', gap:2 }}>
                                <button type='button' onClick={()=>updateService(i,'billingMode','pct')} style={{ padding:'2px 8px', fontSize:11, borderRadius:4, border:'none', background:(s.billingMode ?? 'pct')==='pct' ? GOLD : '#1a3450', color:(s.billingMode ?? 'pct')==='pct' ? NAVY : '#9fb0c6', cursor:'pointer' }}>% Based</button>
                                <button type='button' onClick={()=>updateService(i,'billingMode','ind')} style={{ padding:'2px 8px', fontSize:11, borderRadius:4, border:'none', background:s.billingMode==='ind' ? GOLD : '#1a3450', color:s.billingMode==='ind' ? NAVY : '#9fb0c6', cursor:'pointer' }}>Independent</button>
                              </div>
                            ) : null}
                            {isNewConstruction && BASE_SERVICE_IDS.includes(s.id) && (s.billingMode ?? 'pct') === 'pct' ? (
                              <span style={{ color:'#7f98b0', fontSize:11 }}>(in base)</span>
                            ) : null}
                          </div>
                          {isTap && s.enabled ? (
                            <input className='no-print' type='text' value={s.desc||''} onChange={e=>updateService(i,'desc',e.target.value)}
                              placeholder={tapPlaceholder}
                              style={{ marginTop:4, fontSize:12, padding:'3px 8px', borderRadius:4, background:'#0a1e32', color:'#fff', border:'1px solid #223', width:'100%', boxSizing:'border-box' }} />
                          ) : null}
                        </div>
                        <input className='no-print' type='number' value={s.qty} disabled={!s.enabled} onChange={e=>updateService(i,'qty',Number(e.target.value)||0)} style={{ width:80 }} />
                        <input className='no-print' type='text' value={formatMoneyInput(s.unit)} disabled={!s.enabled} onChange={e=>updateService(i,'unit',parseMoneyInput(e.target.value))} style={{ width:110 }} />
                        <div style={{ color:GOLD, minWidth:110, textAlign:'right' }}>{formatCurrency(s.enabled ? (s.qty||0)*s.unit : 0)}</div>
                      </div>
                    )
                  })}
                </React.Fragment>
              )
            })}
            <div style={{ textAlign:'right', marginTop:8, color:GOLD }}>Services total: {formatCurrency(servicesTotal)}</div>
          </div>
        </section>

        <section className={!addons.length ? 'no-print' : undefined} style={{ marginTop:14 }}>
          <h4 style={{ color:GOLD }}>Add-ons</h4>
          <AddOnRow onAdd={(desc,qty,unit)=>addAddon(desc,qty,unit)} />
          <div style={{ background:'#041827', padding:8, borderRadius:6, marginTop:8 }}>
            {addons.length===0 ? <div className='no-print' style={{ color:'#7f98b0' }}>No add-ons</div> : addons.map((a,i)=> (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.02)' }}>
                <div>{a.desc} x{a.qty}</div>
                <div style={{ color:GOLD }}>{formatCurrency(a.qty*a.unit)}</div>
                <div><button className='no-print' onClick={()=>removeAddon(i)} style={{ background:'transparent', border:'1px solid #233', color:'#fff', padding:4, borderRadius:4 }}>Remove</button></div>
              </div> 
            ))}
            <div className={addonsTotal===0 ? 'no-print' : undefined} style={{ textAlign:'right', marginTop:8, color:GOLD }}>Add-ons total: {formatCurrency(addonsTotal)}</div>
          </div>
        </section>

        <section className='form-grid-sidebar' style={{ marginTop:14, display:'grid', gridTemplateColumns:'1fr 320px', gap:12, alignItems:'start' }}>
          <div>
            <div className='no-print' style={{ display:'flex', gap:8, alignItems:'center' }}>
              <label style={{ color:'#9fb0c6' }}><input type='radio' checked={docType==='quote'} onChange={()=>setDocType('quote')} /> Quote</label>
              <label style={{ color:'#9fb0c6', marginLeft:8 }}><input type='radio' checked={docType==='invoice'} onChange={()=>setDocType('invoice')} /> Invoice</label>
              <button className='no-print' onClick={convertToInvoice} style={{ marginLeft:8, background:GOLD, color:NAVY, padding:8, borderRadius:6 }}>Convert to Invoice</button>
            </div>

            <div className={!notes ? 'no-print' : undefined} style={{ marginTop:12 }}>
              <div style={{ color:'#9fb0c6', marginBottom:6 }}>Notes</div>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder='Add project notes or scope details' style={{ width:'100%', minHeight:80, padding:8, borderRadius:6 }} />
            </div>
          </div>

          <div style={{ background:'#041827', padding:12, borderRadius:8 }}>
            <div className={!showFixturesPrint ? 'no-print' : undefined} style={{ display:'flex', justifyContent:'space-between' }}><div style={{ color:'#9fb0c6' }}>Base</div><div style={{ color:GOLD }}>{formatCurrency(base)}</div></div>
            <div className={!showFixturesPrint ? 'no-print' : undefined} style={{ display:'flex', justifyContent:'space-between' }}><div style={{ color:'#9fb0c6' }}>{getUnitLabel(fixtureType)}</div><div style={{ color:'#9fb0c6' }}>{houses}</div></div>
            <div className={!showFixturesPrint ? 'no-print' : undefined} style={{ display:'flex', justifyContent:'space-between' }}><div style={{ color:'#9fb0c6' }}>Fixtures / {getUnitLabel(fixtureType).replace(/s$/, '')}</div><div style={{ color:'#9fb0c6' }}>{fixturesPerHouse}</div></div>
            <div className={servicesTotal===0 ? 'no-print' : undefined} style={{ display:'flex', justifyContent:'space-between' }}><div style={{ color:'#9fb0c6' }}>Services</div><div style={{ color:GOLD }}>{formatCurrency(servicesTotal)}</div></div>
            <div className={addonsTotal===0 ? 'no-print' : undefined} style={{ display:'flex', justifyContent:'space-between' }}><div style={{ color:'#9fb0c6' }}>Add-ons</div><div style={{ color:GOLD }}>{formatCurrency(addonsTotal)}</div></div>
            <hr style={{ borderColor:'rgba(255,255,255,0.04)', margin:'8px 0' }} />
            <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700 }}><div>Total</div><div style={{ color:GOLD }}>{formatCurrency(displayTotal)}</div></div>

            <div className={(!showFixturesPrint || (projectType === 'New Construction' && !showNewConstructionSchedule)) ? 'no-print' : undefined} style={{ marginTop:10 }}>
              <div style={{ color:'#9fb0c6', marginBottom:6 }}>Payment Schedule</div>
              {projectType === 'New Construction' ? (
                <>
                  {includeUnderground ? <div style={{ display:'flex', justifyContent:'space-between' }}><div>{undergroundPct}% (Underground)</div><div style={{ color:GOLD }}>{formatCurrency(schedule.underground)}</div></div> : null}
                  {includeRough ? <div style={{ display:'flex', justifyContent:'space-between' }}><div>{roughPct}% (Rough-In)</div><div style={{ color:GOLD }}>{formatCurrency(schedule.rough)}</div></div> : null}
                  {includeTrim ? <div style={{ display:'flex', justifyContent:'space-between' }}><div>{trimPct}% (Trim)</div><div style={{ color:GOLD }}>{formatCurrency(schedule.trim)}</div></div> : null}
                </>
              ) : (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between' }}><div>{serviceStartPercent}% (Start)</div><div style={{ color:GOLD }}>{formatCurrency(schedule.start)}</div></div>
                  <div style={{ display:'flex', justifyContent:'space-between' }}><div>{serviceCompletionPercent}% (Completion)</div><div style={{ color:GOLD }}>{formatCurrency(schedule.completion)}</div></div>
                </>
              )}
            </div>

            <div className='no-print' style={{ marginTop:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ color:'#9fb0c6' }}>Status: <strong style={{ color:GOLD }}>{status}</strong></div>
            </div>
          </div>
        </section>


        <section className='no-print' style={{ marginTop:14 }}>
          <h4 style={{ color:GOLD }}>Document History</h4>
          <div style={{ background:'#041827', padding:8, borderRadius:6 }}>
            {history.length===0 ? <div style={{ color:'#7f98b0' }}>No history</div> : history.map((h,i)=> (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.02)' }}>
                <div style={{ color:'#9fb0c6' }}>{h.entry}</div>
                <div style={{ color:'#7f98b0' }}>{new Date(h.ts).toLocaleString()}</div>
              </div>
            ))}
            <div className='no-print' style={{ marginTop:8, display:'flex', gap:8 }}>
              <button onClick={()=>setDocStatus('sent')} style={{ background:'#0f2740', color:'#fff', border:`1px solid ${GOLD}`, padding:8, borderRadius:6 }}>Mark Sent</button>
              <button onClick={()=>setDocStatus('approved')} style={{ background:'#0f2740', color:'#fff', border:`1px solid ${GOLD}`, padding:8, borderRadius:6 }}>Mark Approved</button>
              <button onClick={markDocumentPaid} style={{ background:'#0f2740', color:'#fff', border:`1px solid ${GOLD}`, padding:8, borderRadius:6 }}>Mark Paid</button>
            </div> 
          </div>
        </section>

        <section className='no-print' style={{ marginTop:14 }}>
          <h4 style={{ color:GOLD }}>Saved Documents</h4>
          <div style={{ background:'#041827', borderRadius:6, overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign:'left', padding:'10px', color:'#c9a84c' }}>ID</th>
                  <th style={{ textAlign:'left', padding:'10px', color:'#c9a84c' }}>Document</th>
                  <th style={{ textAlign:'left', padding:'10px', color:'#c9a84c' }}>Client</th>
                  <th style={{ textAlign:'left', padding:'10px', color:'#c9a84c' }}>Contractor</th>
                  <th style={{ textAlign:'left', padding:'10px', color:'#c9a84c' }}>Type</th>
                  <th style={{ textAlign:'left', padding:'10px', color:'#c9a84c' }}>Total</th>
                  <th style={{ textAlign:'left', padding:'10px', color:'#c9a84c' }}>Created</th>
                  <th style={{ padding:'10px', color:'#c9a84c' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {savedDocs.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding:'12px', color:'#7f98b0' }}>No saved documents found</td></tr>
                ) : savedDocs.map(doc => (
                  <tr key={doc.id} style={{ borderTop:'1px solid rgba(255,255,255,0.08)' }}>
                    <td style={{ padding:'10px', color:'#fff' }}>{doc.id}</td>
                    <td style={{ padding:'10px', color:'#fff' }}>{doc.doc_number || ''}</td>
                    <td style={{ padding:'10px', color:'#fff' }}>{doc.client || '—'}</td>
                    <td style={{ padding:'10px', color:'#fff' }}>{doc.contractor || '—'}</td>
                    <td style={{ padding:'10px', color:'#fff' }}>{doc.doc_type || 'quote'}</td>
                    <td style={{ padding:'10px', color:GOLD, textAlign:'right' }}>{doc.total != null ? formatCurrency(doc.total) : '-'}</td>
                    <td style={{ padding:'10px', color:'#7f98b0' }}>{doc.created_at ? new Date(doc.created_at).toLocaleString() : '—'}</td>
                    <td style={{ padding:'10px', display:'flex', gap:8 }}>
                      <button type='button' onClick={() => openDocument(doc)} style={{ background:'#0f2740', color:'#fff', border:`1px solid ${GOLD}`, padding:'6px 10px', borderRadius:6 }}>Open</button>
                      {isAdmin && <button type='button' onClick={() => deleteDocument(doc.id)} style={{ background:'#7a0a0a', color:'#fff', border:`1px solid ${GOLD}`, padding:'6px 10px', borderRadius:6 }}>Delete</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {savedDocId ? (
          <section className='no-print' style={{ marginTop:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <h4 style={{ color:GOLD, margin:0 }}>Mileage Log</h4>
              <button type='button' onClick={() => setShowTripLog(s => !s)} style={{ background:'#0f2740', color:GOLD, border:`1px solid ${GOLD}`, padding:'4px 12px', borderRadius:6 }}>
                {showTripLog ? 'Hide' : 'Log Trip'}
              </button>
            </div>
            {showTripLog && (
              <div style={{ background:'#041827', borderRadius:8, padding:14 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 90px', gap:8, marginBottom:8 }}>
                  <input value={tripOrigin} onChange={e=>setTripOrigin(e.target.value)} placeholder='Origin' style={{ padding:8, borderRadius:6, background:'#071827', color:'#fff', border:'1px solid #334' }} />
                  <input value={tripDest} onChange={e=>setTripDest(e.target.value)} placeholder='Destination' style={{ padding:8, borderRadius:6, background:'#071827', color:'#fff', border:'1px solid #334' }} />
                  <input value={tripMiles} onChange={e=>setTripMiles(e.target.value)} type='number' min='0' step='0.1' placeholder='Miles' style={{ padding:8, borderRadius:6, background:'#071827', color:'#fff', border:'1px solid #334', width:'100%' }} />
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ color:'#7f98b0', fontSize:12 }}>Purpose: <span style={{ color:'#fff' }}>{client || '(client name)'}</span></div>
                  <button type='button' onClick={logTrip} disabled={tripSaving} style={{ background:GOLD, color:NAVY, padding:'6px 18px', borderRadius:6, fontWeight:700 }}>
                    {tripSaving ? 'Saving…' : 'Add Trip'}
                  </button>
                </div>
                {tripMsg && <div style={{ color:GOLD, fontSize:12, marginTop:6 }}>{tripMsg}</div>}
                {tripsLoading ? (
                  <div style={{ color:'#7f98b0', marginTop:10 }}>Loading…</div>
                ) : trips.length > 0 && (
                  <table style={{ width:'100%', borderCollapse:'collapse', marginTop:14 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign:'left', padding:'6px 8px', color:GOLD, fontSize:11, fontWeight:700 }}>Date</th>
                        <th style={{ textAlign:'left', padding:'6px 8px', color:GOLD, fontSize:11, fontWeight:700 }}>Origin</th>
                        <th style={{ textAlign:'left', padding:'6px 8px', color:GOLD, fontSize:11, fontWeight:700 }}>Destination</th>
                        <th style={{ textAlign:'right', padding:'6px 8px', color:GOLD, fontSize:11, fontWeight:700 }}>Miles</th>
                        <th style={{ textAlign:'left', padding:'6px 8px', color:GOLD, fontSize:11, fontWeight:700 }}>Purpose</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {trips.map(t => (
                        <tr key={t.id} style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding:'6px 8px', color:'#9fb0c6', fontSize:12 }}>{t.trip_date}</td>
                          <td style={{ padding:'6px 8px', color:'#fff', fontSize:12 }}>{t.origin}</td>
                          <td style={{ padding:'6px 8px', color:'#fff', fontSize:12 }}>{t.destination}</td>
                          <td style={{ padding:'6px 8px', color:GOLD, textAlign:'right', fontSize:12 }}>{Number(t.miles||0).toFixed(1)}</td>
                          <td style={{ padding:'6px 8px', color:'#9fb0c6', fontSize:12 }}>{t.purpose}</td>
                          <td style={{ padding:'6px 8px' }}>
                            <button type='button' onClick={() => deleteTrip(t.id)} style={{ background:'#7a0a0a', color:'#fff', border:'none', padding:'2px 8px', borderRadius:4, fontSize:11, cursor:'pointer' }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop:`2px solid ${GOLD}44` }}>
                        <td colSpan={3} style={{ padding:'6px 8px', color:'#9fb0c6', fontSize:12, fontWeight:700 }}>Total</td>
                        <td style={{ padding:'6px 8px', color:GOLD, textAlign:'right', fontSize:12, fontWeight:700 }}>
                          {trips.reduce((s,t)=>s+(Number(t.miles)||0),0).toFixed(1)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            )}
          </section>
        ) : null}

        {showDashboard ? (
          <div className='no-print'>
            <DashboardPanel docs={savedDocs} alerts={paymentAlerts} onMarkPaid={markPhasePaid} onClose={()=>setShowDashboard(false)} user={user} accountId={accountId} />
          </div>
        ) : null}

        {showSchedule ? (
          <div className='no-print'>
            <ScheduleCalendar docs={allScheduledDocs} onClose={()=>setShowSchedule(false)} />
          </div>
        ) : null}

        {showClients ? (
          <div className='no-print'>
            <ClientsPanel docs={savedDocs} onOpen={doc=>{ openDocument(doc); setShowClients(false) }} onClose={()=>setShowClients(false)} />
          </div>
        ) : null}

        {showHelp ? (
          <div className='no-print'>
            <HelpPanel onClose={()=>setShowHelp(false)} />
          </div>
        ) : null}

        <footer className='no-print' style={{ marginTop:16, borderTop:`1px solid ${GOLD}`, paddingTop:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ color:'#9fb0c6' }}>Payment due upon receipt</div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={newNumber} style={{ background:'#0f2740', color:'#fff', border:`1px solid ${GOLD}`, padding:8, borderRadius:6 }}>New Number</button>
            <button onClick={printDoc} style={{ background:GOLD, color:NAVY, padding:8, borderRadius:6 }}>Print / PDF</button>
          </div>
        </footer>
        <div className='no-print' style={{ marginTop:10, textAlign:'center', color:'#3a4f63', fontSize:11, display:'flex', justifyContent:'center', alignItems:'center', gap:14, flexWrap:'wrap' }}>
          <span>© 2026 {profileCompany || 'MVP Solutions'}. All rights reserved.</span>
          <a href='/terms' style={{ color:'#5a7a96', textDecoration:'none', borderBottom:'1px solid #334' }}>Terms of Service</a>
          <a href='/privacy' style={{ color:'#5a7a96', textDecoration:'none', borderBottom:'1px solid #334' }}>Privacy Policy</a>
        </div>
        </div>

        <div className='print-only'>
          <div className='print-document'>
            <div style={{backgroundColor:'#0a1628',padding:'24px 40px',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0'}}>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <img src={logoUrl || '/logo.svg'} alt={logoUrl ? profileCompany || 'Logo' : 'FieldQuote'} style={{height:56,width:'auto',maxWidth:180,objectFit:'contain'}} />
                <div style={{color:'#c9a84c',fontSize:'15px',fontWeight:'700',letterSpacing:'1.5px'}}>{contractor}</div>
              </div>
              <div style={{textAlign:'right'}}><div style={{color:'rgba(255,255,255,0.7)',fontSize:'11px',letterSpacing:'3px'}}>{docType==='quote'?'QUOTE':'INVOICE'}</div><div style={{color:'white',fontSize:'28px',fontWeight:'bold'}}>{docNumber}</div></div>
            </div>
            <div className='print-header-divider' />

            <div className='print-client'>
              <div className='print-section-title'>Client Information</div>
              <div><strong>Client:</strong> {client || '____________________'}</div>
              {address ? <div><strong>Address:</strong> {address}</div> : null}
            </div>

            {showFixturesPrint ? (
              <div className='print-section'>
                <div className='print-section-title'>Fixtures</div>
                <table className='print-table'>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th colSpan={2} style={{ textAlign:'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{houses} {getUnitLabel(fixtureType).toLowerCase().replace(/s$/, '(s)')} × {fixturesPerHouse} fixture(s) × {formatCurrency(pricePerFixture)}</td>
                      <td colSpan={2} style={{ textAlign:'right' }}>{formatCurrency(houses * fixturesPerHouse * pricePerFixture)}</td>
                    </tr>
                    {isNewConstruction && services.filter(s=>BASE_SERVICE_IDS.includes(s.id) && s.enabled && s.qty>0 && (s.billingMode ?? 'pct') === 'pct').map(s => (
                      <tr key={s.id}>
                        <td style={{ color:'#7f98b0' }}>{s.name}</td>
                        <td colSpan={2} style={{ textAlign:'right', color:'#7f98b0' }}>{formatCurrency((s.qty||0)*s.unit)}</td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight:700, borderTop:'2px solid #e8e8e8' }}>
                      <td>Base Total</td>
                      <td colSpan={2} style={{ textAlign:'right' }}>{formatCurrency(base)}</td>
                    </tr>
                  </tbody>
                </table>
                {projectType === 'New Construction' && showNewConstructionSchedule ? (
                  <table className='print-table' style={{ marginTop: 12 }}>
                    <thead>
                      <tr>
                        <th>Phase</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {includeUnderground ? (
                        <tr>
                          <td>{undergroundPct}% Underground</td>
                          <td>{formatCurrency(phases.underground)}</td>
                        </tr>
                      ) : null}
                      {includeRough ? (
                        <tr>
                          <td>{roughPct}% Rough-In</td>
                          <td>{formatCurrency(phases.rough)}</td>
                        </tr>
                      ) : null}
                      {includeTrim ? (
                        <tr>
                          <td>{trimPct}% Trim</td>
                          <td>{formatCurrency(phases.trim)}</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                ) : null}
                {projectType !== 'New Construction' ? (
                  <table className='print-table' style={{ marginTop: 12 }}>
                    <thead>
                      <tr>
                        <th>Payment Schedule</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{serviceStartPercent}% Start</td>
                        <td>{formatCurrency(phases.start)}</td>
                      </tr>
                      <tr>
                        <td>{serviceCompletionPercent}% Completion</td>
                        <td>{formatCurrency(phases.completion)}</td>
                      </tr>
                    </tbody>
                  </table>
                ) : null}
                {showPrintNote ? (
                  <div className='print-note'>
                    <div>
                      {docType === 'quote' ? (
                        <>
                          <strong>NOTE:</strong> This quote represents the total plumbing contract for {printAddress}. Payment schedule: {paymentScheduleList.map((p, idx) => (
                            <span key={p.name}>{idx > 0 && idx === paymentScheduleList.length - 1 ? ' and ' : idx > 0 ? ', ' : ''}{p.name} ({p.pct}% - {formatCurrency(p.amount)})</span>
                          ))}. Work will begin upon acceptance of this quote.
                        </>
                      ) : (
                        <>
                          <strong>NOTE:</strong> This invoice represents the {selectedPhaseLabel} phase payment ({selectedPhaseNames.length === 1 ? (selectedPhaseNames[0].includes('Underground') ? 30 : selectedPhaseNames[0].includes('Rough') ? 50 : 20) : Math.round(selectedPhaseAmount/base*100)}%) of the plumbing contract at {printAddress}. Total contract: {formatCurrency(base)}. Amount due this invoice: {formatCurrency(selectedPhaseAmount)}. Remaining balance after this payment: {formatCurrency(base - selectedPhaseAmount)}. Work will not commence on the next phase until this payment is received.
                        </>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {printServices.length > 0 ? (
              <div className='print-section'>
                <div className='print-section-title'>Independent Services</div>
                <table className='print-table'>
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printServices.map(s=> (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td>{s.qty}</td>
                        <td>{formatCurrency(s.unit)}</td>
                        <td>{formatCurrency(s.qty*s.unit)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} style={{ textAlign:'right' }}>Services total</td>
                      <td>{formatCurrency(servicesTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : null}

            <div className='print-total-box'>
              <div className='print-total-row'>
                <span>Total</span>
                <strong>{formatCurrency(displayTotal)}</strong>
              </div>
            </div>

            {signatureData && (
              <div className='print-section' style={{ pageBreakInside:'avoid', marginTop:24 }}>
                <div className='print-section-title'>Client Signature</div>
                <img src={signatureData} alt='Client signature'
                  style={{ height:80, maxWidth:'100%', display:'block', background:'#fff', border:'1px solid #e8e8e8', borderRadius:4, padding:6, marginBottom:8 }} />
                <div style={{ fontSize:14, fontWeight:700, color:'#0a1628' }}>{signerName}</div>
                <div style={{ fontSize:11, color:'#7f98b0', marginTop:2 }}>
                  Signed electronically · {new Date(signedAt).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}
                </div>
              </div>
            )}

            <div className='print-footer'>
              <div>Payment due upon receipt</div>
              <div>{contractor}</div>
              <div style={{ fontSize:10, opacity:0.45, marginTop:6, letterSpacing:'0.5px' }}>Generated with FieldQuote</div>
              <div style={{ fontSize:10, opacity:0.55, marginTop:4, letterSpacing:'0.3px' }}>© 2026 {profileCompany || 'MVP Solutions'}. All rights reserved.</div>
            </div>

            {includePhotos && clientPhotos.length > 0 ? (
              <div className='print-section' style={{ marginTop:24 }}>
                <div className='print-section-title'>Work Photos</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10 }}>
                  {clientPhotos.map(photo => (
                    <img key={photo.id} src={getPhotoUrl(photo.file_path || photo.storage_path)} alt={photo.file_name || 'photo'}
                      style={{ width:'100%', aspectRatio:'4/3', objectFit:'cover', borderRadius:4 }} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

      </div>

      {/* Quick Estimate FAB — mobile only, hidden when modal is open */}
      {!showQuickEstimate && (
        <button className='qe-fab no-print' onClick={() => setShowQuickEstimate(true)}>
          ⚡ Quick Estimate
        </button>
      )}

      {/* Quick Estimate overlay */}
      {showQuickEstimate && (
        <QuickEstimateModal
          onClose={() => setShowQuickEstimate(false)}
          onSaved={handleQuickSaved}
          contractorNames={contractorNames}
          defaultContractor={defaultContractor}
          user={user}
          accountId={accountId}
          counter={counter}
        />
      )}
    </div>
  )
}

function QEStepper({ value, onChange, min = 0 }) {
  const btnStyle = { width: 36, height: 36, borderRadius: 8, border: '1px solid #2a3f58', background: '#0a1628', color: '#fff', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0 }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button type='button' style={btnStyle} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: 16, color: '#e2e8f0' }}>{value}</span>
      <button type='button' style={btnStyle} onClick={() => onChange(value + 1)}>+</button>
    </div>
  )
}

function QuickEstimateModal({ onClose, onSaved, contractorNames, defaultContractor, user, accountId, counter }) {
  const [qContractor, setQContractor] = useState(defaultContractor || (contractorNames[0] || ''))
  const [qClient, setQClient] = useState('')
  const [qEmail, setQEmail] = useState('')
  const [qAddress, setQAddress] = useState('')
  const [qProjectType, setQProjectType] = useState('New Construction')
  const [qHouses, setQHouses] = useState(1)
  const [qFixtures, setQFixtures] = useState(3)
  const [qPrice, setQPrice] = useState(5200)
  const [qNotes, setQNotes] = useState('')
  const [qSvc, setQSvc] = useState(() => mergeServices(null))
  const [saving, setSaving] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const isNC = qProjectType === 'New Construction'

  const qTotal = useMemo(() => {
    const whAmt = (s) => s.id === 'wh_replacement' ? (s.garageQty || 0) * (s.garageUnit || 0) + (s.atticQty || 0) * (s.atticUnit || 0) : 0
    if (isNC) {
      const base = qHouses * qFixtures * qPrice
      const extra = qSvc.reduce((sum, s) => {
        if (!s.enabled) return sum
        if (s.id === 'wh_replacement') return sum + whAmt(s)
        if (BASE_SERVICE_IDS.includes(s.id)) return sum
        return sum + (s.qty || 0) * (s.unit || 0)
      }, 0)
      return base + extra
    }
    return qSvc.reduce((sum, s) => {
      if (!s.enabled) return sum
      if (s.id === 'wh_replacement') return sum + whAmt(s)
      return sum + (s.qty || 0) * (s.unit || 0)
    }, 0)
  }, [isNC, qHouses, qFixtures, qPrice, qSvc])

  function toggleSvc(id) {
    setQSvc(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled, qty: s.qty || 1 } : s))
  }
  function updateSvc(id, field, value) {
    setQSvc(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  async function handleSave() {
    if (!qClient.trim()) { setErrMsg('Client name is required'); return }
    setSaving(true)
    setErrMsg('')
    const docNumber = `QE-${counter.raw}`
    const mergedSvcs = mergeServices(null).map(s => {
      const q = qSvc.find(x => x.id === s.id)
      return q ? { ...s, enabled: q.enabled, qty: q.qty, unit: q.unit, desc: q.desc || '' } : s
    })
    const payload = {
      contractor: qContractor,
      show_logo: false,
      doc_type: 'quote',
      client: qClient,
      client_email: qEmail || null,
      address: qAddress,
      houses: isNC ? qHouses : 0,
      fixtures_per_house: isNC ? qFixtures : 0,
      price_per_fixture: isNC ? qPrice : 0,
      fixture_type: '',
      project_type: qProjectType,
      include_underground: false,
      include_rough: false,
      include_trim: false,
      service_start_percent: 50,
      service_completion_percent: 50,
      underground_pct: 0,
      rough_pct: 0,
      trim_pct: 0,
      services: mergedSvcs,
      addons: [],
      notes: qNotes,
      history: [{ ts: new Date().toISOString(), entry: 'created:quick_estimate', status: 'quote', docNumber }],
      status: 'quote',
      total: qTotal,
      user_id: accountId || user.id,
      created_by: user.id,
      doc_number: docNumber,
      raw_counter: counter.raw,
      scheduled_date: null,
      signature_token: null,
      signature_data: null,
      signed_at: null,
      signer_name: null,
    }
    try {
      const { data, error } = await supabase.from('documents').insert([payload]).select('*').single()
      if (error) { setErrMsg(`Save failed: ${error.message}`); setSaving(false); return }
      onSaved(data)
    } catch (e) {
      setErrMsg(`Save failed: ${e.message}`)
      setSaving(false)
    }
  }

  const inputStyle = { width: '100%', background: '#0d1f30', color: '#fff', border: '1px solid #2a3f58', borderRadius: 8, padding: '10px 12px', fontSize: 15, boxSizing: 'border-box' }
  const labelStyle = { color: '#7f98b0', fontSize: 12, display: 'block', marginBottom: 4 }
  const QE_GROUPS = SERVICE_GROUPS

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: NAVY, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, background: '#071827', borderBottom: `2px solid ${GOLD}`, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: GOLD, fontWeight: 700, fontSize: 17 }}>⚡ Quick Estimate</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#7f98b0', fontSize: 24, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>✕</button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 140px' }}>

        {contractorNames.length > 1 && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Contractor</label>
            <select value={qContractor} onChange={e => setQContractor(e.target.value)} style={inputStyle}>
              {contractorNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Client Name *</label>
          <input value={qClient} onChange={e => setQClient(e.target.value)} placeholder='Client name' style={inputStyle} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Client Email (optional)</label>
          <input type='email' value={qEmail} onChange={e => setQEmail(e.target.value)} placeholder='client@email.com' style={inputStyle} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Address</label>
          <input value={qAddress} onChange={e => setQAddress(e.target.value)} placeholder='Job site address' style={inputStyle} />
        </div>

        {/* Project type toggle */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Project Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['New Construction', 'Existing - Service'].map(pt => (
              <button key={pt} type='button' onClick={() => setQProjectType(pt)} style={{
                flex: 1, padding: '10px 6px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: qProjectType === pt ? GOLD : '#0d1f30',
                color: qProjectType === pt ? NAVY : '#9fb0c6',
                border: qProjectType === pt ? `1px solid ${GOLD}` : '1px solid #2a3f58',
              }}>{pt}</button>
            ))}
          </div>
        </div>

        {/* New Construction fixture pricing */}
        {isNC && (
          <div style={{ background: '#071827', borderRadius: 10, padding: 14, marginBottom: 16, border: '1px solid #1a3148' }}>
            <div style={{ color: GOLD, fontWeight: 700, fontSize: 13, marginBottom: 14 }}>Fixtures &amp; Pricing</div>
            {[
              { label: 'Houses', value: qHouses, set: setQHouses, min: 1 },
              { label: 'Fixtures / House', value: qFixtures, set: setQFixtures, min: 1 },
            ].map(({ label, value, set, min }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ color: '#9fb0c6', fontSize: 14 }}>{label}</span>
                <QEStepper value={value} onChange={set} min={min} />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#9fb0c6', fontSize: 14 }}>Price / Fixture</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: '#7f98b0' }}>$</span>
                <input type='number' value={qPrice} onChange={e => setQPrice(Number(e.target.value))}
                  style={{ width: 90, background: '#0a1628', color: '#fff', border: '1px solid #2a3f58', borderRadius: 8, padding: '8px 10px', fontSize: 15, textAlign: 'right' }} />
              </div>
            </div>
            <div style={{ marginTop: 12, padding: '8px 0', borderTop: '1px solid #1a3148', color: '#556a80', fontSize: 12 }}>
              Base: {qHouses} houses × {qFixtures} fixtures × ${qPrice.toLocaleString()} = <span style={{ color: GOLD, fontWeight: 700 }}>{formatCurrency(qHouses * qFixtures * qPrice)}</span>
            </div>
          </div>
        )}

        {/* Services */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ ...labelStyle, marginBottom: 10 }}>Services</label>
          {QE_GROUPS.map(group => {
            const groupSvcs = group.ids.map(id => qSvc.find(s => s.id === id)).filter(Boolean)
            return (
              <div key={group.label} style={{ marginBottom: 14 }}>
                <div style={{ color: '#556a80', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700, marginBottom: 6 }}>{group.label}</div>
                {groupSvcs.map(s => {
                  const isTap = s.id === 'water_tap' || s.id === 'sewer_tap'
                  const isWHR = s.id === 'wh_replacement'
                  const whrTotal = isWHR ? (s.garageQty || 0) * (s.garageUnit || 0) + (s.atticQty || 0) * (s.atticUnit || 0) : 0
                  return (
                    <div key={s.id} style={{ marginBottom: 6 }}>
                      <div onClick={() => toggleSvc(s.id)} style={{
                        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                        background: s.enabled ? '#0d2035' : '#071827',
                        border: s.enabled ? `1px solid ${GOLD}` : '1px solid #1a3148',
                        borderRadius: s.enabled ? '8px 8px 0 0' : 8,
                        padding: '10px 12px',
                      }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                          background: s.enabled ? GOLD : 'transparent',
                          border: s.enabled ? `2px solid ${GOLD}` : '2px solid #2a3f58',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {s.enabled && <span style={{ color: NAVY, fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                        </div>
                        <span style={{ color: s.enabled ? '#e2e8f0' : '#9fb0c6', fontSize: 14, flex: 1 }}>{s.name}</span>
                        {s.enabled && (
                          <span style={{ color: GOLD, fontSize: 13, fontWeight: 600 }}>
                            {isWHR ? formatCurrency(whrTotal) : isTap ? '' : formatCurrency((s.qty || 0) * (s.unit || 0))}
                          </span>
                        )}
                      </div>
                      {s.enabled && (
                        <div onClick={e => e.stopPropagation()} style={{
                          background: '#041827', border: `1px solid ${GOLD}`, borderTop: 'none',
                          borderRadius: '0 0 8px 8px', padding: '10px 12px',
                        }}>
                          {isWHR ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {[['Garage', 'garageQty', 'garageUnit'], ['Attic', 'atticQty', 'atticUnit']].map(([label, qKey, uKey]) => (
                                <div key={label}>
                                  <div style={{ color: '#556a80', fontSize: 11, fontWeight: 700, marginBottom: 5 }}>{label}</div>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ color: '#556a80', fontSize: 11, marginBottom: 3 }}>Qty</div>
                                      <input type='number' value={s[qKey] || 0} onChange={e => updateSvc(s.id, qKey, Number(e.target.value))}
                                        style={{ ...inputStyle, fontSize: 14 }} />
                                    </div>
                                    <div style={{ flex: 2 }}>
                                      <div style={{ color: '#556a80', fontSize: 11, marginBottom: 3 }}>Unit Price ($)</div>
                                      <input type='number' value={s[uKey] || 0} onChange={e => updateSvc(s.id, uKey, Number(e.target.value))}
                                        style={{ ...inputStyle, fontSize: 14 }} />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                                      <span style={{ color: GOLD, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{formatCurrency((s[qKey] || 0) * (s[uKey] || 0))}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : isTap ? (
                            <input value={s.desc || ''} onChange={e => updateSvc(s.id, 'desc', e.target.value)}
                              placeholder={s.id === 'sewer_tap' ? 'Depth (e.g. 8 ft deep)' : 'Distance (e.g. 150 ft from meter)'}
                              style={{ ...inputStyle, fontSize: 14 }} />
                          ) : (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ color: '#556a80', fontSize: 11, marginBottom: 3 }}>Qty</div>
                                <input type='number' value={s.qty || 0} onChange={e => updateSvc(s.id, 'qty', Number(e.target.value))}
                                  style={{ ...inputStyle, fontSize: 14 }} />
                              </div>
                              <div style={{ flex: 2 }}>
                                <div style={{ color: '#556a80', fontSize: 11, marginBottom: 3 }}>Unit Price ($)</div>
                                <input type='number' value={s.unit || 0} onChange={e => updateSvc(s.id, 'unit', Number(e.target.value))}
                                  style={{ ...inputStyle, fontSize: 14 }} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Notes (optional)</label>
          <textarea value={qNotes} onChange={e => setQNotes(e.target.value)} rows={3} placeholder='Scope of work, special notes…'
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
        </div>

        {errMsg && (
          <div style={{ color: '#ff6b6b', fontSize: 14, marginBottom: 12, background: '#1a0a0a', borderRadius: 8, padding: '10px 14px', border: '1px solid #5c1a1a' }}>{errMsg}</div>
        )}
      </div>

      {/* Sticky footer */}
      <div style={{ flexShrink: 0, background: '#071827', borderTop: `2px solid ${GOLD}`, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#7f98b0', fontSize: 12 }}>Estimate Total</div>
          <div style={{ color: GOLD, fontSize: 22, fontWeight: 700 }}>{formatCurrency(qTotal)}</div>
        </div>
        <button onClick={handleSave} disabled={saving} style={{
          background: saving ? '#7a6228' : GOLD, color: NAVY, border: 'none',
          borderRadius: 10, padding: '13px 28px', fontWeight: 700, fontSize: 16,
          cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
        }}>
          {saving ? 'Saving…' : 'Save Quote'}
        </button>
      </div>
    </div>
  )
}

function PaymentThankYouPage() {
  return (
    <div style={{ minHeight:'100vh', background:'#0a1628', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'sans-serif' }}>
      <div style={{ textAlign:'center', maxWidth:440 }}>
        <div style={{ fontSize:56, marginBottom:16, color:'#4caf50' }}>✓</div>
        <h1 style={{ color:'#4caf50', fontSize:26, marginBottom:10, fontWeight:700 }}>Payment Received!</h1>
        <p style={{ color:'#9fb0c6', fontSize:16, lineHeight:1.6, margin:0 }}>
          Thank you for your payment. Your contractor will be notified and your invoice has been marked as paid.
        </p>
        <p style={{ color:'#556a80', fontSize:12, marginTop:20 }}>Powered by FieldQuote &amp; Stripe</p>
      </div>
    </div>
  )
}

function SignaturePage({ token }) {
  const { useRef, useState, useEffect } = React
  const canvasRef = useRef(null)
  const isDrawing = useRef(false)
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [name, setName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [doneMsg, setDoneMsg] = useState('')

  useEffect(() => {
    supabase.functions.invoke('get-signature-doc', { body: { token } })
      .then(({ data, error }) => {
        if (error || !data || data.error) {
          setFetchError(error?.message || data?.error || 'Document not found')
        } else {
          setDoc(data)
          if (data.signed_at) {
            setDoneMsg(`This document was already signed by ${data.signer_name || 'the client'} on ${new Date(data.signed_at).toLocaleDateString()}.`)
            setDone(true)
          }
        }
        setLoading(false)
      })
  }, [token])

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if (e.touches) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function onStart(e) {
    e.preventDefault()
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d'), pos = getPos(e, c)
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y)
    isDrawing.current = true; setIsEmpty(false)
  }

  function onMove(e) {
    e.preventDefault()
    if (!isDrawing.current) return
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d'), pos = getPos(e, c)
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0a1628'
    ctx.lineTo(pos.x, pos.y); ctx.stroke()
  }

  function onEnd() { isDrawing.current = false }

  function clearCanvas() {
    const c = canvasRef.current; if (!c) return
    c.getContext('2d').clearRect(0, 0, c.width, c.height)
    setIsEmpty(true)
  }

  async function submit() {
    if (isEmpty) { alert('Please draw your signature first'); return }
    if (!name.trim()) { alert('Please enter your full name'); return }
    if (!agreed) { alert('Please check the agreement box to continue'); return }
    const signatureData = canvasRef.current.toDataURL('image/png')
    setSubmitting(true)
    const { data, error } = await supabase.functions.invoke('submit-signature', {
      body: { token, signerName: name.trim(), signatureData }
    })
    if (error || data?.error) {
      alert('Error submitting signature: ' + (error?.message || data?.error))
      setSubmitting(false)
      return
    }
    setDoneMsg('Your signature has been submitted. The contractor will receive your signed copy.')
    setDone(true)
    setSubmitting(false)
  }

  const wrap = { minHeight:'100vh', background:'#f4f6f9', color:'#0a1628', fontFamily:'system-ui,-apple-system,sans-serif' }
  const center = { ...wrap, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }

  if (loading) return <div style={center}><div style={{ color:'#666' }}>Loading document…</div></div>

  if (fetchError) return (
    <div style={center}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🔗</div>
        <div style={{ fontWeight:700, color:'#c00', marginBottom:6 }}>Link not found</div>
        <div style={{ color:'#888', fontSize:14 }}>{fetchError}</div>
      </div>
    </div>
  )

  if (done) return (
    <div style={center}>
      <div style={{ textAlign:'center', maxWidth:380 }}>
        <div style={{ fontSize:60, marginBottom:16 }}>✅</div>
        <h2 style={{ margin:'0 0 10px', color:'#0a1628' }}>Document Signed!</h2>
        <p style={{ color:'#555', lineHeight:1.6, margin:0 }}>{doneMsg}</p>
        <p style={{ color:'#aaa', fontSize:13, marginTop:14 }}>Secured by FieldQuote</p>
      </div>
    </div>
  )

  const canSign = !isEmpty && name.trim() && agreed

  return (
    <div style={wrap}>
      {/* Header */}
      <div style={{ background:'#0a1628', padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <img src={doc?.logo_url || '/logo.svg'} alt={doc?.logo_url ? doc.contractor || 'Logo' : 'FieldQuote'} style={{ height:34, maxWidth:120, objectFit:'contain' }} />
        <div style={{ color:'#c9a84c', fontWeight:700, fontSize:14 }}>{doc.contractor}</div>
      </div>

      <div style={{ maxWidth:500, margin:'0 auto', padding:20 }}>

        {/* Document summary card */}
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, boxShadow:'0 2px 10px rgba(0,0,0,0.08)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
            <div>
              <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'0.12em', color:'#999', marginBottom:4 }}>{doc.doc_type === 'invoice' ? 'Invoice' : 'Quote'}</div>
              <div style={{ fontWeight:800, fontSize:22, color:'#0a1628' }}>{doc.doc_number}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:11, color:'#999', marginBottom:4 }}>Total</div>
              <div style={{ fontWeight:800, fontSize:26, color:'#c9a84c' }}>{formatCurrency(doc.total)}</div>
            </div>
          </div>
          {doc.client ? <div style={{ marginBottom:4, fontSize:14 }}><span style={{ color:'#888' }}>Client: </span><strong>{doc.client}</strong></div> : null}
          {doc.address ? <div style={{ marginBottom:4, fontSize:14 }}><span style={{ color:'#888' }}>Address: </span>{doc.address}</div> : null}
          {doc.created_at ? <div style={{ color:'#bbb', fontSize:12, marginTop:8 }}>Issued {new Date(doc.created_at).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}</div> : null}
        </div>

        {/* Agreement notice */}
        <div style={{ background:'#fffbea', border:'1px solid #e8d080', borderRadius:8, padding:14, marginBottom:16, fontSize:13, color:'#4b3f2d', lineHeight:1.6 }}>
          <strong>Agreement:</strong> By signing below, you authorize <strong>{doc.contractor}</strong> to proceed with the work described in {doc.doc_type} <strong>{doc.doc_number}</strong> for the total amount of <strong>{formatCurrency(doc.total)}</strong>.
        </div>

        {/* Full name */}
        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', marginBottom:6, fontWeight:600, fontSize:14, color:'#0a1628' }}>Your Full Name *</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder='Type your legal name'
            style={{ width:'100%', padding:12, borderRadius:8, border:'1.5px solid #d0d5dd', fontSize:16, boxSizing:'border-box', background:'#fff', color:'#0a1628' }} />
        </div>

        {/* Signature canvas */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <label style={{ fontWeight:600, fontSize:14, color:'#0a1628' }}>Draw Your Signature *</label>
            {!isEmpty && <button onClick={clearCanvas} style={{ background:'none', border:'none', color:'#e05252', cursor:'pointer', fontSize:13, padding:0, fontWeight:600 }}>Clear</button>}
          </div>
          <canvas ref={canvasRef} width={460} height={160}
            onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
            onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
            style={{ width:'100%', height:160, border:'1.5px solid #d0d5dd', borderRadius:8, background:'#fff', cursor:'crosshair', touchAction:'none', display:'block' }} />
          {isEmpty && <div style={{ textAlign:'center', color:'#bbb', fontSize:12, marginTop:6 }}>Sign with your finger or mouse</div>}
        </div>

        {/* Agree checkbox */}
        <label style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:20, cursor:'pointer' }}>
          <input type='checkbox' checked={agreed} onChange={e=>setAgreed(e.target.checked)} style={{ marginTop:3, width:18, height:18, flexShrink:0, cursor:'pointer' }} />
          <span style={{ fontSize:13, color:'#555', lineHeight:1.6 }}>I agree to the terms above and understand this electronic signature is legally binding.</span>
        </label>

        {/* Submit */}
        <button onClick={submit} disabled={submitting || !canSign}
          style={{ width:'100%', padding:16, borderRadius:10, background: canSign && !submitting ? '#0a1628' : '#ccc', color:'#fff', border:'none', fontWeight:700, fontSize:16, cursor: canSign && !submitting ? 'pointer' : 'not-allowed', transition:'background 0.15s' }}>
          {submitting ? 'Submitting…' : 'Submit Signature'}
        </button>

        <div style={{ textAlign:'center', marginTop:14, color:'#bbb', fontSize:11 }}>Secured by FieldQuote · Electronic Signature</div>
      </div>
    </div>
  )
}

function DashboardPanel({ docs, alerts, onMarkPaid, onClose, user, accountId }) {
  const now = new Date()
  const yr = now.getFullYear()
  const mo = now.getMonth()

  const [allTrips, setAllTrips] = useState([])
  const [mileYear, setMileYear] = useState(yr)

  useEffect(() => {
    if (!user || !accountId) return
    supabase.from('mileage_trips').select('*').eq('account_id', user.id).order('trip_date', { ascending: true })
      .then(({ data }) => setAllTrips(data || []))
  }, [user, accountId])

  const yearTrips = allTrips.filter(t => t.trip_date && t.trip_date.startsWith(String(mileYear)))
  const yearTotal = yearTrips.reduce((s, t) => s + (Number(t.miles) || 0), 0)
  const mileByMonth = {}
  yearTrips.forEach(t => {
    const key = t.trip_date.slice(0, 7)
    mileByMonth[key] = (mileByMonth[key] || 0) + (Number(t.miles) || 0)
  })
  const mileMonths = Object.keys(mileByMonth).sort()
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  function exportMileagePdf() {
    const win = window.open('', '_blank')
    if (!win) return
    const RATE = 0.70
    const rows = yearTrips.map(t => `
      <tr>
        <td>${t.trip_date}</td>
        <td>${t.origin || ''}</td>
        <td>${t.destination || ''}</td>
        <td style="text-align:right">${Number(t.miles||0).toFixed(1)}</td>
        <td>${t.purpose || ''}</td>
        <td style="text-align:right">$${(Number(t.miles||0)*RATE).toFixed(2)}</td>
      </tr>`).join('')
    win.document.write(`<!DOCTYPE html><html><head><title>Mileage Log ${mileYear}</title><style>
      body{font-family:Arial,sans-serif;padding:32px;color:#111;}
      h1{font-size:22px;margin-bottom:4px;}
      .meta{color:#555;font-size:13px;margin-bottom:24px;}
      table{width:100%;border-collapse:collapse;font-size:13px;}
      th{background:#0a1628;color:#fff;padding:8px 10px;text-align:left;}
      th:nth-child(4),th:nth-child(6){text-align:right;}
      td{padding:7px 10px;border-bottom:1px solid #e0e0e0;}
      tr:nth-child(even) td{background:#f9f9f9;}
      tfoot td{font-weight:bold;background:#f0f0f0;}
      .footer{margin-top:24px;font-size:11px;color:#888;}
    </style></head><body>
      <h1>Mileage Log — ${mileYear}</h1>
      <div class="meta">IRS Standard Rate: $${RATE}/mile &nbsp;|&nbsp; Total Miles: ${yearTotal.toFixed(1)} &nbsp;|&nbsp; Est. Deduction: $${(yearTotal*RATE).toFixed(2)}</div>
      <table>
        <thead><tr><th>Date</th><th>Origin</th><th>Destination</th><th>Miles</th><th>Purpose</th><th>Deduction</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="3">Total</td><td style="text-align:right">${yearTotal.toFixed(1)}</td><td></td><td style="text-align:right">$${(yearTotal*RATE).toFixed(2)}</td></tr></tfoot>
      </table>
      <div class="footer">Generated by FieldQuote &nbsp;|&nbsp; For IRS Schedule C / Form 2106 use</div>
    </body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 400)
  }

  const isThisMonth = d => { const x = new Date(d); return x.getFullYear() === yr && x.getMonth() === mo }

  const thisMonth = docs.filter(d => d.created_at && isThisMonth(d.created_at))
  const quotesThisMonth   = thisMonth.filter(d => d.doc_type !== 'invoice').length
  const invoicesThisMonth = thisMonth.filter(d => d.doc_type === 'invoice').length
  const billedThisMonth   = thisMonth.reduce((s, d) => s + (Number(d.total) || 0), 0)
  const paidThisMonth     = thisMonth.filter(d => d.status === 'paid').reduce((s, d) => s + (Number(d.total) || 0), 0)
  const totalPending      = docs.filter(d => d.status !== 'paid').reduce((s, d) => s + (Number(d.total) || 0), 0)

  // Build last-6-months buckets
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(yr, mo - (5 - i), 1)
    return { label: d.toLocaleString('default', { month: 'short' }), yr: d.getFullYear(), mo: d.getMonth(), billed: 0, paid: 0 }
  })
  docs.forEach(doc => {
    if (!doc.created_at) return
    const d = new Date(doc.created_at)
    const bucket = months.find(m => m.yr === d.getFullYear() && m.mo === d.getMonth())
    if (!bucket) return
    bucket.billed += Number(doc.total) || 0
    if (doc.status === 'paid') bucket.paid += Number(doc.total) || 0
  })
  const maxVal = Math.max(...months.map(m => m.billed), 1)
  const BAR_H = 110

  const statCards = [
    { label: 'Quotes This Month',   value: quotesThisMonth,   isCount: true,  accent: GOLD },
    { label: 'Invoices This Month', value: invoicesThisMonth, isCount: true,  accent: GOLD },
    { label: 'Billed This Month',   value: billedThisMonth,   isCount: false, accent: GOLD },
    { label: 'Paid This Month',     value: paidThisMonth,     isCount: false, accent: '#4caf50' },
    { label: 'Total Pending',       value: totalPending,      isCount: false, accent: '#e8a020' },
  ]

  return (
    <div style={{ marginTop:20, background:'#041827', borderRadius:10, padding:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h4 style={{ color:GOLD, margin:0 }}>Dashboard</h4>
        <button onClick={onClose} style={{ background:'transparent', color:'#9fb0c6', border:'1px solid #334', padding:'4px 10px', borderRadius:6, cursor:'pointer' }}>✕ Close</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:10, marginBottom:20 }}>
        {statCards.map(card => (
          <div key={card.label} style={{ background:'#071827', borderRadius:8, padding:'14px 16px', borderTop:`3px solid ${card.accent}` }}>
            <div style={{ color:'#7f98b0', fontSize:11, marginBottom:8, textTransform:'uppercase', letterSpacing:'0.5px', lineHeight:1.3 }}>{card.label}</div>
            <div style={{ color:card.accent, fontWeight:700, fontSize:24 }}>
              {card.isCount ? card.value : formatCurrency(card.value)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ background:'#071827', borderRadius:8, padding:'16px 16px 12px' }}>
        <div style={{ color:'#7f98b0', fontSize:11, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:14 }}>Income — Last 6 Months</div>
        <div style={{ position:'relative', height: BAR_H + 30 }}>
          {[0.25, 0.5, 0.75, 1].map(p => (
            <div key={p} style={{ position:'absolute', left:0, right:0, bottom: 24 + p * BAR_H, borderTop:'1px solid rgba(255,255,255,0.05)', zIndex:0 }}>
              <span style={{ position:'absolute', right:'100%', paddingRight:6, fontSize:10, color:'rgba(255,255,255,0.2)', transform:'translateY(-50%)', whiteSpace:'nowrap' }}>
                {formatCurrency(maxVal * p)}
              </span>
            </div>
          ))}
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'flex-end', gap:6, paddingBottom:24, zIndex:1 }}>
            {months.map(m => (
              <div key={`${m.yr}-${m.mo}`} style={{ flex:1, height:'100%', display:'flex', flexDirection:'column', justifyContent:'flex-end', alignItems:'stretch', gap:2 }}>
                <div style={{ display:'flex', gap:2, alignItems:'flex-end', height: BAR_H }}>
                  <div title={`Billed: ${formatCurrency(m.billed)}`}
                    style={{ flex:1, background:GOLD, borderRadius:'3px 3px 0 0',
                      height: m.billed > 0 ? `${Math.max(3, Math.round(m.billed / maxVal * BAR_H))}px` : 0,
                      transition:'height 0.4s ease', opacity:0.9 }} />
                  <div title={`Paid: ${formatCurrency(m.paid)}`}
                    style={{ flex:1, background:'#4caf50', borderRadius:'3px 3px 0 0',
                      height: m.paid > 0 ? `${Math.max(3, Math.round(m.paid / maxVal * BAR_H))}px` : 0,
                      transition:'height 0.4s ease', opacity:0.9 }} />
                </div>
                <div style={{ textAlign:'center', color:'#9fb0c6', fontSize:11, paddingTop:4 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', gap:16, marginTop:4 }}>
          <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#9fb0c6' }}>
            <div style={{ width:10, height:10, background:GOLD, borderRadius:2 }} /> Billed
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#9fb0c6' }}>
            <div style={{ width:10, height:10, background:'#4caf50', borderRadius:2 }} /> Paid
          </div>
        </div>
      </div>

      <div style={{ background:'#071827', borderRadius:8, padding:'16px', marginTop:14 }}>
        <div style={{ color:'#7f98b0', fontSize:11, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:12 }}>Upcoming Payments</div>
        {alerts.length === 0 ? (
          <div style={{ color:'#7f98b0', fontSize:13 }}>No upcoming or overdue payment phases.</div>
        ) : alerts.map((a, idx) => {
          const isOverdue  = a.daysUntil < 0
          const isToday    = a.daysUntil === 0
          const accent     = isOverdue ? '#e05252' : isToday ? '#e8a020' : GOLD
          const badge      = isOverdue ? `${Math.abs(a.daysUntil)}d overdue` : isToday ? 'Due today' : `In ${a.daysUntil}d`
          const badgeBg    = isOverdue ? '#3d0a0a' : isToday ? '#2a1800' : '#1a1a00'
          return (
            <div key={`${a.doc.id}-${a.phaseKey}-${idx}`} style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ flex:'1 1 180px' }}>
                <div style={{ fontWeight:700, color:'#fff', fontSize:14 }}>{a.doc.client || '(no client)'}</div>
                <div style={{ color:'#9fb0c6', fontSize:12, marginTop:2 }}>{a.doc.doc_number} · {a.phaseLabel}</div>
              </div>
              <div style={{ textAlign:'right', flex:'0 0 auto' }}>
                <div style={{ color:accent, fontWeight:700, fontSize:16 }}>{formatCurrency(a.amount)}</div>
                <div style={{ color:'#7f98b0', fontSize:11, marginTop:1 }}>{a.doc.scheduled_date}</div>
              </div>
              <div style={{ background:badgeBg, color:accent, border:`1px solid ${accent}`, borderRadius:10, padding:'2px 10px', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>{badge}</div>
              <button onClick={()=>onMarkPaid(a.doc, a.phaseKey)} style={{ background:'#0f2740', color:'#4caf50', border:'1px solid #4caf50', padding:'4px 12px', borderRadius:6, fontSize:12, cursor:'pointer', whiteSpace:'nowrap' }}>
                Mark Paid
              </button>
            </div>
          )
        })}
      </div>

      <div style={{ background:'#071827', borderRadius:8, padding:'16px', marginTop:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div style={{ color:'#7f98b0', fontSize:11, textTransform:'uppercase', letterSpacing:'0.5px' }}>Mileage Tracking</div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <select value={mileYear} onChange={e=>setMileYear(Number(e.target.value))} style={{ background:'#0f2740', color:'#fff', border:'1px solid #334', padding:'4px 8px', borderRadius:6, fontSize:12 }}>
              {[yr-1, yr, yr+1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={exportMileagePdf} disabled={yearTrips.length === 0} style={{ background:GOLD, color:NAVY, padding:'4px 14px', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer' }}>
              Export PDF
            </button>
          </div>
        </div>
        {mileMonths.length === 0 ? (
          <div style={{ color:'#7f98b0', fontSize:13 }}>No trips logged for {mileYear}.</div>
        ) : (
          <>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, marginBottom:10 }}>
              <thead>
                <tr>
                  <th style={{ textAlign:'left', padding:'6px 8px', color:GOLD, fontWeight:700, fontSize:11 }}>Month</th>
                  <th style={{ textAlign:'right', padding:'6px 8px', color:GOLD, fontWeight:700, fontSize:11 }}>Miles</th>
                  <th style={{ textAlign:'right', padding:'6px 8px', color:GOLD, fontWeight:700, fontSize:11 }}>Est. Deduction</th>
                </tr>
              </thead>
              <tbody>
                {mileMonths.map(key => {
                  const [y, m] = key.split('-')
                  const label = `${MONTH_NAMES[parseInt(m,10)-1]} ${y}`
                  const miles = mileByMonth[key]
                  return (
                    <tr key={key} style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding:'6px 8px', color:'#fff' }}>{label}</td>
                      <td style={{ padding:'6px 8px', color:GOLD, textAlign:'right' }}>{miles.toFixed(1)}</td>
                      <td style={{ padding:'6px 8px', color:'#4caf50', textAlign:'right' }}>${(miles*0.70).toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop:`2px solid ${GOLD}44` }}>
                  <td style={{ padding:'6px 8px', color:'#9fb0c6', fontWeight:700 }}>Total {mileYear}</td>
                  <td style={{ padding:'6px 8px', color:GOLD, textAlign:'right', fontWeight:700 }}>{yearTotal.toFixed(1)}</td>
                  <td style={{ padding:'6px 8px', color:'#4caf50', textAlign:'right', fontWeight:700 }}>${(yearTotal*0.70).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
            <div style={{ color:'#7f98b0', fontSize:11 }}>IRS standard rate: $0.70/mile &nbsp;·&nbsp; For Schedule C / Form 2106</div>
          </>
        )}
      </div>
    </div>
  )
}

function HelpPanel({ onClose }) {
  const [openSections, setOpenSections] = useState(new Set())
  function toggle(i) {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const TIP_STYLE = { background:'#041020', border:`1px solid ${GOLD}55`, borderRadius:6, padding:'8px 12px', marginBottom:12, fontSize:12, color:GOLD, lineHeight:1.65 }
  const STEP_HEAD = { color:GOLD, fontWeight:700 }

  const sections = [
    {
      title: 'Complete Workflow — First Job to Paid Invoice',
      icon: '🗺️',
      desc: 'New to FieldQuote? Follow these 9 steps in order — from on-site estimate to paid invoice. Every job follows this same path.',
      tip: 'All 9 steps are covered individually in the sections below. Come back here any time to see the big picture.',
      steps: [
        <><span style={STEP_HEAD}>1 — Quick Estimate (on-site)</span>{' '}Open FieldQuote on your phone and tap the ⚡ Quick Estimate button in the bottom-right corner. Enter client name, address, project type, and any services. Tap Save Quote. Done in under 2 minutes — the estimate loads into the main form automatically.</>,
        <><span style={STEP_HEAD}>2 — Build the Full Quote</span>{' '}Back in the office, refine the estimate: add the client's email, adjust fixture counts and pricing, toggle services between % Based and Independent, and add extra charges in Add-ons.</>,
        <><span style={STEP_HEAD}>3 — Save the Document</span>{' '}Click Save Document in the toolbar. The quote gets a QT-### number and is stored in the cloud. Use Print / PDF to generate a shareable PDF.</>,
        <><span style={STEP_HEAD}>4 — Request Client Signature</span>{' '}Click Signature in the toolbar. Copy the unique link and text it to your client. They open it on their phone, review the quote, and sign with their finger. Once signed the button turns green and the signature appears on the PDF.</>,
        <><span style={STEP_HEAD}>5 — Convert to Invoice</span>{' '}When a phase is due, click Convert to Invoice. A new INV-### number is assigned. For New Construction, check only the phases being billed (e.g. Rough-In). The total updates automatically.</>,
        <><span style={STEP_HEAD}>6 — Send Payment Link</span>{' '}Click $ Pay Link in the toolbar. A secure Stripe checkout page is created for the invoice total. Copy the link and text it to your client. When they pay, the invoice is automatically marked Paid and they get a receipt email.</>,
        <><span style={STEP_HEAD}>7 — Send Email</span>{' '}Click Send Email in the toolbar. A branded email goes directly to the client's inbox with an invoice summary and an embedded Pay Now button — no email app needed on your end.</>,
        <><span style={STEP_HEAD}>8 — Log the Trip</span>{' '}Scroll below the saved document and click Log Trip. Enter origin, destination, and miles. All trips are saved for IRS mileage tracking and annual export.</>,
        <><span style={STEP_HEAD}>9 — Upload Job Photos</span>{' '}Scroll to the Client Photos section and click + Add Photos. Before/after photos are tied to the client name and load on every document for that client. Check Photos in the toolbar to include them in the printed PDF.</>,
      ]
    },
    {
      title: 'Quick Estimate — Mobile Mode',
      icon: '⚡',
      desc: 'Create a basic quote in under 2 minutes from your phone while standing in front of the client.',
      tip: 'Quick Estimate saves directly to your account. Open it in the main form afterward to add more detail — signature, payment link, or email.',
      steps: [
        'On your phone, open FieldQuote and tap the ⚡ Quick Estimate button (bottom-right corner of the screen).',
        'On desktop or tablet, click ⚡ Quick Estimate in the main toolbar.',
        'Enter the client\'s name (required), email address, and job site address.',
        'Choose the Project Type: New Construction or Existing - Service.',
        'For New Construction: tap the + and − buttons to set Houses and Fixtures per House, then enter the Price per Fixture. The base total appears live in the footer as you type.',
        'For Existing - Service: tap any service row to enable it, then enter Qty and Unit Price.',
        'Water Heater Replacement expands into separate Garage and Attic rows — each with its own qty and unit price.',
        'Sewer Tap and Water Meter Tap show a description field (e.g. depth or distance) instead of qty/price.',
        'Add any scope notes in the Notes field at the bottom.',
        'Tap Save Quote — the estimate is saved instantly and loaded into the main form. The counter advances automatically.',
      ]
    },
    {
      title: 'Building a Full Quote',
      icon: '📋',
      desc: 'Build a detailed professional quote with client info, project type, fixture pricing, services, and add-ons.',
      steps: [
        'Click your contractor name in the toolbar to assign it to this document.',
        'Enter the Client name, Client Email (for automated emails), and job Address.',
        'Optionally set a Schedule Date — the job will appear on the calendar view.',
        'Choose the Project Type: New Construction or Existing - Service.',
        'For New Construction: set Houses, Fixtures per House, and Price per Fixture. The base total calculates automatically.',
        'Scroll to Independent Services. Enable any services that apply and set billing mode (see Services section below).',
        'Use the Add-ons section for permit fees, extra materials, travel charges, or anything not in the standard list.',
        'Enter job-specific Notes — they appear on the printed quote and in client emails.',
        'Click Save Document. The quote gets a QT-### number and is saved to the cloud.',
        'Click Print / PDF to preview or download the quote as a PDF.',
      ]
    },
    {
      title: 'Services — % Based vs Independent',
      icon: '⚙️',
      desc: 'For New Construction jobs, base services can be billed two different ways. Understanding this keeps your phase invoices accurate.',
      tip: '% Based is the most common choice. Use Independent when a service is a separate contract item that you bill regardless of phase.',
      steps: [
        'Services are organized into five groups: Sewer, Water, Gas, Others, and Remodeling / Fixtures.',
        '% Based: the service amount is added into the base total and split across your phase schedule (e.g. 30% Underground / 50% Rough-In / 20% Trim). It shows as "in base" on the invoice.',
        'Independent: the service is billed as its own line item outside the phase split — you collect the full amount on whatever invoice you include it on.',
        'Base services with the % / Independent toggle: Water Line Meter, Water Heater, Tankless WH, Recirculation Pump, Manablok, Gas System Indoor.',
        'Always-Independent services (no toggle): Sewer, Storm Drain, Grease Trap, Sewer Tap, Water Meter Tap, Gas Riser, Underground Gas Line, Temp Gas, Water Heater Replacement, Repiping, Cut & Bust, and all Remodeling / Fixtures items.',
        'Water Heater Replacement has Garage and Attic sub-rows — enter qty and unit price for each location separately.',
        'Sewer Tap and Water Meter Tap show a description field — enter depth or distance instead of a quantity.',
        'Enable a service by checking its checkbox. The amount is added to the document total immediately.',
        'Add-ons handle anything that doesn\'t fit the standard list — permits, materials, travel, inspections.',
      ]
    },
    {
      title: 'Request Client Signature',
      icon: '✍️',
      desc: 'Get a digital signature on any quote — your client signs from their phone in seconds. No account or app required on their end.',
      tip: 'The signature link works on any device. Once signed, the quote is locked — the signature appears on every printed PDF.',
      steps: [
        'Build and save the quote first — the Signature button requires a saved document.',
        'Click Signature in the toolbar. A unique one-time link is generated for this document.',
        'Click Copy Link and paste it into a text message or email to your client.',
        'The client opens the link on any device. They see a summary of the quote with your company name and total.',
        'The client types their full name and draws their signature with a finger (mobile) or mouse (desktop), then taps Submit.',
        'Once signed, the Signature button in your toolbar turns green with a ✓ checkmark.',
        'The signer\'s name, signature image, and date automatically appear at the bottom of every printed or PDF version of this document.',
        'Click the Signature button again at any time to preview the saved signature or copy the link again.',
        'The signature is permanently tied to this document — it cannot be altered or removed.',
      ]
    },
    {
      title: 'Convert Quote to Invoice',
      icon: '🔄',
      desc: 'Turn an accepted quote into a phase invoice — Underground, Rough-In, or Trim — with the exact amount due for that phase.',
      steps: [
        'Open the saved quote from the Saved Documents table at the bottom of the page.',
        'Click Convert to Invoice in the toolbar. The document becomes an Invoice with a new INV-### number.',
        'For New Construction, phase checkboxes appear — check only the phases being billed on this invoice (e.g. Rough-In only).',
        'The invoice total automatically updates to show only the selected phase amount plus any Independent services.',
        'You can convert the same original quote into multiple invoices over time — one invoice per phase.',
        'Update the Schedule Date to reflect the payment due date if needed.',
        'Save the document — the invoice is stored as a separate record from the original quote.',
        'Deliver the invoice via Print / PDF, Send Email, or Send Payment Link.',
      ]
    },
    {
      title: 'Send Payment Link',
      icon: '💳',
      desc: 'Generate a secure Stripe checkout link so clients can pay online — when they pay, the invoice is automatically marked Paid.',
      tip: 'Payment links expire after 24 hours. If the client hasn\'t paid yet, click $ Pay Link again to generate a fresh link.',
      steps: [
        'Open a saved Invoice document ($ Pay Link is only available on invoices, not quotes).',
        'Click $ Pay Link in the toolbar. FieldQuote contacts Stripe and creates a checkout page for the exact invoice amount.',
        'A panel appears with the payment link. Click Copy Link.',
        'Paste the link into a text message or email and send it to your client.',
        'The client opens the link on any device and pays securely with a credit or debit card. No account required on their end.',
        'Once payment is complete, Stripe notifies FieldQuote automatically.',
        'The invoice status changes to Paid and a green badge appears in your Saved Documents table — no manual action needed.',
        'Your client receives an automatic payment confirmation email (if their email was entered on the document).',
        'Payment links expire after 24 hours. Click $ Pay Link again to generate a new one if needed.',
      ]
    },
    {
      title: 'Send Email to Client',
      icon: '📧',
      desc: 'Send a professional branded FieldQuote email directly to your client — invoice summary, job details, and a Pay Now button included.',
      tip: 'Enter the client\'s email on the document before saving to unlock automatic emails when converting to invoice or marking Paid.',
      steps: [
        'Make sure the client\'s email address is entered in the Client Email field on the document, then save.',
        'Click Send Email in the toolbar.',
        'If a client email is on file, a professional HTML email is sent directly to the client — no email app opens on your end.',
        'Quote emails include: your company name, the quote total, job address, payment schedule, and any notes.',
        'Invoice emails include all of the above plus a large gold Pay Now button that links directly to the Stripe payment page.',
        'The payment link is embedded in the email automatically — no extra steps needed.',
        'If no client email is on file, clicking Send Email opens your device\'s default email app with the details pre-filled.',
        'Automatic emails: when a Quote is converted to Invoice (with email on file), an invoice email is sent automatically.',
        'Automatic emails: when an invoice is marked Paid (via Stripe or manually), a payment receipt confirmation is sent automatically.',
      ]
    },
    {
      title: 'Mileage Tracking & IRS Export',
      icon: '🚗',
      desc: 'Log every job-site trip and export a complete annual mileage report formatted for IRS Schedule C / Form 2106.',
      tip: 'The IRS standard mileage rate is $0.70/mile for 2025. The PDF export calculates your total deduction automatically.',
      steps: [
        'Save a document first — the Mileage Log section appears below the document after saving.',
        'Click Log Trip to expand the entry form.',
        'Enter the Origin (e.g. your shop or home address), Destination (the job site), and Miles for the trip.',
        'The Purpose is automatically set to the client name — edit it if needed.',
        'Click Add Trip — the trip is saved instantly and appears in the log table below.',
        'Log as many trips per document as needed — each is timestamped and tracked separately.',
        'Click ✕ on any row to permanently delete that trip.',
        'To see all trips across every job at once, open the Dashboard and scroll to the Mileage Tracking section.',
        'Use the year selector to switch between tax years.',
        'Click Export PDF to generate a printable report with the IRS standard rate, total miles, and total estimated deduction.',
        'The exported report lists every trip for the year and is formatted for IRS Schedule C or Form 2106 use.',
      ]
    },
    {
      title: 'Job Photos',
      icon: '📷',
      desc: 'Upload before/after job site photos. Photos are tied to the client name and appear on every document for that client.',
      steps: [
        'Enter a client name in the Client field — the Client Photos section appears below the main form.',
        'Click + Add Photos to select one or more images from your device (JPG, PNG, and HEIC supported).',
        'Photos upload to secure cloud storage and appear as thumbnails in the Client Photos section.',
        'Photos are linked to the client name — they automatically appear on any FieldQuote document with the same client.',
        'On mobile, you can take a new photo with your camera and upload it directly.',
        'To delete a photo, click the ✕ button on its thumbnail. Deletion is permanent.',
        'To include photos in the printed PDF, check the Photos toggle in the toolbar before printing.',
        'Photos appear in a Work Photos section at the end of the printed document.',
      ]
    },
    {
      title: 'Using Add-ons',
      icon: '➕',
      desc: 'Add custom line items not in the standard services list — permits, extra materials, travel charges, or anything else.',
      steps: [
        'Scroll to the Add-ons section, located below Independent Services.',
        'Enter a description (e.g. "City Permit Fee", "Extra PEX material", "After-hours charge").',
        'Set the Quantity and Unit Price.',
        'Click Add — the item appears as a line item on the document and is included in the total.',
        'Add-ons appear as their own section on the printed PDF.',
        'Add-ons are not split across phase invoices — they appear on whichever document they\'re added to.',
        'Click Remove next to any add-on to delete it from the document.',
      ]
    },
    {
      title: 'Schedule & Calendar',
      icon: '📅',
      desc: 'Assign start dates to jobs and view all upcoming work on a monthly calendar.',
      steps: [
        'Enter a date in the Schedule Date field at the top of the form (next to Client and Address).',
        'Save the document — the date is stored with the job.',
        'Click Schedule in the toolbar to open the monthly calendar view.',
        'Documents with scheduled dates appear as colored blocks — gold for quotes, blue for invoices.',
        'Click any calendar day to see all jobs scheduled for that date, with client name, document number, and total.',
        'Click any job in the calendar popup to open it directly in the form.',
        'An alert banner appears at the top of the app when phase payments are overdue or due within 7 days.',
      ]
    },
    {
      title: 'Clients CRM',
      icon: '👤',
      desc: 'A built-in client list automatically assembled from your saved documents — no manual data entry.',
      steps: [
        'Click Clients in the toolbar.',
        'Each row shows a unique client with their total quote count, invoice count, total billed, and total paid.',
        'Clients are sorted by total billed — your highest-value clients appear first.',
        'Click any client row to see their complete document history.',
        'Click Open on any document to load it into the main form.',
        'Click ← All Clients to return to the list.',
        'Client records are built automatically from your saved documents — the list updates every time you save a new document.',
      ]
    },
    {
      title: 'Dashboard & Analytics',
      icon: '📊',
      desc: 'Business overview at a glance — monthly revenue, 6-month income chart, payment alerts, and mileage summary.',
      steps: [
        'Click Dashboard in the toolbar.',
        'The stat cards show this month\'s quote count, invoice count, total billed, total paid, and total pending.',
        'The bar chart shows billed (gold) vs paid (green) income for the last 6 months. Hover any bar for the exact dollar amount.',
        'Upcoming Payments lists all overdue and future phase payments across every active job.',
        'Red = overdue. Amber = due today. Gold = upcoming.',
        'Click Mark Paid next to any phase when payment is received — this is recorded in the document history.',
        'A red banner also appears at the top of the main app whenever any phase is overdue or due within 7 days.',
        'Scroll down to the Mileage Tracking section to see all logged trips, filter by year, and export your IRS report.',
      ]
    },
    {
      title: 'Settings — Profile & Logo',
      icon: '🏢',
      desc: 'Set your company name, contractor names, and company logo. These appear on all client-facing documents and emails.',
      steps: [
        'Click Settings in the toolbar.',
        'Under Company Profile, enter your company name and up to three contractor names.',
        'Contractor Name 1 is required — it is the default in the toolbar.',
        'Names 2 and 3 are optional (for other plumbers on your team).',
        'Click Save Changes — your contractor buttons update immediately.',
        'Under Company Logo, click Upload Logo to select an image (PNG, JPG, or SVG, max 2 MB).',
        'Your logo replaces the FieldQuote logo on all printed PDFs and the client signature page.',
        'The FieldQuote logo in the app header is app branding and is not affected by your upload.',
        'Click Change Logo to swap it, or Remove to revert to the FieldQuote default.',
      ]
    },
    {
      title: 'Billing — Trial & Subscription',
      icon: '💰',
      desc: 'FieldQuote includes a free trial with full access. Subscribe to keep full access once your trial ends.',
      steps: [
        'Your free trial starts the moment you sign up — no credit card required.',
        'The trial banner at the top of the app shows how many days remain.',
        'Click Settings → Billing to see your current plan status.',
        'When the trial ends, click Subscribe — $29/month — to go to the Stripe checkout.',
        'After subscribing, an Active badge appears and the trial banner disappears.',
        'To update your payment method, download receipts, or cancel, click Manage Billing inside Settings.',
        'Only the account Owner can view and manage billing — Team Members do not have access to billing settings.',
        'Every team member you invite gets full app access through your subscription at no extra charge.',
      ]
    },
    {
      title: 'Team Members & Roles',
      icon: '👥',
      desc: 'Invite your crew to FieldQuote. Every invited team member gets full app access through your subscription — no extra cost, no separate sign-up fee.',
      tip: 'There are only two roles: Owner and Team Member. The Owner is whoever created the FieldQuote account.',
      steps: [
        'OWNER — Full access: create, edit, and delete documents; manage billing and subscription; invite and remove team members; change company settings; access all features.',
        'TEAM MEMBER — Standard access: create and edit quotes and invoices, log mileage, upload photos. Cannot delete documents, access billing, invite others, or change team settings.',
        'To invite someone: click Settings in the toolbar, scroll to the Team section, enter their email address, and click Invite.',
        'The invited person receives an email with a sign-in link. They create a free FieldQuote account (or sign in with an existing one) and are added to your team instantly.',
        'Team Members never see the payment or subscription screen — they get full app access the moment they accept the invite.',
        'All team members\' names appear as selectable contractor buttons in the toolbar, making it easy to assign the right person to each job.',
        'Everyone on the team shares the same document pool — every quote and invoice is visible to all team members.',
        'To remove a team member: click Remove next to their name in Settings → Team. Their account becomes a standalone FieldQuote account with its own trial period.',
      ]
    },
  ]

  return (
    <div style={{ marginTop:20, background:'#041827', borderRadius:10, padding:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h4 style={{ color:GOLD, margin:0 }}>Help &amp; Tutorial</h4>
        <button onClick={onClose} style={{ background:'transparent', color:'#9fb0c6', border:'1px solid #334', padding:'4px 10px', borderRadius:6, cursor:'pointer' }}>✕ Close</button>
      </div>
      <p style={{ color:'#7f98b0', margin:'0 0 14px', fontSize:13 }}>
        Start with section <strong style={{color:GOLD}}>1 — Complete Workflow</strong> if you're new. Tap any section to expand it.
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {sections.map((s, i) => {
          const isOpen = openSections.has(i)
          return (
            <div key={i} style={{ background:'#071827', borderRadius:8, overflow:'hidden', border:`1px solid ${isOpen ? GOLD+'44' : 'transparent'}` }}>
              <button onClick={()=>toggle(i)} style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'transparent', border:'none', cursor:'pointer', textAlign:'left' }}>
                <span style={{ background: isOpen ? GOLD : 'transparent', color: isOpen ? NAVY : GOLD, fontWeight:700, fontSize:12, width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:`1px solid ${GOLD}`, transition:'all 0.15s' }}>{i + 1}</span>
                <span style={{ color: isOpen ? GOLD : '#d0dce8', fontWeight:600, fontSize:14, flex:1 }}>{s.icon ? s.icon + ' ' : ''}{s.title}</span>
                <span style={{ color:'#7f98b0', fontSize:12, userSelect:'none' }}>{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && (
                <div style={{ padding:'0 18px 18px 52px' }}>
                  <p style={{ color:'#9fb0c6', margin:'0 0 12px', fontSize:13, lineHeight:1.6 }}>{s.desc}</p>
                  {s.tip && <div style={TIP_STYLE}>💡 {s.tip}</div>}
                  <ol style={{ margin:0, padding:'0 0 0 20px' }}>
                    {s.steps.map((step, j) => (
                      <li key={j} style={{ color:'#c8d8e8', fontSize:13, lineHeight:1.9, paddingLeft:4 }}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ClientsPanel({ docs, onOpen, onClose }) {
  const [selected, setSelected] = useState(null)

  const clients = useMemo(() => {
    const map = {}
    docs.forEach(doc => {
      const name = (doc.client || '').trim()
      if (!name) return
      if (!map[name]) map[name] = { name, quotes: 0, invoices: 0, billed: 0, paid: 0, docs: [] }
      if (doc.doc_type === 'invoice') map[name].invoices++
      else map[name].quotes++
      map[name].billed += Number(doc.total) || 0
      if (doc.status === 'paid') map[name].paid += Number(doc.total) || 0
      map[name].docs.push(doc)
    })
    return Object.values(map).sort((a, b) => b.billed - a.billed)
  }, [docs])

  if (selected) {
    const clientDocs = [...selected.docs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    return (
      <div style={{ marginTop:20, background:'#041827', borderRadius:10, padding:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <button onClick={()=>setSelected(null)} style={{ background:'transparent', color:'#9fb0c6', border:'1px solid #334', padding:'4px 12px', borderRadius:6, cursor:'pointer' }}>← All Clients</button>
          <button onClick={onClose} style={{ background:'transparent', color:'#9fb0c6', border:'1px solid #334', padding:'4px 10px', borderRadius:6, cursor:'pointer' }}>✕ Close</button>
        </div>
        <h4 style={{ color:GOLD, margin:'0 0 6px' }}>{selected.name}</h4>
        <div style={{ display:'flex', gap:20, marginBottom:14, color:'#9fb0c6', fontSize:13, flexWrap:'wrap' }}>
          <span>{selected.quotes} quote{selected.quotes !== 1 ? 's' : ''}</span>
          <span>{selected.invoices} invoice{selected.invoices !== 1 ? 's' : ''}</span>
          <span>Billed: <strong style={{ color:GOLD }}>{formatCurrency(selected.billed)}</strong></span>
          <span>Paid: <strong style={{ color:'#4caf50' }}>{formatCurrency(selected.paid)}</strong></span>
        </div>
        <div style={{ background:'#071827', borderRadius:6, overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Document','Type','Total','Status','Date',''].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'10px', color:GOLD, fontWeight:600, fontSize:13 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientDocs.map(doc => (
                <tr key={doc.id} style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding:'10px', color:'#fff', fontWeight:600 }}>{doc.doc_number || '—'}</td>
                  <td style={{ padding:'10px', color:'#9fb0c6', textTransform:'capitalize' }}>{doc.doc_type || 'quote'}</td>
                  <td style={{ padding:'10px', color:GOLD }}>{doc.total != null ? formatCurrency(doc.total) : '—'}</td>
                  <td style={{ padding:'10px' }}>
                    <span style={{ padding:'2px 8px', borderRadius:10, fontSize:11,
                      background: doc.status==='paid' ? '#1a3d1a' : doc.status==='approved' ? '#1a2d3d' : doc.status==='sent' ? '#2a2010' : '#1a1a2d',
                      color: doc.status==='paid' ? '#4caf50' : doc.status==='approved' ? '#7ab3e0' : doc.status==='sent' ? GOLD : '#9fb0c6' }}>
                      {doc.status || 'draft'}
                    </span>
                  </td>
                  <td style={{ padding:'10px', color:'#7f98b0', fontSize:12 }}>{doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '—'}</td>
                  <td style={{ padding:'10px' }}>
                    <button type='button' onClick={()=>onOpen(doc)} style={{ background:'#0f2740', color:'#fff', border:`1px solid ${GOLD}`, padding:'5px 10px', borderRadius:6, fontSize:12, cursor:'pointer' }}>Open</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop:20, background:'#041827', borderRadius:10, padding:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <h4 style={{ color:GOLD, margin:0 }}>Clients</h4>
        <button onClick={onClose} style={{ background:'transparent', color:'#9fb0c6', border:'1px solid #334', padding:'4px 10px', borderRadius:6, cursor:'pointer' }}>✕ Close</button>
      </div>
      {clients.length === 0 ? (
        <div style={{ color:'#7f98b0', padding:'8px 0' }}>No clients yet — save some documents first.</div>
      ) : (
        <div style={{ background:'#071827', borderRadius:6, overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Client','Quotes','Invoices','Total Billed','Total Paid',''].map((h,i) => (
                  <th key={h} style={{ textAlign: i >= 3 ? 'right' : 'left', padding:'10px', color:GOLD, fontWeight:600, fontSize:13 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.name} onClick={()=>setSelected(c)} style={{ borderTop:'1px solid rgba(255,255,255,0.05)', cursor:'pointer' }}>
                  <td style={{ padding:'10px', color:'#fff', fontWeight:600 }}>{c.name}</td>
                  <td style={{ padding:'10px', color:'#9fb0c6' }}>{c.quotes}</td>
                  <td style={{ padding:'10px', color:'#9fb0c6' }}>{c.invoices}</td>
                  <td style={{ padding:'10px', color:GOLD, textAlign:'right' }}>{formatCurrency(c.billed)}</td>
                  <td style={{ padding:'10px', color:'#4caf50', textAlign:'right' }}>{formatCurrency(c.paid)}</td>
                  <td style={{ padding:'10px', color:'#7f98b0', fontSize:12, textAlign:'right' }}>View →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ScheduleCalendar({ docs, onClose }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState(null)

  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const byDate = {}
  docs.forEach(doc => {
    if (!doc.scheduled_date) return
    const key = doc.scheduled_date.slice(0, 10)
    if (!byDate[key]) byDate[key] = []
    byDate[key].push(doc)
  })

  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
  const monthLabel = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' })

  function dateKey(d) { return `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` }
  function prevMonth() { if (month===0){setYear(y=>y-1);setMonth(11)}else setMonth(m=>m-1); setSelectedDay(null) }
  function nextMonth() { if (month===11){setYear(y=>y+1);setMonth(0)}else setMonth(m=>m+1); setSelectedDay(null) }

  const selectedDocs = selectedDay ? (byDate[dateKey(selectedDay)] || []) : []

  return (
    <div style={{ marginTop:20, background:'#041827', borderRadius:10, padding:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <h4 style={{ color:GOLD, margin:0 }}>Schedule</h4>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={prevMonth} style={{ background:'#0f2740', color:'#fff', border:`1px solid ${GOLD}`, padding:'4px 12px', borderRadius:6, cursor:'pointer', fontSize:16 }}>‹</button>
          <span style={{ color:GOLD, fontWeight:700, fontSize:15, minWidth:160, textAlign:'center' }}>{monthLabel}</span>
          <button onClick={nextMonth} style={{ background:'#0f2740', color:'#fff', border:`1px solid ${GOLD}`, padding:'4px 12px', borderRadius:6, cursor:'pointer', fontSize:16 }}>›</button>
        </div>
        <button onClick={onClose} style={{ background:'transparent', color:'#9fb0c6', border:'1px solid #334', padding:'4px 10px', borderRadius:6, cursor:'pointer' }}>✕ Close</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2, marginBottom:4 }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} style={{ textAlign:'center', color:'#7f98b0', fontSize:11, fontWeight:600, padding:'4px 0' }}>{d}</div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2 }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={`e${idx}`} />
          const key = dateKey(day)
          const dayDocs = byDate[key] || []
          const isToday = key === todayKey
          const isSelected = selectedDay === day
          return (
            <div key={key} onClick={() => setSelectedDay(isSelected ? null : day)} style={{
              minHeight:64, background: isSelected ? '#0f2740' : isToday ? '#0a2235' : '#081520',
              border: isSelected ? `1px solid ${GOLD}` : isToday ? '1px solid #1a4060' : '1px solid #0d1e2e',
              borderRadius:6, padding:'4px 6px', cursor:'pointer'
            }}>
              <div style={{ fontSize:11, color: isToday ? GOLD : '#9fb0c6', fontWeight: isToday ? 700 : 400, marginBottom:3 }}>{day}</div>
              {dayDocs.slice(0,3).map(doc => (
                <div key={doc.id} style={{
                  fontSize:10, padding:'2px 4px', borderRadius:3, marginBottom:2,
                  background: doc.doc_type==='invoice' ? '#1a3860' : '#2a1a10',
                  color: doc.doc_type==='invoice' ? '#7ab3e0' : GOLD,
                  overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis'
                }}>
                  {doc.doc_number}{doc.client ? ` · ${doc.client}` : ''}
                </div>
              ))}
              {dayDocs.length > 3 ? <div style={{ fontSize:10, color:'#7f98b0' }}>+{dayDocs.length-3} more</div> : null}
            </div>
          )
        })}
      </div>

      {selectedDay ? (
        <div style={{ marginTop:14, background:'#071827', borderRadius:8, padding:14 }}>
          <div style={{ color:GOLD, fontWeight:700, marginBottom:10 }}>
            {new Date(year, month, selectedDay).toLocaleDateString('default', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
          </div>
          {selectedDocs.length === 0 ? (
            <div style={{ color:'#7f98b0' }}>No jobs scheduled this day</div>
          ) : selectedDocs.map(doc => (
            <div key={doc.id} style={{ background:'#0a1e32', borderRadius:6, padding:'10px 14px', marginBottom:8, borderLeft:`3px solid ${doc.doc_type==='invoice' ? '#7ab3e0' : GOLD}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontWeight:700, color:'#fff' }}>{doc.doc_number}</div>
                <div style={{ color:GOLD, fontWeight:700 }}>{doc.total != null ? formatCurrency(doc.total) : '—'}</div>
              </div>
              {doc.client ? <div style={{ color:'#9fb0c6', marginTop:3 }}>{doc.client}</div> : null}
              {doc.address ? <div style={{ color:'#7f98b0', fontSize:12, marginTop:2 }}>{doc.address}</div> : null}
              <div style={{ color:'#7f98b0', fontSize:11, marginTop:4, textTransform:'capitalize' }}>{doc.doc_type} · {doc.status || 'draft'}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function JoinPage({ token, user, authLoading }) {
  const [info, setInfo] = useState(null)
  const [infoLoading, setInfoLoading] = useState(true)
  const [infoError, setInfoError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMsg, setAuthMsg] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.functions.invoke('get-invite-info', { body: { token } })
      .then(({ data, error }) => {
        if (error || data?.error) { setInfoError((data?.error) || error.message); return }
        setInfo(data)
      })
      .finally(() => setInfoLoading(false))
  }, [token])

  // Auto-accept when the user arrives already authenticated (magic link flow)
  useEffect(() => {
    if (!user || !info || info.status !== 'pending' || accepting || done) return
    setAccepting(true)
    supabase.functions.invoke('accept-team-invite', { body: { token } })
      .then(({ data, error }) => {
        if (error || data?.error) {
          setAuthMsg(data?.error || error?.message || 'Failed to accept invite.')
          setAccepting(false)
          return
        }
        setDone(true)
      })
  }, [user, info]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAuth(isSignUp) {
    setAuthMsg('')
    const fn = isSignUp
      ? supabase.auth.signUp({ email, password })
      : supabase.auth.signInWithPassword({ email, password })
    const { error } = await fn
    if (error) { setAuthMsg(error.message); return }
    if (isSignUp) setAuthMsg('Check your email to confirm, then sign in below.')
  }

  async function handleAccept() {
    if (!user) { setAuthMsg('Please sign in first.'); return }
    setAccepting(true)
    const { data, error } = await supabase.functions.invoke('accept-team-invite', { body: { token } })
    setAccepting(false)
    if (error || data?.error) { setAuthMsg((data?.error) || error.message); return }
    setDone(true)
  }

  const wrapStyle = { minHeight:'100vh', background:NAVY, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }
  const cardStyle = { background:'#041827', borderRadius:12, padding:32, maxWidth:420, width:'100%' }

  if (infoLoading) return <div style={wrapStyle}><div style={cardStyle}><div style={{ color:'#9fb0c6' }}>Loading invite…</div></div></div>
  if (infoError) return <div style={wrapStyle}><div style={cardStyle}><div style={{ color:'#e05252', marginBottom:8 }}>Invite not found or expired.</div><div style={{ color:'#7f98b0', fontSize:13 }}>{infoError}</div></div></div>

  if (done) {
    return (
      <div style={wrapStyle}>
        <div style={cardStyle}>
          <div style={{ color:GOLD, fontWeight:700, fontSize:20, marginBottom:12 }}>You're in!</div>
          <div style={{ color:'#9fb0c6', marginBottom:20 }}>You've joined <strong style={{ color:'#fff' }}>{info.company}</strong> as a team member.</div>
          <button onClick={() => window.location.href = '/'} style={{ width:'100%', padding:'11px 0', borderRadius:7, background:GOLD, color:NAVY, border:'none', fontWeight:700, fontSize:14, cursor:'pointer' }}>
            Open FieldQuote
          </button>
        </div>
      </div>
    )
  }

  if (info.status === 'active') {
    return (
      <div style={wrapStyle}>
        <div style={cardStyle}>
          <div style={{ color:GOLD, fontWeight:700, fontSize:18, marginBottom:10 }}>Invite Already Used</div>
          <div style={{ color:'#9fb0c6' }}>This invite has already been accepted. <a href='/' style={{ color:GOLD }}>Go to FieldQuote</a></div>
        </div>
      </div>
    )
  }

  return (
    <div style={wrapStyle}>
      <div style={cardStyle}>
        <div style={{ color:GOLD, fontWeight:700, fontSize:20, marginBottom:6 }}>Team Invite</div>
        <div style={{ color:'#9fb0c6', marginBottom:20, fontSize:14 }}>
          You've been invited to join <strong style={{ color:'#fff' }}>{info.company}</strong> on FieldQuote.
        </div>

        {authLoading || (user && accepting) ? (
          <div style={{ color:'#9fb0c6', fontSize:13, textAlign:'center', padding:'12px 0' }}>
            {accepting ? `Joining ${info?.company || 'team'}…` : 'Loading…'}
          </div>
        ) : user ? (
          <div>
            <div style={{ color:'#9fb0c6', fontSize:13, marginBottom:14 }}>
              Signed in as <strong style={{ color:'#fff' }}>{user.email}</strong>
            </div>
            {authMsg && <div style={{ color:'#e05252', fontSize:13, marginBottom:10 }}>{authMsg}</div>}
            {!accepting && (
              <button onClick={handleAccept} disabled={accepting} style={{ width:'100%', padding:'11px 0', borderRadius:7, background:GOLD, color:NAVY, border:'none', fontWeight:700, fontSize:14, cursor:'pointer' }}>
                {`Accept Invite & Join ${info.company}`}
              </button>
            )}
          </div>
        ) : (
          <div>
            <div style={{ color:'#9fb0c6', fontSize:13, marginBottom:14 }}>Sign in or create an account to accept this invite.</div>
            <div style={{ marginBottom:12 }}>
              <input value={email} onChange={e=>setEmail(e.target.value)} placeholder='Email' type='email' style={{ width:'100%', padding:'9px 12px', borderRadius:6, border:'1px solid #223', background:'#0a1e32', color:'#fff', boxSizing:'border-box', fontSize:14, marginBottom:8 }} />
              <input value={password} onChange={e=>setPassword(e.target.value)} placeholder='Password' type='password' style={{ width:'100%', padding:'9px 12px', borderRadius:6, border:'1px solid #223', background:'#0a1e32', color:'#fff', boxSizing:'border-box', fontSize:14 }} />
            </div>
            {authMsg && <div style={{ color: authMsg.startsWith('Check') ? '#4caf50' : '#e05252', fontSize:13, marginBottom:10 }}>{authMsg}</div>}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>handleAuth(false)} style={{ flex:1, padding:'10px 0', borderRadius:6, background:GOLD, color:NAVY, border:'none', fontWeight:700, cursor:'pointer' }}>Sign In</button>
              <button onClick={()=>handleAuth(true)} style={{ flex:1, padding:'10px 0', borderRadius:6, background:'#0f2740', color:'#fff', border:`1px solid ${GOLD}`, fontWeight:700, cursor:'pointer' }}>Sign Up</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SettingsPanel({ user, company, name1, name2, name3, subscription, trialDaysLeft, subscribeLoading, billingPortalLoading, onSubscribe, onManageBilling, onSave, onClose, isAdmin, accountId, logoUrl, onUploadLogo, onRemoveLogo }) {
  const [co, setCo] = useState(company || '')
  const [n1, setN1] = useState(name1 || '')
  const [n2, setN2] = useState(name2 || '')
  const [n3, setN3] = useState(name3 || '')
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [logoMsg, setLogoMsg] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoRemoving, setLogoRemoving] = useState(false)

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setLogoMsg('Please select an image file.'); return }
    if (file.size > 2 * 1024 * 1024) { setLogoMsg('Image must be under 2 MB.'); return }
    setLogoUploading(true)
    setLogoMsg('')
    const result = await onUploadLogo(file)
    setLogoUploading(false)
    setLogoMsg(result.error ? result.error : 'Logo saved.')
    e.target.value = ''
  }

  async function handleLogoRemove() {
    if (!window.confirm('Remove your company logo?')) return
    setLogoRemoving(true)
    await onRemoveLogo()
    setLogoRemoving(false)
    setLogoMsg('Logo removed.')
  }

  // Team management state
  const [teamMembers, setTeamMembers] = useState([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [removingId, setRemovingId] = useState(null)

  useEffect(() => {
    if (!isAdmin || !accountId) return
    setTeamLoading(true)
    supabase.from('team_members').select('*').eq('account_id', accountId).order('invited_at', { ascending: false })
      .then(({ data }) => { setTeamMembers(data || []) })
      .finally(() => setTeamLoading(false))
  }, [isAdmin, accountId])

  async function handleInvite() {
    if (!inviteEmail.trim()) { setInviteMsg('Enter an email address.'); return }
    setInviting(true)
    setInviteMsg('')
    setInviteLink('')
    const sentTo = inviteEmail.trim().toLowerCase()
    const { data, error } = await supabase.functions.invoke('send-team-invite', { body: { email: sentTo } })
    setInviting(false)
    if (error || data?.error) { setInviteMsg(data?.error || error.message); return }
    if (data?.manualLink) {
      setInviteLink(data.manualLink)
      setInviteMsg(data.message || 'Share this link to invite them:')
    } else {
      setInviteMsg(`Invitation email sent to ${sentTo}`)
    }
    setInviteEmail('')
    const { data: members } = await supabase.from('team_members').select('*').eq('account_id', accountId).order('invited_at', { ascending: false })
    setTeamMembers(members || [])
  }

  async function handleResend(email) {
    setInviteMsg('')
    setInviteLink('')
    const { data, error } = await supabase.functions.invoke('send-team-invite', { body: { email } })
    if (error || data?.error) { setInviteMsg(data?.error || error.message); return }
    if (data?.manualLink) {
      setInviteLink(data.manualLink)
      setInviteMsg(data.message || 'Share this link to invite them:')
    } else {
      setInviteMsg(`Invitation resent to ${email}`)
    }
  }

  async function handleRemove(memberId) {
    if (!window.confirm('Remove this team member?')) return
    setRemovingId(memberId)
    const { error } = await supabase.functions.invoke('remove-team-member', { body: { memberId } })
    setRemovingId(null)
    if (error) { setInviteMsg('Failed to remove: ' + error.message); return }
    setTeamMembers(prev => prev.filter(m => m.id !== memberId))
  }

  async function handleSave() {
    if (!co.trim() || !n1.trim()) { setMsg('Company name and at least one contractor name are required.'); return }
    setSaving(true)
    setMsg('')
    const err = await onSave(co.trim(), n1.trim(), n2.trim(), n3.trim())
    setSaving(false)
    setMsg(err || 'Settings saved.')
  }

  const fieldStyle = { width:'100%', padding:'9px 12px', borderRadius:6, border:'1px solid #223', background:'#0a1e32', color:'#fff', boxSizing:'border-box', fontSize:14 }
  const labelStyle = { display:'block', marginBottom:6, color:'#9fb0c6', fontSize:13 }

  const status = subscription?.status
  const isActive   = status === 'active'
  const isTrialing = status === 'trialing'
  const isPastDue  = status === 'past_due'
  const isCanceled = status === 'canceled'

  const statusBadge = isActive   ? { label:'Active',       bg:'#1a3d1a', color:'#4caf50' }
                    : isTrialing  ? { label:'Free Trial',   bg:'#1a2a10', color:'#a0cc60' }
                    : isPastDue   ? { label:'Past Due',     bg:'#3d1a0a', color:'#e87040' }
                    : isCanceled  ? { label:'Canceled',     bg:'#2a0a0a', color:'#e05252' }
                    :               { label:'No Plan',      bg:'#1a1a2d', color:'#9fb0c6' }

  return (
    <div style={{ marginTop:20, background:'#041827', borderRadius:10, padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h4 style={{ color:GOLD, margin:0 }}>Settings</h4>
        <button onClick={onClose} style={{ background:'transparent', color:'#9fb0c6', border:'1px solid #334', padding:'4px 10px', borderRadius:6, cursor:'pointer' }}>✕ Close</button>
      </div>

      <div className='settings-grid' style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, alignItems:'start' }}>

        {/* Profile section */}
        <div>
          <div style={{ color:GOLD, fontWeight:700, fontSize:13, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:14 }}>Company Profile</div>

          {!isAdmin && (
            <div style={{ background:'#0a1e32', borderRadius:6, padding:'10px 14px', marginBottom:14, color:'#9fb0c6', fontSize:13 }}>
              You are a team member. Profile settings are managed by the account admin.
            </div>
          )}

          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Company Name *</label>
            <input value={co} onChange={e=>setCo(e.target.value)} placeholder='Your company name' style={fieldStyle} disabled={!isAdmin} />
          </div>

          {[
            { label:'Contractor Name 1 *', val:n1, set:setN1, required:true },
            { label:'Contractor Name 2',   val:n2, set:setN2, required:false },
            { label:'Contractor Name 3',   val:n3, set:setN3, required:false },
          ].map(({ label, val, set, required }) => (
            <div key={label} style={{ marginBottom:14 }}>
              <label style={labelStyle}>{label}{!required && <span style={{ color:'#7f98b0', fontWeight:400 }}> (optional)</span>}</label>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input value={val} onChange={e=>set(e.target.value)} placeholder='e.g. John Smith' style={{ ...fieldStyle, flex:1 }} disabled={!isAdmin} />
                {!required && val && isAdmin ? (
                  <button onClick={()=>set('')} title='Remove' style={{ background:'transparent', color:'#e05252', border:'1px solid #e05252', borderRadius:6, padding:'7px 10px', cursor:'pointer', fontSize:14, lineHeight:1 }}>✕</button>
                ) : null}
              </div>
            </div>
          ))}

          {msg ? (
            <div style={{ color: msg === 'Settings saved.' ? '#4caf50' : GOLD, marginBottom:12, fontSize:13 }}>{msg}</div>
          ) : null}

          {isAdmin && (
            <div style={{ display:'flex', gap:10, marginBottom:20 }}>
              <button onClick={handleSave} disabled={saving} style={{ padding:'10px 24px', borderRadius:6, background:GOLD, color:NAVY, border:'none', fontWeight:700, cursor:'pointer' }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={onClose} style={{ padding:'10px 16px', borderRadius:6, background:'transparent', color:'#9fb0c6', border:'1px solid #334', cursor:'pointer' }}>
                Cancel
              </button>
            </div>
          )}

          {/* Company Logo */}
          <div style={{ borderTop:'1px solid #1a2d40', paddingTop:18 }}>
            <div style={{ color:GOLD, fontWeight:700, fontSize:13, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:12 }}>Company Logo</div>
            {logoUrl ? (
              <div style={{ marginBottom:12 }}>
                <div style={{ background:'#0a1628', borderRadius:8, padding:12, display:'inline-flex', alignItems:'center', gap:12 }}>
                  <img src={logoUrl} alt='Company logo' style={{ height:56, maxWidth:160, objectFit:'contain', borderRadius:4 }} />
                </div>
              </div>
            ) : (
              <div style={{ color:'#7f98b0', fontSize:13, marginBottom:12 }}>No logo uploaded. The FieldQuote logo will appear on all documents.</div>
            )}
            {isAdmin && (
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <label style={{ padding:'8px 16px', borderRadius:6, background:'#0f2740', color:'#fff', border:`1px solid ${GOLD}`, fontWeight:600, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>
                  {logoUploading ? 'Uploading…' : logoUrl ? 'Change Logo' : 'Upload Logo'}
                  <input type='file' accept='image/*' onChange={handleLogoUpload} disabled={logoUploading} style={{ display:'none' }} />
                </label>
                {logoUrl && (
                  <button onClick={handleLogoRemove} disabled={logoRemoving} style={{ padding:'8px 14px', borderRadius:6, background:'transparent', color:'#e05252', border:'1px solid #e05252', fontSize:13, cursor:'pointer' }}>
                    {logoRemoving ? 'Removing…' : 'Remove'}
                  </button>
                )}
              </div>
            )}
            {logoMsg && (
              <div style={{ color: logoMsg === 'Logo saved.' ? '#4caf50' : logoMsg === 'Logo removed.' ? '#9fb0c6' : '#e05252', fontSize:13, marginTop:8 }}>{logoMsg}</div>
            )}
            <div style={{ color:'#7f98b0', fontSize:11, marginTop:8 }}>PNG, JPG, or SVG · max 2 MB · Recommended: transparent background, landscape orientation</div>
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

          {/* Billing section — admin only */}
          {isAdmin && (
            <div style={{ background:'#071827', borderRadius:8, padding:18 }}>
              <div style={{ color:GOLD, fontWeight:700, fontSize:13, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:14 }}>Billing</div>

              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                <span style={{ background:statusBadge.bg, color:statusBadge.color, border:`1px solid ${statusBadge.color}44`, borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:700 }}>
                  {statusBadge.label}
                </span>
                {isTrialing && trialDaysLeft > 0 && (
                  <span style={{ color:'#9fb0c6', fontSize:13 }}>{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} remaining</span>
                )}
                {isTrialing && trialDaysLeft === 0 && (
                  <span style={{ color:'#e87040', fontSize:13 }}>Trial expired</span>
                )}
              </div>

              <div style={{ background:'#0a1628', borderRadius:8, padding:'12px 16px', marginBottom:16 }}>
                <div style={{ color:'#7f98b0', fontSize:11, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>Plan</div>
                <div style={{ color:'#fff', fontWeight:700, fontSize:16 }}>FieldQuote</div>
                <div style={{ color:GOLD, fontSize:22, fontWeight:700, marginTop:4 }}>$29<span style={{ fontSize:13, color:'#7f98b0', fontWeight:400 }}>/month</span></div>
                <div style={{ color:'#7f98b0', fontSize:12, marginTop:4 }}>Unlimited quotes &amp; invoices · All features</div>
              </div>

              {isTrialing && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ color:'#9fb0c6', fontSize:13, marginBottom:10, lineHeight:1.5 }}>
                    {trialDaysLeft > 0
                      ? `Your free trial ends in ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''}. Subscribe now to keep your access without interruption.`
                      : 'Your free trial has ended. Subscribe to continue using FieldQuote.'}
                  </div>
                  <button onClick={onSubscribe} disabled={subscribeLoading} style={{ width:'100%', padding:'11px 0', borderRadius:7, background:GOLD, color:NAVY, border:'none', fontWeight:700, fontSize:14, cursor:'pointer' }}>
                    {subscribeLoading ? 'Redirecting to Stripe…' : 'Subscribe — $29/month'}
                  </button>
                </div>
              )}

              {(isPastDue || isCanceled || (!subscription)) && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ color:'#9fb0c6', fontSize:13, marginBottom:10 }}>
                    {isPastDue   ? 'Your last payment failed. Update your payment method to restore access.'
                     : isCanceled ? 'Your subscription was canceled. Resubscribe to continue.'
                     :              'No active subscription found.'}
                  </div>
                  <button onClick={onSubscribe} disabled={subscribeLoading} style={{ width:'100%', padding:'11px 0', borderRadius:7, background:GOLD, color:NAVY, border:'none', fontWeight:700, fontSize:14, cursor:'pointer' }}>
                    {subscribeLoading ? 'Redirecting to Stripe…' : isPastDue ? 'Update Payment Method' : 'Subscribe — $29/month'}
                  </button>
                </div>
              )}

              {isActive && (
                <div>
                  <div style={{ color:'#9fb0c6', fontSize:13, marginBottom:10 }}>
                    Your subscription is active. Use the billing portal to update payment info, download invoices, or cancel.
                  </div>
                  <button onClick={onManageBilling} disabled={billingPortalLoading} style={{ width:'100%', padding:'11px 0', borderRadius:7, background:'#0f2740', color:'#fff', border:`1px solid ${GOLD}`, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                    {billingPortalLoading ? 'Opening portal…' : 'Manage Billing'}
                  </button>
                </div>
              )}

              <div style={{ marginTop:14, color:'#7f98b0', fontSize:11 }}>
                Payments are processed securely by Stripe. FieldQuote does not store your card details.
              </div>
            </div>
          )}

          {/* Team section — admin only */}
          {isAdmin && (
            <div style={{ background:'#071827', borderRadius:8, padding:18 }}>
              <div style={{ color:GOLD, fontWeight:700, fontSize:13, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:14 }}>Team</div>

              <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                <input
                  value={inviteEmail}
                  onChange={e=>setInviteEmail(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter') handleInvite() }}
                  placeholder='team@example.com'
                  style={{ flex:1, padding:'9px 12px', borderRadius:6, border:'1px solid #223', background:'#0a1e32', color:'#fff', fontSize:14 }}
                />
                <button onClick={handleInvite} disabled={inviting} style={{ padding:'9px 16px', borderRadius:6, background:GOLD, color:NAVY, border:'none', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                  {inviting ? '…' : 'Invite'}
                </button>
              </div>

              {inviteMsg && (
                <div style={{
                  color: inviteMsg.startsWith('Invitation') || inviteMsg.startsWith('Resent') ? '#4caf50'
                       : inviteMsg.includes('already has') || inviteMsg.includes('Share') ? GOLD
                       : '#e05252',
                  fontSize:13, marginBottom:8, lineHeight:1.5
                }}>{inviteMsg}</div>
              )}
              {inviteLink && (
                <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                  <input readOnly value={inviteLink} style={{ flex:1, padding:'7px 10px', borderRadius:6, border:'1px solid #334', background:'#0a1628', color:'#c9d8e8', fontSize:12 }} onClick={e=>e.target.select()} />
                  <button onClick={()=>{ navigator.clipboard.writeText(inviteLink); setInviteMsg('Link copied!') }} style={{ padding:'7px 12px', borderRadius:6, background:'#0f2740', color:'#fff', border:`1px solid ${GOLD}`, fontSize:12, cursor:'pointer' }}>Copy</button>
                </div>
              )}

              {teamLoading ? (
                <div style={{ color:'#7f98b0', fontSize:13 }}>Loading…</div>
              ) : teamMembers.length === 0 ? (
                <div style={{ color:'#7f98b0', fontSize:13 }}>No team members yet. Enter an email above to send an invite.</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {teamMembers.map(m => (
                    <div key={m.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#0a1628', borderRadius:6, padding:'8px 12px', gap:8 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color:'#fff', fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.email}</div>
                        <div style={{ color: m.status === 'active' ? '#4caf50' : '#7f98b0', fontSize:11, marginTop:2 }}>
                          {m.status === 'active' ? 'Active member' : 'Invite pending'}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                        {m.status === 'pending' && (
                          <button
                            onClick={() => handleResend(m.email)}
                            style={{ background:'transparent', color:GOLD, border:`1px solid ${GOLD}44`, borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer' }}
                          >
                            Resend
                          </button>
                        )}
                        <button
                          onClick={() => handleRemove(m.id)}
                          disabled={removingId === m.id}
                          style={{ background:'transparent', color:'#e05252', border:'1px solid #e05252', borderRadius:6, padding:'4px 10px', fontSize:12, cursor:'pointer' }}
                        >
                          {removingId === m.id ? '…' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  )
}

function AddOnRow({ onAdd }){
  const [d, setD] = useState('')
  const [q, setQ] = useState(1)
  const [u, setU] = useState(0)
  return (
    <div className='no-print' style={{ display:'flex', gap:8, marginTop:8 }}>
      <input placeholder='Description' value={d} onChange={e=>setD(e.target.value)} style={{ flex:2, padding:8 }} />
      <input type='number' value={q} onChange={e=>setQ(Number(e.target.value)||0)} style={{ width:80, padding:8 }} />
      <input type='text' value={formatMoneyInput(u)} onChange={e=>setU(parseMoneyInput(e.target.value))} style={{ width:120, padding:8 }} />
      <button onClick={()=>{ if(d) { onAdd(d,q,u); setD(''); setQ(1); setU(0) } }} style={{ background:GOLD, color:NAVY, padding:8, borderRadius:6 }}>Add</button>
    </div> 
  )
}
