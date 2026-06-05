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
  { id: 'sewer', name: 'Sewer Line', unit: 1200 },
  { id: 'water', name: 'Water Line Meter', unit: 800 },
  { id: 'temp_gas', name: 'Temp Gas', unit: 250 },
  { id: 'gas_riser', name: 'Gas Riser', unit: 400 },
  { id: 'manablok', name: 'Manablok System', unit: 950 },
  { id: 'water_heater', name: 'Water Heater', unit: 600 },
  { id: 'storm', name: 'Storm Drain', unit: 700 },
  { id: 'repiping', name: 'Repiping', unit: 1500 },
  { id: 'gas_indoor', name: 'Gas System Indoor', unit: 300 },
  { id: 'grease', name: 'Grease Trap', unit: 450 },
  { id: 'cut_bust', name: 'Cut and Bust Concrete', unit: 200 }
]

const BASE_SERVICE_IDS = ['gas_indoor', 'water', 'water_heater', 'manablok']

function formatCurrency(n){ return '$' + Number(n || 0).toLocaleString() }
function getPhotoUrl(path){ const { data } = supabase.storage.from('job-photos').getPublicUrl(path); return data.publicUrl }
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

  const [houses, setHouses] = useState(1)
  const [fixturesPerHouse, setFixturesPerHouse] = useState(1)
  const [pricePerFixture, setPricePerFixture] = useState(120)
  const [fixtureType, setFixtureType] = useState('Residential')
  const [projectType, setProjectType] = useState('New Construction')
  const [includeUnderground, setIncludeUnderground] = useState(true)
  const [includeRough, setIncludeRough] = useState(true)
  const [includeTrim, setIncludeTrim] = useState(true)
  const [serviceStartPercent, setServiceStartPercent] = useState(50)
  const [serviceCompletionPercent, setServiceCompletionPercent] = useState(50)

  const [services, setServices] = useState(() => SERVICES.map(s=>({ ...s, enabled:false, qty:0, ...(BASE_SERVICE_IDS.includes(s.id) ? { billingMode: 'pct' } : {}) })))
  const [addons, setAddons] = useState([])
  const [notes, setNotes] = useState('')
  const [history, setHistory] = useState([])
  const [status, setStatus] = useState('draft')
  const [savedDocId, setSavedDocId] = useState(null)
  const [saveMessage, setSaveMessage] = useState('')
  const [savedDocs, setSavedDocs] = useState([])
  const [clientPhotos, setClientPhotos] = useState([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [includePhotos, setIncludePhotos] = useState(false)
  const [photoMessage, setPhotoMessage] = useState('')

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
      return { underground: base*0.3, rough: base*0.5, trim: base*0.2 }
    }
    return {
      start: base * (serviceStartPercent / 100),
      completion: base * (serviceCompletionPercent / 100)
    }
  }, [base, projectType, serviceStartPercent, serviceCompletionPercent])
  const showFixturesPrint = base > 0
  const showNewConstructionSchedule = projectType === 'New Construction' && (includeUnderground || includeRough || includeTrim)
  const selectedPhaseNames = []
  if (includeUnderground) selectedPhaseNames.push('30% Underground')
  if (includeRough) selectedPhaseNames.push('50% Rough-In')
  if (includeTrim) selectedPhaseNames.push('20% Trim')
  const selectedPhaseLabel = selectedPhaseNames.length === 0 ? '' : selectedPhaseNames.length === 1 ? selectedPhaseNames[0] : selectedPhaseNames.length === 2 ? `${selectedPhaseNames[0]} and ${selectedPhaseNames[1]}` : selectedPhaseNames.join(', ')
  const selectedPhaseAmount = selectedPhaseNames.reduce((sum,name) => {
    if (name === '30% Underground') return sum + phases.underground
    if (name === '50% Rough-In') return sum + phases.rough
    if (name === '20% Trim') return sum + phases.trim
    return sum
  }, 0)
  const paymentScheduleList = []
  if (includeUnderground) paymentScheduleList.push({ name: '30% Underground', pct: 30, amount: phases.underground })
  if (includeRough) paymentScheduleList.push({ name: '50% Rough-In', pct: 50, amount: phases.rough })
  if (includeTrim) paymentScheduleList.push({ name: '20% Trim', pct: 20, amount: phases.trim })
  const showPrintNote = projectType === 'New Construction' && selectedPhaseNames.length > 0 && (docType === 'quote' || selectedPhaseNames.length < 3)
  const printAddress = address || ''

  const servicesTotal = useMemo(()=> services.reduce((s,it)=> {
    if (isNewConstruction && BASE_SERVICE_IDS.includes(it.id) && (it.billingMode ?? 'pct') === 'pct') return s
    return s + (it.enabled ? (it.qty||0)*(it.unit||0) : 0)
  }, 0), [services, isNewConstruction])
  const printServices = services.filter(s => s.enabled && s.qty>0 && !(isNewConstruction && BASE_SERVICE_IDS.includes(s.id) && (s.billingMode ?? 'pct') === 'pct'))
  const addonsTotal = useMemo(()=> addons.reduce((s,a)=> s + (a.qty||0)*(a.unit||0), 0), [addons])
  const subtotal = base + servicesTotal + addonsTotal
  const isPhaseInvoice = docType === 'invoice' && projectType === 'New Construction' && selectedPhaseNames.length > 0
  const displayTotal = isPhaseInvoice ? selectedPhaseAmount + servicesTotal : subtotal
  const schedule = useMemo(() => {
    if (projectType === 'New Construction') {
      return { underground: subtotal*0.3, rough: subtotal*0.5, trim: subtotal*0.2 }
    }
    return { start: subtotal*0.5, completion: subtotal*0.5 }
  }, [subtotal, projectType])

  const fetchSavedDocs = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase fetch saved docs error:', error)
      return
    }
    setSavedDocs(data || [])
  }, [user])

  async function signUp(){
    setAuthMessage('')
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
    setAuthMessage('Logged out')
  }

  async function loadProfile(){
    if (!user) return
    setProfileLoading(true)
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
        setProfileCompany(data.company_name || '')
        setProfileName1(data.name1 || '')
        setProfileName2(data.name2 || '')
        setProfileName3(data.name3 || '')
        setContractor(data.name1 || data.company_name || 'MVP Solutions')
      } else {
        setProfile(null)
      }
    } catch (e) {
      console.error('Error loading profile', e)
    } finally {
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

  function applyDocumentData(data){
    if (data.raw_counter != null) counter.reset(data.raw_counter)
    setSavedDocId(data.id ?? null)
    setContractor(data.contractor ?? 'MVP Solutions')
    setShowLogo(data.show_logo ?? true)
    setDocType(data.doc_type ?? 'quote')
    setClient(data.client ?? '')
    setAddress(data.address ?? '')
    setHouses(data.houses ?? 1)
    setFixturesPerHouse(data.fixtures_per_house ?? 1)
    setPricePerFixture(data.price_per_fixture ?? 120)
    setFixtureType(data.fixture_type ?? 'Residential')
    setProjectType(data.project_type ?? 'New Construction')
    setIncludeUnderground(data.include_underground ?? true)
    setIncludeRough(data.include_rough ?? true)
    setIncludeTrim(data.include_trim ?? true)
    setServiceStartPercent(data.service_start_percent ?? 50)
    setServiceCompletionPercent(data.service_completion_percent ?? 50)
    setServices(data.services ?? SERVICES.map(s=>({ ...s, enabled:false, qty:0 })))
    setAddons(data.addons ?? [])
    setNotes(data.notes ?? '')
    setHistory(data.history ?? [])
    setStatus(data.status ?? 'draft')
    setSaveMessage(`Loaded document ${data.doc_number || ''}`)
  }

  // Use an already-fetched document row to populate the form state
  function openDocument(doc){
    if (!doc) return
    applyDocumentData(doc)
  }

  

  async function deleteDocument(id){
    if (!id) return
    if (!window.confirm('Delete this document?')) return
    const { error } = await supabase.from('documents').delete().eq('id', id).eq('user_id', user?.id)
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
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Supabase auth session error:', error)
        }
        setUser(data?.session?.user ?? null)
      } catch (e) {
        console.error('Error getting auth session', e)
      } finally {
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
    if (!user || !client.trim()) { setClientPhotos([]); return }
    let cancelled = false
    const t = setTimeout(async () => {
      setPhotosLoading(true)
      try {
        const { data } = await supabase.from('photos').select('*').eq('user_id', user.id).eq('client_name', client.trim()).order('created_at', { ascending: true })
        if (!cancelled) setClientPhotos(data || [])
      } catch(e){ console.error('Load photos error', e) }
      finally { if (!cancelled) setPhotosLoading(false) }
    }, 400)
    return () => { cancelled = true; clearTimeout(t) }
  }, [client, user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function getMaxRawCounter(){
      if (!user) return null
      try{
        const { data, error } = await supabase
          .from('documents')
          .select('raw_counter')
          .eq('user_id', user.id)
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
      if (!user) return
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
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
      setHouses(data.houses ?? 1)
      setFixturesPerHouse(data.fixtures_per_house ?? 1)
      setPricePerFixture(data.price_per_fixture ?? 120)
      setFixtureType(data.fixture_type ?? 'Residential')
      setProjectType(data.project_type ?? 'New Construction')
      setIncludeUnderground(data.include_underground ?? true)
      setIncludeRough(data.include_rough ?? true)
      setIncludeTrim(data.include_trim ?? true)
      setServiceStartPercent(data.service_start_percent ?? 50)
      setServiceCompletionPercent(data.service_completion_percent ?? 50)
      setServices(data.services ?? SERVICES.map(s=>({ ...s, enabled:false, qty:0 })))
      setAddons(data.addons ?? [])
      setNotes(data.notes ?? '')
      setHistory(data.history ?? [])
      setStatus(data.status ?? 'draft')
    }

    async function init() {
      if (!user) return
      const max = await getMaxRawCounter()
      const start = (max != null && typeof max === 'number') ? (max + 1) : 1
      try { reset(start) } catch (e) { /* ignore */ }
      await Promise.all([loadLastDocument(), fetchSavedDocs()])
    }
    init()
  }, [reset, fetchSavedDocs, user])

  async function persistDocument(overrides = {}){
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
      services,
      addons,
      notes,
      history,
      status,
      total: displayTotal,
      user_id: user?.id,
      doc_number: docNumber,
      raw_counter: counter.raw,
      ...overrides
    }

    if (savedDocId) {
      const { error } = await supabase.from('documents').update(payload).eq('id', savedDocId).eq('user_id', user?.id)
      if (error) {
        console.error('Supabase update error:', error)
        return false
      }
      setSaveMessage('Document saved successfully')
      return true
    }

    const { data, error } = await supabase.from('documents').insert([payload]).select('id').single()
    if (error) {
      console.error('Supabase insert error:', error)
      return false
    }
    setSavedDocId(data.id)
    setSaveMessage('Document saved successfully')
    return true
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
      pushHistory('converted:quote->invoice')
      await persistDocument({ doc_type: 'invoice' })
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

      const { data, error } = user ? await query.eq('user_id', user.id) : await query

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
    setServices(SERVICES.map(s=>({ ...s, enabled:false, qty:0, ...(BASE_SERVICE_IDS.includes(s.id) ? { billingMode: 'pct' } : {}) })))
    setAddons([])
    setNotes('')
    setHistory([])
    setStatus('draft')
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
      const { error: dbErr } = await supabase.from('photos').insert([{ user_id: user.id, client_name: client.trim(), file_path: path, storage_path: path, file_name: file.name }])
      if (dbErr) { setPhotoMessage(dbErr.message); return }
      const { data } = await supabase.from('photos').select('*').eq('user_id', user.id).eq('client_name', client.trim()).order('created_at', { ascending: true })
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

  function sendEmail(){
    const subject = `${docNumber} - ${contractor}`
    const paymentLines = []
    if (projectType === 'New Construction') {
      if (includeUnderground) paymentLines.push(`  - 30% Underground: ${formatCurrency(schedule.underground)}`)
      if (includeRough) paymentLines.push(`  - 50% Rough-In: ${formatCurrency(schedule.rough)}`)
      if (includeTrim) paymentLines.push(`  - 20% Trim: ${formatCurrency(schedule.trim)}`)
    } else {
      paymentLines.push(`  - ${serviceStartPercent}% Start: ${formatCurrency(schedule.start)}`)
      paymentLines.push(`  - ${serviceCompletionPercent}% Completion: ${formatCurrency(schedule.completion)}`)
    }
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
          <h2 style={{ color:GOLD, marginBottom:12 }}>Login or Sign Up</h2>
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block', marginBottom:6, color:'#9fb0c6' }}>Email</label>
            <input type='email' value={email} onChange={e=>setEmail(e.target.value)} style={{ width:'100%', padding:10, borderRadius:6, border:'1px solid #223' }} />
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', marginBottom:6, color:'#9fb0c6' }}>Password</label>
            <input type='password' value={password} onChange={e=>setPassword(e.target.value)} style={{ width:'100%', padding:10, borderRadius:6, border:'1px solid #223' }} />
          </div>
          {authMessage ? <div style={{ color:GOLD, marginBottom:12 }}>{authMessage}</div> : null}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <button onClick={signIn} style={{ flex:1, padding:10, borderRadius:6, background:GOLD, color:NAVY, border:'none' }}>Sign In</button>
            <button onClick={signUp} style={{ flex:1, padding:10, borderRadius:6, background:'#0f2740', color:'#fff', border:`1px solid ${GOLD}` }}>Sign Up</button>
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

  return (
    <div className='invoice-root' style={{ minHeight:'100vh', background:NAVY, color:'#fff', padding:20 }}>
      <div className='invoice-shell' style={{ maxWidth:980, margin:'0 auto', background:'#071827', padding:18, borderRadius:8 }}>
        <div className='invoice-header screen-only' style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            {contractor === 'MVP Solutions' && showLogo ? (
              <div style={{ width:56, height:56, background:GOLD, borderRadius:6 }} />
            ) : contractor === 'MVP Solutions' ? (
              <div style={{ color:'#7f98b0' }}>Logo hidden</div>
            ) : null}

            {contractor === 'MVP Solutions' ? (
              <div><div style={{ color:GOLD, fontWeight:700 }}>MVP Solutions</div><div style={{ color:'#9fb0c6' }}>{contractor}</div></div>
            ) : (
              <div style={{ color:GOLD, fontWeight:700 }}>{contractor}</div>
            )}
          </div>
          <div style={{ textAlign:'right' }}><div style={{ color:'#9fb0c6' }}>{docType.toUpperCase()}</div><div style={{ color:GOLD, fontWeight:700 }}>{docNumber}</div></div>
        </div>

        <div className='screen-only'>
          <div className='no-print' style={{ marginTop:12, display:'flex', gap:8, alignItems:'center' }}>
          {contractorNames.map(name => (
            <button key={name} onClick={()=>setContractor(name)} style={{ padding:8, borderRadius:6, background: contractor===name ? GOLD : '#0f2740', color: contractor===name ? NAVY : '#fff' }}>{name}</button>
          ))}
          <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
            <label style={{ color:'#9fb0c6' }}><input type='checkbox' checked={showLogo} onChange={e=>setShowLogo(e.target.checked)} /> Show logo</label>
            <label style={{ color:'#9fb0c6' }}><input type='radio' checked={docType==='quote'} onChange={()=>setDocType('quote')} /> Quote</label>
            <label style={{ color:'#9fb0c6' }}><input type='radio' checked={docType==='invoice'} onChange={()=>setDocType('invoice')} /> Invoice</label>
            <button onClick={convertToInvoice} style={{ background:GOLD, color:NAVY, padding:8, borderRadius:6 }}>Convert to Invoice</button>
            <button onClick={saveDocument} style={{ background:'#0f2740', color:'#fff', border:`1px solid ${GOLD}`, padding:8, borderRadius:6 }}>Save Document</button>
            <button onClick={sendEmail} style={{ background:'#0f2740', color:'#fff', border:`1px solid ${GOLD}`, padding:8, borderRadius:6 }}>Send Email</button>
            <label style={{ color:'#9fb0c6', display:'flex', alignItems:'center', gap:4, userSelect:'none' }}><input type='checkbox' checked={includePhotos} onChange={e=>setIncludePhotos(e.target.checked)} /> Photos</label>
            <button onClick={printDoc} style={{ background:GOLD, color:NAVY, padding:8, borderRadius:6 }}>Print / PDF</button>
            <button onClick={signOut} style={{ background:'#7a0a0a', color:'#fff', padding:8, borderRadius:6, border:`1px solid ${GOLD}` }}>Logout</button>
          </div>
          <div style={{ marginLeft:'auto', color:'#9fb0c6' }}>{user?.email}</div>
          {saveMessage ? <div style={{ color:GOLD, marginTop:8, fontWeight:700 }}>{saveMessage}</div> : null}
        </div> 

        <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <label style={{ color:'#9fb0c6' }}>Client</label>
            <input value={client} onChange={e=>setClient(e.target.value)} style={{ width:'100%', padding:8, marginTop:6 }} />
          </div>
          <div>
            <label style={{ color:'#9fb0c6' }}>Address</label>
            <input value={address} onChange={e=>setAddress(e.target.value)} style={{ width:'100%', padding:8, marginTop:6 }} />
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
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <div><label style={{ color:'#9fb0c6' }}>{fixtureType === 'Residential' ? 'Houses' : 'Units'}</label><input type='number' value={houses} onChange={e=>setHouses(Number(e.target.value)||0)} style={{ width:80, marginLeft:6 }} /></div>
            <div><label style={{ color:'#9fb0c6' }}>Type</label><select value={fixtureType} onChange={e=>setFixtureType(e.target.value)} style={{ padding:8, marginLeft:6, borderRadius:4 }}><option>Residential</option><option>Commercial</option></select></div>
            <div><label style={{ color:'#9fb0c6' }}>Project Type</label><select value={projectType} onChange={e=>setProjectType(e.target.value)} style={{ padding:8, marginLeft:6, borderRadius:4 }}><option>New Construction</option><option>Service/Replacement</option></select></div>
            <div><label style={{ color:'#9fb0c6' }}>{fixtureType === 'Residential' ? 'Fixtures / House' : 'Fixtures / Unit'}</label><input type='number' value={fixturesPerHouse} onChange={e=>setFixturesPerHouse(Number(e.target.value)||0)} style={{ width:80, marginLeft:6 }} /></div>
            <div><label style={{ color:'#9fb0c6' }}>Price / Fixture</label><input type='text' value={formatMoneyInput(pricePerFixture)} onChange={e=>setPricePerFixture(parseMoneyInput(e.target.value))} style={{ width:100, marginLeft:6 }} /></div>
            <div style={{ marginLeft:'auto', textAlign:'right' }}><div style={{ color:'#9fb0c6' }}>Base</div><div style={{ color:GOLD, fontWeight:700 }}>{formatCurrency(base)}</div></div>
          </div>
          <div style={{ marginTop:10, display:'flex', gap:10, flexWrap:'wrap' }}>
            {projectType === 'New Construction' ? (
              <>
                <div className={!includeUnderground ? 'no-print' : undefined} style={{ padding:8, background:'#022026', borderRadius:6, flex:1, minWidth:200 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}><input type='checkbox' checked={includeUnderground} onChange={e=>setIncludeUnderground(e.target.checked)} /> <span style={{ color:'#9fb0c6' }}>30% Underground</span></label>
                  <div><strong style={{ color:GOLD }}>{formatCurrency(phases.underground)}</strong></div>
                </div>
                <div className={!includeRough ? 'no-print' : undefined} style={{ padding:8, background:'#022026', borderRadius:6, flex:1, minWidth:200 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}><input type='checkbox' checked={includeRough} onChange={e=>setIncludeRough(e.target.checked)} /> <span style={{ color:'#9fb0c6' }}>50% Rough-In</span></label>
                  <div><strong style={{ color:GOLD }}>{formatCurrency(phases.rough)}</strong></div>
                </div>
                <div className={!includeTrim ? 'no-print' : undefined} style={{ padding:8, background:'#022026', borderRadius:6, flex:1, minWidth:200 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}><input type='checkbox' checked={includeTrim} onChange={e=>setIncludeTrim(e.target.checked)} /> <span style={{ color:'#9fb0c6' }}>20% Trim</span></label>
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
            {services.map((s,i)=> (
              <div key={s.id} className={!s.enabled || !(s.qty||0) ? 'no-print' : undefined} style={{ display:'flex', gap:8, alignItems:'center', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.02)' }}>
                <input className='no-print' type='checkbox' checked={s.enabled} onChange={e=>toggleService(i, e.target.checked)} />
                <div style={{ flex:1 }}>
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
                </div>
                <input className='no-print' type='number' value={s.qty} disabled={!s.enabled} onChange={e=>updateService(i,'qty',Number(e.target.value)||0)} style={{ width:80 }} />
                <input className='no-print' type='text' value={formatMoneyInput(s.unit)} disabled={!s.enabled} onChange={e=>updateService(i,'unit',parseMoneyInput(e.target.value))} style={{ width:110 }} />
                <div style={{ color:GOLD, minWidth:110, textAlign:'right' }}>{formatCurrency(s.enabled ? (s.qty||0)*s.unit : 0)}</div>
              </div>
            ))}
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

        <section style={{ marginTop:14, display:'grid', gridTemplateColumns:'1fr 320px', gap:12, alignItems:'start' }}>
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
            <div className={!showFixturesPrint ? 'no-print' : undefined} style={{ display:'flex', justifyContent:'space-between' }}><div style={{ color:'#9fb0c6' }}>{fixtureType === 'Residential' ? 'Houses' : 'Units'}</div><div style={{ color:'#9fb0c6' }}>{houses}</div></div>
            <div className={!showFixturesPrint ? 'no-print' : undefined} style={{ display:'flex', justifyContent:'space-between' }}><div style={{ color:'#9fb0c6' }}>{fixtureType === 'Residential' ? 'Fixtures / House' : 'Fixtures / Unit'}</div><div style={{ color:'#9fb0c6' }}>{fixturesPerHouse}</div></div>
            <div className={servicesTotal===0 ? 'no-print' : undefined} style={{ display:'flex', justifyContent:'space-between' }}><div style={{ color:'#9fb0c6' }}>Services</div><div style={{ color:GOLD }}>{formatCurrency(servicesTotal)}</div></div>
            <div className={addonsTotal===0 ? 'no-print' : undefined} style={{ display:'flex', justifyContent:'space-between' }}><div style={{ color:'#9fb0c6' }}>Add-ons</div><div style={{ color:GOLD }}>{formatCurrency(addonsTotal)}</div></div>
            <hr style={{ borderColor:'rgba(255,255,255,0.04)', margin:'8px 0' }} />
            <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700 }}><div>Total</div><div style={{ color:GOLD }}>{formatCurrency(displayTotal)}</div></div>

            <div className={(!showFixturesPrint || (projectType === 'New Construction' && !showNewConstructionSchedule)) ? 'no-print' : undefined} style={{ marginTop:10 }}>
              <div style={{ color:'#9fb0c6', marginBottom:6 }}>Payment Schedule</div>
              {projectType === 'New Construction' ? (
                <>
                  {includeUnderground ? <div style={{ display:'flex', justifyContent:'space-between' }}><div>30% (Underground)</div><div style={{ color:GOLD }}>{formatCurrency(schedule.underground)}</div></div> : null}
                  {includeRough ? <div style={{ display:'flex', justifyContent:'space-between' }}><div>50% (Rough-In)</div><div style={{ color:GOLD }}>{formatCurrency(schedule.rough)}</div></div> : null}
                  {includeTrim ? <div style={{ display:'flex', justifyContent:'space-between' }}><div>20% (Trim)</div><div style={{ color:GOLD }}>{formatCurrency(schedule.trim)}</div></div> : null}
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
              <button onClick={()=>setDocStatus('paid')} style={{ background:'#0f2740', color:'#fff', border:`1px solid ${GOLD}`, padding:8, borderRadius:6 }}>Mark Paid</button>
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
                      <button type='button' onClick={() => deleteDocument(doc.id)} style={{ background:'#7a0a0a', color:'#fff', border:`1px solid ${GOLD}`, padding:'6px 10px', borderRadius:6 }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className='no-print' style={{ marginTop:16, borderTop:`1px solid ${GOLD}`, paddingTop:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ color:'#9fb0c6' }}>Payment due upon receipt</div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={newNumber} style={{ background:'#0f2740', color:'#fff', border:`1px solid ${GOLD}`, padding:8, borderRadius:6 }}>New Number</button>
            <button onClick={printDoc} style={{ background:GOLD, color:NAVY, padding:8, borderRadius:6 }}>Print / PDF</button>
          </div> 
        </footer>
        </div>

        <div className='print-only'>
          <div className='print-document'>
            <div style={{backgroundColor:'#0a1628',padding:'32px 40px',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0'}}><div style={{color:'#c9a84c',fontSize:'32px',fontWeight:'900',letterSpacing:'2px'}}>{contractor}</div><div style={{textAlign:'right'}}><div style={{color:'rgba(255,255,255,0.7)',fontSize:'11px',letterSpacing:'3px'}}>{docType==='quote'?'QUOTE':'INVOICE'}</div><div style={{color:'white',fontSize:'28px',fontWeight:'bold'}}>{docNumber}</div></div></div>
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
                      <td>{houses} {fixtureType === 'Residential' ? 'house(s)' : 'unit(s)'} × {fixturesPerHouse} fixture(s) × {formatCurrency(pricePerFixture)}</td>
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
                          <td>30% Underground</td>
                          <td>{formatCurrency(phases.underground)}</td>
                        </tr>
                      ) : null}
                      {includeRough ? (
                        <tr>
                          <td>50% Rough-In</td>
                          <td>{formatCurrency(phases.rough)}</td>
                        </tr>
                      ) : null}
                      {includeTrim ? (
                        <tr>
                          <td>20% Trim</td>
                          <td>{formatCurrency(phases.trim)}</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                ) : null}
                {projectType === 'Service/Replacement' ? (
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

            <div className='print-footer'>
              <div>Payment due upon receipt</div>
              <div>{contractor}</div>
              <div style={{ fontSize:10, opacity:0.45, marginTop:6, letterSpacing:'0.5px' }}>Generated with FieldQuote</div>
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
