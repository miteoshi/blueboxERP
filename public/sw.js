// Blue Box ERP service worker: keeps the app opening with no connection.
//
// It saves two things, both only for this site:
//   - the app's own code (/_next/static), which never changes once built
//   - the page shell of each page the user opens, so it can be reopened
//
// It never touches data requests (those go to Supabase, another origin),
// never touches /api, and never saves anything but a successful GET.
// What was last loaded is kept by the app itself (see src/lib/offline).

const VERSION = 'v1'
const STATIC_CACHE = `bb-static-${VERSION}`
const PAGE_CACHE = `bb-pages-${VERSION}` // keep in step with src/lib/offline/storage.ts
const OFFLINE_URL = '/offline.html'
const STATIC_LIMIT = 400
const PAGE_LIMIT = 120
// A page opened by in-app navigation has its shell saved at most this often
const RESAVE_AFTER_MS = 30 * 60 * 1000
const savedAt = new Map()

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n.startsWith('bb-') && n !== STATIC_CACHE && n !== PAGE_CACHE).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  )
})

async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  // Oldest first; the offline page is never dropped
  const removable = keys.filter((k) => new URL(k.url).pathname !== OFFLINE_URL)
  for (let i = 0; i < removable.length - limit; i++) await cache.delete(removable[i])
}

// A page shell is worth keeping only if it is the page that was asked for:
// not an error, and not the sign-in page a signed-out request is sent to.
function isKeepablePage(response, pathname) {
  return response.ok && response.type === 'basic' && !response.redirected &&
    new URL(response.url).pathname === pathname &&
    (response.headers.get('content-type') || '').includes('text/html')
}

async function savePage(pathname, response) {
  const cache = await caches.open(PAGE_CACHE)
  await cache.put(pathname, response)
  savedAt.set(pathname, Date.now())
  await trim(PAGE_CACHE, PAGE_LIMIT)
}

// Moving between pages inside the app fetches data for the page, not the
// page itself, so its shell would never be saved. The app says which page
// is on screen (see offline-support.tsx) and the shell is fetched quietly.
async function savePageInBackground(pathname) {
  const cache = await caches.open(PAGE_CACHE)
  const recent = Date.now() - (savedAt.get(pathname) || 0) < RESAVE_AFTER_MS
  if (recent && (await cache.match(pathname))) return
  savedAt.set(pathname, Date.now())
  try {
    const response = await fetch(pathname, { credentials: 'same-origin', headers: { accept: 'text/html' } })
    if (isKeepablePage(response, pathname)) await savePage(pathname, response)
    else savedAt.delete(pathname)
  } catch {
    savedAt.delete(pathname)
  }
}

self.addEventListener('message', (event) => {
  const data = event.data || {}
  if (data.type !== 'save-page' || typeof data.pathname !== 'string') return
  // Only a path on this site, never a full address handed in from outside
  if (!data.pathname.startsWith('/') || data.pathname.startsWith('//') || data.pathname.startsWith('/api/')) return
  event.waitUntil(savePageInBackground(data.pathname))
})

async function openPage(request, pathname) {
  try {
    const response = await fetch(request)
    if (isKeepablePage(response, pathname)) await savePage(pathname, response.clone())
    return response
  } catch {
    const cache = await caches.open(PAGE_CACHE)
    const saved = await cache.match(pathname)
    if (saved) return saved
    const offline = await caches.match(OFFLINE_URL)
    return offline || new Response('You are offline.', { status: 503, headers: { 'content-type': 'text/plain' } })
  }
}

async function staticAsset(request) {
  const cache = await caches.open(STATIC_CACHE)
  const saved = await cache.match(request)
  if (saved) return saved
  const response = await fetch(request)
  if (response.ok && response.type === 'basic') {
    await cache.put(request, response.clone())
    trim(STATIC_CACHE, STATIC_LIMIT)
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(staticAsset(request))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(openPage(request, url.pathname))
    return
  }

  // Everything else, in-app navigation included, goes to the network
  // untouched. If that fails the app falls back to opening the page itself,
  // which openPage() answers from what was saved.
})
