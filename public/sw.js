const CACHE_NAME = "zlab-v38"

async function isHtmlForAsset(pathname, response) {
  let contentType = ""
  try {
    contentType = response.headers?.get?.("content-type") ?? ""
  } catch {}
  if (contentType.includes("text/html")) return true
  if (pathname.endsWith(".css") && contentType.includes("text/css")) return false
  if (pathname.endsWith(".woff2") && (contentType.includes("font") || contentType.includes("woff2"))) return false
  if (pathname.endsWith(".js") && contentType.includes("javascript")) return false
  if (pathname.endsWith(".png") && contentType.includes("image/png")) return false
  if (pathname.endsWith(".webmanifest") && (contentType.includes("manifest") || contentType.includes("json"))) return false
  try {
    const text = await response.clone().text()
    const start = text.replace(/^\uFEFF/, "").trimStart().toLowerCase()
    return start.startsWith("<!doctype html") || start.startsWith("<html") || start.startsWith("<head")
  } catch {
    return false
  }
}

function offlinePageResponse() {
  return new Response(
    "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"color-scheme\" content=\"light dark\"><title>Zlab offline</title><style>@media (prefers-color-scheme: dark){body{background:#000;color:#fff}}</style></head><body><h1>Zlab is offline</h1><p>Reconnect and reload to open your board.</p></body></html>",
    { status: 503, headers: { "content-type": "text/html" } }
  )
}
async function matchOwnCache(request) {
  try {
    const cache = await caches.open(CACHE_NAME)
    return await cache.match(request)
  } catch {
    return undefined
  }
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
        if (fetched.ok && !(await isHtmlForAsset(asset, fetched))) css = await fetched.text()
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
      let derivedMissing = false
      for (const ref of newCss.refs) {
        if (!(await cache.match(ref))) derivedMissing = true
      }
      if (derivedMissing) {
        for (const ref of staleCss.refs) keep.add(ref)
      }
    }
    try {
      const current = await cache.match("/index.html")
      const currentHtml = current ? await current.text() : ""
      if (currentHtml) {
        const currentRefs = assetRefs(currentHtml)
        for (const ref of currentRefs) keep.add(ref)
        const currentCss = await cssRefs(cache, currentRefs)
        for (const ref of currentCss.refs) keep.add(ref)
      }
    } catch {}
    await Promise.all(
      [...stale]
        .filter((path) => !keep.has(path))
        .map((path) => cache.delete(path))
    )
  } catch {}
}

function shellResponseInit(response) {
  const headers = {}
  try {
    if (typeof response?.headers?.forEach === "function") {
      response.headers.forEach((value, key) => {
        headers[key] = value
      })
    } else {
      const contentType = response?.headers?.get?.("content-type")
      if (contentType) headers["content-type"] = contentType
    }
  } catch {}
  if (!headers["content-type"]) headers["content-type"] = "text/html"
  const init = { headers }
  try {
    if (response?.status) init.status = response.status
    if (response?.statusText) init.statusText = response.statusText
  } catch {}
  return init
}

async function restoreShellPair(cache, previousHtml, newHtml, previousInit) {
  let currentHtml
  try {
    const current = await cache.match("/index.html")
    currentHtml = current ? await current.text() : ""
  } catch {
    return
  }
  if (currentHtml !== previousHtml && currentHtml !== newHtml) return
  if (previousHtml) {
    const init = previousInit ?? { headers: { "content-type": "text/html" } }
    let restored = true
    try {
      await cache.put("/index.html", new Response(previousHtml, init))
    } catch {
      restored = false
    }
    try {
      await cache.put("/", new Response(previousHtml, init))
    } catch {
      restored = false
    }
    if (!restored) {
      try {
        await cache.delete("/index.html")
      } catch {}
      try {
        await cache.delete("/")
      } catch {}
    }
  } else {
    try {
      await cache.delete("/index.html")
    } catch {}
    try {
      await cache.delete("/")
    } catch {}
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const stagingName = CACHE_NAME + "-staging"
      await caches.delete(stagingName).catch(() => {})
      const staging = await caches.open(stagingName)
      let newHtml = ""
      try {
        await staging.addAll(APP_SHELL)
        await Promise.all(
          OPTIONAL_SHELL.map(async (u) => {
            await staging.add(u).catch(() => {})
            const staged = await staging.match(u).catch(() => undefined)
            if (staged && (await isHtmlForAsset(u, staged)))
              await staging.delete(u).catch(() => {})
          })
        )
        const shell = await staging.match("/index.html")
        newHtml = shell ? await shell.text() : ""
        const assets = [...assetRefs(newHtml)]
        if (assets.length === 0) throw new Error("shell has no bundle assets")
        const root = await staging.match("/")
        const rootHtml = root ? await root.text() : ""
        if (rootHtml && rootHtml !== newHtml)
          throw new Error("root shell differs from index shell")
        await Promise.all(assets.map((a) => staging.add(a)))
        for (const asset of assets) {
          const staged = await staging.match(asset)
          if (staged && (await isHtmlForAsset(asset, staged)))
            throw new Error("asset served as html: " + asset)
        }
        try {
          for (const asset of assets.filter((a) => a.endsWith(".css"))) {
            const cssResponse = await staging.match(asset)
            const css = cssResponse ? await cssResponse.text() : ""
            const refs = [
              ...new Set(
                [...css.matchAll(/url\(["']?(\/assets\/[^)"']+)["']?\)/g)].map((m) => m[1])
              ),
            ]
            await Promise.all(
              refs.map(async (r) => {
                await staging.add(r).catch(() => {})
                const stagedRef = await staging.match(r).catch(() => undefined)
                if (stagedRef && (await isHtmlForAsset(r, stagedRef)))
                  await staging.delete(r).catch(() => {})
              })
            )
          }
        } catch {}
      } catch (err) {
        await caches.delete(stagingName).catch(() => {})
        throw err
      }
      const live = await caches.open(CACHE_NAME)
      let previousHtml = ""
      let previousInit
      try {
        const previous = await live.match("/index.html")
        previousHtml = previous ? await previous.text() : ""
        if (previous) previousInit = shellResponseInit(previous)
      } catch {}
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
      try {
        for (const request of ordered) {
          const response = await staging.match(request)
          if (response) await live.put(request, response)
        }
      } catch (err) {
        await restoreShellPair(live, previousHtml, newHtml, previousInit)
        await caches.delete(stagingName).catch(() => {})
        throw err
      }
      await caches.delete(stagingName).catch(() => {})
      await pruneSupersededAssets(previousHtml, newHtml)
      await self.skipWaiting().catch(() => {})
    })()
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys()
        await Promise.all(
          keys
            .filter(
              (key) =>
                key !== CACHE_NAME &&
                new RegExp("^" + CACHE_NAME.replace(/\d+$/, "") + "\\d+$").test(key) &&
                !key.endsWith("-staging")
            )
            .map((key) => caches.delete(key).catch(() => {}))
        )
      } catch {}
      try {
        const keys = await caches.keys()
        const prefix = CACHE_NAME.replace(/\d+$/, "")
        const currentVersion = Number(CACHE_NAME.match(/\d+$/)?.[0] ?? 0)
        const stagingPattern = new RegExp("^" + prefix + "(\\d+)-staging$")
        await Promise.all(
          keys
            .filter((key) => {
              const match = stagingPattern.exec(key)
              return match !== null && Number(match[1]) < currentVersion
            })
            .map((key) => caches.delete(key).catch(() => {}))
        )
      } catch {}
      await self.clients.claim().catch(() => {})
    })()
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
        .then(async (response) => {
          if (!response.ok) {
            if (response.type === "opaqueredirect") return response
            const cachedExact = await matchOwnCache(request)
            if (cachedExact) return cachedExact
            const cachedShell = await matchOwnCache("/index.html")
            if (cachedShell) return cachedShell
            return response
          }
          const contentType = response.headers.get("content-type") ?? ""
          let isShellPath = false
          try {
            const finalPath = new URL(response.url || request.url).pathname
            isShellPath = finalPath === "/" || finalPath === "/index.html"
          } catch {}
          if (response.ok && !isShellPath && response.type !== "opaqueredirect") {
            const copy = response.clone()
            const put = (async () => {
              if (await isHtmlForAsset(url.pathname, response)) return
              const cache = await caches.open(CACHE_NAME)
              await cache.put(request, copy)
            })().catch(() => {})
            try {
              event.waitUntil(put)
            } catch {}
          }
          if (response.ok && isShellPath && contentType.includes("text/html")) {
            const copy = response.clone()
            const rootCopy = response.clone()
            const textCopy = response.clone()
            const lifetime = (async () => {
              let previousHtml = ""
              let previousInit
              let newHtml = ""
              try {
                newHtml = await textCopy.text()
                const cache = await caches.open(CACHE_NAME)
                const previous = await cache.match("/index.html")
                previousHtml = previous ? await previous.text() : ""
                if (previous) previousInit = shellResponseInit(previous)
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
                    const fetched = await fetch(ref)
                    if (!fetched.ok || (await isHtmlForAsset(ref, fetched))) {
                      assetsOk = false
                    } else {
                      await cache.put(ref, fetched)
                    }
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
                      try {
                        const fetched = await fetch(ref)
                        if (fetched.ok && !(await isHtmlForAsset(ref, fetched)))
                          await cache.put(ref, fetched)
                      } catch {}
                    })
                  )
                } catch {}
              }
              if (!assetsOk) return
              let shellOk = false
              try {
                const cache = await caches.open(CACHE_NAME)
                const current = await cache.match("/index.html")
                const currentHtml = current ? await current.text() : ""
                if (currentHtml !== previousHtml) return
                try {
                  await cache.put("/index.html", copy)
                  await cache.put("/", rootCopy)
                  shellOk = true
                } catch {
                  await restoreShellPair(cache, previousHtml, newHtml, previousInit)
                }
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
        .catch(async () => (await matchOwnCache(request)) ?? (await matchOwnCache("/index.html")) ?? offlinePageResponse())
    )
    return
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      matchOwnCache(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              const put = (async () => {
                if (await isHtmlForAsset(url.pathname, response)) return
                const cache = await caches.open(CACHE_NAME)
                await cache.put(request, copy)
              })().catch(() => {})
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
          const put = (async () => {
            if (await isHtmlForAsset(url.pathname, response)) return
            const cache = await caches.open(CACHE_NAME)
            await cache.put(request, copy)
          })().catch(() => {})
          try {
            event.waitUntil(put)
          } catch {}
        }
        return response
      })
      .catch(async () => (await matchOwnCache(request)) ?? Response.error())
  )
})
