const CACHE_NAME = "zlab-v13"

function offlinePageResponse() {
  return new Response(
    "<!doctype html><html><head><meta charset=\"utf-8\"><title>Zlab offline</title></head><body><h1>Zlab is offline</h1><p>Reconnect and reload to open your board.</p></body></html>",
    { status: 503, headers: { "content-type": "text/html" } }
  )
}
const APP_SHELL = ["/", "/index.html"]
const OPTIONAL_SHELL = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
]

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
    if (keep.size === 0) return
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
    (async () => {
      const stagingName = CACHE_NAME + "-staging"
      await caches.delete(stagingName).catch(() => {})
      const staging = await caches.open(stagingName)
      try {
        await staging.addAll(APP_SHELL)
        await Promise.all(OPTIONAL_SHELL.map((u) => staging.add(u).catch(() => {})))
        const shell = await staging.match("/index.html")
        const html = shell ? await shell.text() : ""
        const assets = [...assetRefs(html)]
        await Promise.all(assets.map((a) => staging.add(a)))
        try {
          for (const asset of assets.filter((a) => a.endsWith(".css"))) {
            const cssResponse = await staging.match(asset)
            const css = cssResponse ? await cssResponse.text() : ""
            const refs = [
              ...new Set(
                [...css.matchAll(/url\(["']?(\/assets\/[^)"']+)["']?\)/g)].map((m) => m[1])
              ),
            ]
            await Promise.all(refs.map((r) => staging.add(r).catch(() => {})))
          }
        } catch {}
      } catch (err) {
        await caches.delete(stagingName).catch(() => {})
        throw err
      }
      const live = await caches.open(CACHE_NAME)
      const requests = await staging.keys()
      const isShellEntry = (request) => {
        try {
          const path = new URL(request.url).pathname
          return path === "/" || path === "/index.html"
        } catch {
          return false
        }
      }
      const ordered = [...requests].sort(
        (a, b) => Number(isShellEntry(a)) - Number(isShellEntry(b))
      )
      for (const request of ordered) {
        const response = await staging.match(request)
        if (response) await live.put(request, response)
      }
      await caches.delete(stagingName).catch(() => {})
      await self.skipWaiting()
    })()
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
          let isShellPath = false
          try {
            const finalPath = new URL(response.url || request.url).pathname
            isShellPath = finalPath === "/" || finalPath === "/index.html"
          } catch {}
          if (response.ok && isShellPath && contentType.includes("text/html")) {
            const copy = response.clone()
            const rootCopy = response.clone()
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
              if (!newHtml) return
              const newRefs = assetRefs(newHtml)
              if (newRefs.size === 0) return
              let assetsOk = true
              try {
                const cache = await caches.open(CACHE_NAME)
                for (const ref of newRefs) {
                  if (await cache.match(ref)) continue
                  try {
                    await cache.add(ref)
                  } catch {
                    assetsOk = false
                  }
                }
              } catch {
                assetsOk = false
              }
              if (assetsOk) {
                try {
                  const cache = await caches.open(CACHE_NAME)
                  const { refs: derived } = await cssRefs(cache, newRefs)
                  await Promise.all(
                    [...derived].map(async (ref) => {
                      if (await cache.match(ref)) return
                      await cache.add(ref).catch(() => {})
                    })
                  )
                } catch {}
              }
              if (!assetsOk) return
              let shellOk = false
              try {
                const cache = await caches.open(CACHE_NAME)
                await cache.put("/index.html", copy)
                await cache.put("/", rootCopy)
                shellOk = true
              } catch {}
              const previousRefs = assetRefs(previousHtml)
              const changed =
                previousRefs.size !== newRefs.size ||
                [...newRefs].some((ref) => !previousRefs.has(ref))
              if (changed && shellOk) await pruneSupersededAssets(previousHtml, newHtml)
            })()
            try {
              event.waitUntil(lifetime)
            } catch {}
          }
          return response
        })
        .catch(async () => (await caches.match("/index.html")) ?? offlinePageResponse())
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
              const put = caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, copy))
                .catch(() => {})
              try {
                event.waitUntil(put)
              } catch {}
            }
            return response
          }).catch(() => Response.error())
      )
    )
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          const put = caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, copy))
            .catch(() => {})
          try {
            event.waitUntil(put)
          } catch {}
        }
        return response
      })
      .catch(async () => (await caches.match(request)) ?? Response.error())
  )
})
