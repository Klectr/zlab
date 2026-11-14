export function arrowKeyMovePosition(
  e: KeyboardEvent,
  position: { x: number; y: number },
  dimensions: { w: number; h: number },
  canvas: { width: number; height: number }
): { x: number; y: number } | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null
  const step = e.shiftKey ? 50 : 10
  let dx = 0
  let dy = 0
  switch (e.key) {
    case "ArrowLeft":
      dx = -step
      break
    case "ArrowRight":
      dx = step
      break
    case "ArrowUp":
      dy = -step
      break
    case "ArrowDown":
      dy = step
      break
    default:
      return null
  }
  const target = e.target as HTMLElement | null
  if (!target || typeof target.closest !== "function") return null
  if (
    target.closest(
      "input, textarea, select, [contenteditable], .cm-editor, #context-menu-portal"
    )
  )
    return null
  return {
    x: Math.min(
      Math.max(0, position.x + dx),
      Math.max(0, canvas.width - dimensions.w)
    ),
    y: Math.min(
      Math.max(0, position.y + dy),
      Math.max(0, canvas.height - dimensions.h)
    ),
  }
}

function _arrowResizeDelta(e: KeyboardEvent): { dw: number; dh: number } | null {
  if (!e.altKey || e.ctrlKey || e.metaKey) return null
  const step = e.shiftKey ? 50 : 10
  let dw = 0
  let dh = 0
  switch (e.key) {
    case "ArrowLeft":
      dw = -step
      break
    case "ArrowRight":
      dw = step
      break
    case "ArrowUp":
      dh = -step
      break
    case "ArrowDown":
      dh = step
      break
    default:
      return null
  }
  const target = e.target as HTMLElement | null
  if (!target || typeof target.closest !== "function") return null
  if (
    target.closest(
      "input, textarea, select, [contenteditable], .cm-editor, #context-menu-portal"
    )
  )
    return null
  return { dw, dh }
}

export function arrowKeyResizeDimensions(
  e: KeyboardEvent,
  dimensions: { w: number; h: number },
  position: { x: number; y: number },
  canvas: { width: number; height: number }
): { w: number; h: number } | null {
  const delta = _arrowResizeDelta(e)
  if (!delta) return null
  const availW = canvas.width - position.x
  const availH = canvas.height - position.y
  return {
    w: Math.max(Math.min(100, availW), Math.min(dimensions.w + delta.dw, availW)),
    h: Math.max(Math.min(80, availH), Math.min(dimensions.h + delta.dh, availH)),
  }
}

export function arrowKeyResizeFontSize(
  e: KeyboardEvent,
  fontSize: number,
  dimensions: { w: number; h: number },
  position: { x: number; y: number },
  canvas: { width: number; height: number }
): number | null {
  const delta = _arrowResizeDelta(e)
  if (!delta) return null
  const step = delta.dw !== 0 ? delta.dw : delta.dh
  const scaleCap = Math.min(
    dimensions.w > 0 ? (canvas.width - position.x) / dimensions.w : Infinity,
    dimensions.h > 0 ? (canvas.height - position.y) / dimensions.h : Infinity
  )
  const fontCap = Math.floor(fontSize * scaleCap)
  const candidate = Math.floor(fontSize + step)
  return Math.max(fontCap >= 10 ? 10 : Math.max(1, fontCap), Math.min(candidate, fontCap))
}

export function scrollCardIntoView(
  position: { x: number; y: number },
  dimensions: { w: number; h: number }
) {
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight
  let left = window.scrollX
  let top = window.scrollY
  if (dimensions.w > viewportWidth) left = position.x
  else if (position.x < left) left = position.x
  else if (position.x + dimensions.w > left + viewportWidth)
    left = position.x + dimensions.w - viewportWidth
  if (dimensions.h > viewportHeight) top = position.y
  else if (position.y < top) top = position.y
  else if (position.y + dimensions.h > top + viewportHeight)
    top = position.y + dimensions.h - viewportHeight
  if (left === window.scrollX && top === window.scrollY) return
  window.scrollTo({ left: Math.max(0, left), top: Math.max(0, top) })
}
