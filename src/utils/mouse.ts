import { signal } from "kiru"

export const mouse = signal({ x: 0, y: 0 })

let tracking = false

export function initMouseTracking() {
  if (tracking) return
  tracking = true
  window.addEventListener(
    "mousemove",
    (e: MouseEvent) => {
      mouse.value = { x: e.clientX, y: e.clientY }
    },
    { passive: true }
  )
}
