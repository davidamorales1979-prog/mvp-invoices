const CACHE = 'fieldquote-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  // Skip Supabase, Stripe, and other external API calls
  if (url.origin !== self.location.origin) return

  e.respondWith(
    caches.open(CACHE).then(async cache => {
      // Network-first for HTML navigations so updates are picked up immediately
      if (request.mode === 'navigate') {
        try {
          const fresh = await fetch(request)
          cache.put(request, fresh.clone())
          return fresh
        } catch {
          return (await cache.match('/')) || (await cache.match(request))
        }
      }
      // Cache-first for static assets (JS/CSS bundles have content hashes)
      const cached = await cache.match(request)
      if (cached) return cached
      try {
        const fresh = await fetch(request)
        if (fresh.ok) cache.put(request, fresh.clone())
        return fresh
      } catch {
        return new Response('Offline', { status: 503, statusText: 'Offline' })
      }
    })
  )
})
