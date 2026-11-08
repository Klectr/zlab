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
      "input, textarea, select, [contenteditable], #context-menu-portal"
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
