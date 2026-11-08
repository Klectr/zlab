const CACHE_NAME = "zlab-v6"
const APP_SHELL = ["/", "/index.html"]
const OPTIONAL_SHELL = ["/manifest.webmanifest"]

function assetRefs(html) {
  return new Set(
    [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1])
  )
}

async function cssRefs(cache, refs, fetchMissing = false) {
  const found = new Set()
  let missing = false
  for (const asset of [...refs].filter((a) => a.endsWith(".css"))) {
    const cssResponse = await cache.match(asset)
    let css = cssResponse ? await cssResponse.text() : ""
    if (!cssResponse && fetchMissing) {
      try {
        const fetched = await fetch(asset)
        if (fetched.ok) css = await fetched.text()
      } catch {}
    }
    if (!css) missing = true
    for (const ref of css.matchAll(/url\(["']?(\/assets\/[^)"']+)["']?\)/g)) {
      found.add(ref[1])
    }
  }
  return { refs: found, missing }
}

async function pruneSupersededAssets(previousHtml, newHtml) {
  try {
    const cache = await caches.open(CACHE_NAME)
    const keep = assetRefs(newHtml)
    const newCss = await cssRefs(cache, keep, true)
    for (const ref of newCss.refs) keep.add(ref)
    const stale = assetRefs(previousHtml)
    if (!newCss.missing) {
      const staleCss = await cssRefs(cache, stale)
      for (const ref of staleCss.refs) stale.add(ref)
    }
    await Promise.all(
      [...stale]
        .filter((path) => !keep.has(path))
        .map((path) => cache.delete(path))
    )
  } catch {}
}

async function pruneStaleAssets() {
  try {
    const cache = await caches.open(CACHE_NAME)
    const shell = await cache.match("/index.html")
    const html = shell ? await shell.text() : ""
    const keep = assetRefs(html)
    if (keep.size === 0) return
    const { refs: keepCssRefs } = await cssRefs(cache, keep)
    for (const ref of keepCssRefs) keep.add(ref)
    const requests = await cache.keys()
    await Promise.all(
      requests
        .filter((request) => {
          const path = new URL(request.url).pathname
          return path.startsWith("/assets/") && !keep.has(path)
        })
        .map((request) => cache.delete(request))
    )
  } catch {}
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(APP_SHELL)
        await Promise.all(OPTIONAL_SHELL.map((u) => cache.add(u).catch(() => {})))
        try {
          const shell = await cache.match("/index.html")
          const html = shell ? await shell.text() : ""
          const assets = [...assetRefs(html)]
          await Promise.all(assets.map((a) => cache.add(a).catch(() => {})))
          for (const asset of assets.filter((a) => a.endsWith(".css"))) {
            const cssResponse = await cache.match(asset)
            const css = cssResponse ? await cssResponse.text() : ""
            const refs = [
              ...new Set(
                [...css.matchAll(/url\(["']?(\/assets\/[^)"']+)["']?\)/g)].map((m) => m[1])
              ),
            ]
            await Promise.all(refs.map((r) => cache.add(r).catch(() => {})))
          }
        } catch {}
      })
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => pruneStaleAssets())
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const contentType = response.headers.get("content-type") ?? ""
          if (response.ok && contentType.includes("text/html")) {
            const copy = response.clone()
            const textCopy = response.clone()
            const lifetime = (async () => {
              let previousHtml = ""
              let newHtml = ""
              try {
                newHtml = await textCopy.text()
                const cache = await caches.open(CACHE_NAME)
                const previous = await cache.match("/index.html")
                previousHtml = previous ? await previous.text() : ""
              } catch {}
              try {
                const cache = await caches.open(CACHE_NAME)
                await cache.put("/index.html", copy)
              } catch {}
              if (newHtml) {
                const previousRefs = assetRefs(previousHtml)
                const newRefs = assetRefs(newHtml)
                const changed =
                  previousRefs.size !== newRefs.size ||
                  [...newRefs].some((ref) => !previousRefs.has(ref))
                if (changed) await pruneSupersededAssets(previousHtml, newHtml)
              }
            })()
            try {
              event.waitUntil(lifetime)
            } catch {}
          }
          return response
        })
        .catch(() => caches.match("/index.html"))
    )
    return
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
            }
            return response
          })
      )
    )
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(() => caches.match(request))
  )
})
