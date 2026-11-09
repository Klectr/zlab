import notes from "../../signals/notes"
import texts from "../../signals/texts"
import images from "../../signals/images"

export const defaultClassName =
  "cursor-pointer w-5 h-5 text-[#9c9c9c] hover:text-blue-500 transition-color duration-300"

export function clickSpawnPoint(e: {
  pageX: number
  pageY: number
  clientX: number
  clientY: number
}) {
  if (e.pageX !== 0 || e.pageY !== 0 || e.clientX !== 0 || e.clientY !== 0)
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

export function cascadeSpawnPosition(
  base: { x: number; y: number },
  occupied: { x: number; y: number }[],
  max: { x: number; y: number }
) {
  const isOccupied = (x: number, y: number) =>
    occupied.some((p) => Math.abs(p.x - x) < 24 && Math.abs(p.y - y) < 24)
  for (let offset = 0; base.x + offset <= max.x && base.y + offset <= max.y; offset += 24) {
    if (!isOccupied(base.x + offset, base.y + offset))
      return { x: base.x + offset, y: base.y + offset }
  }
  for (let offset = -24; base.x + offset >= 0 && base.y + offset >= 0; offset -= 24) {
    if (!isOccupied(base.x + offset, base.y + offset))
      return { x: base.x + offset, y: base.y + offset }
  }
  return { x: base.x, y: base.y }
}
