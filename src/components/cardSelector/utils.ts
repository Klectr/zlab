import notes from "../../signals/notes"
import texts from "../../signals/texts"
import images from "../../signals/images"

export const defaultClassName =
  "cursor-pointer w-5 h-5 text-[#767676] dark:text-[#9c9c9c] hover:text-blue-500 transition-color duration-300"

export function clickSpawnPoint(e: {
  pageX: number
  pageY: number
  clientX: number
  clientY: number
}) {
  if (e.clientX !== 0 || e.clientY !== 0)
    return { pageX: e.pageX, pageY: e.pageY }
  return {
    pageX: window.scrollX + window.innerWidth / 2,
    pageY: window.scrollY,
  }
}

export function allCardPositions() {
  return [
    ...Object.values(notes.notes.value),
    ...Object.values(texts.texts.value),
    ...Object.values(images.images.value),
  ].map((card) => card.position)
}

export { cascadeSpawnPosition } from "../../utils/cascadeSpawnPosition"

export function clampSpawnToViewport(
  position: { x: number; y: number },
  base: { x: number; y: number },
  w: number,
  h: number,
  max: { x: number; y: number }
) {
  const viewportW = document.documentElement.clientWidth || window.innerWidth
  const viewportH = document.documentElement.clientHeight || window.innerHeight
  const viewLeft = window.scrollX
  const viewTop = window.scrollY
  const loX = Math.min(viewLeft, base.x)
  const hiX = Math.max(viewLeft + viewportW - w, base.x)
  const loY = Math.min(viewTop, base.y)
  const hiY = Math.max(viewTop + viewportH - h, base.y)
  const x = Math.min(Math.max(position.x, loX), hiX)
  const y = Math.min(Math.max(position.y, loY), hiY)
  return { x: Math.min(x, max.x), y: Math.min(y, max.y) }
}
