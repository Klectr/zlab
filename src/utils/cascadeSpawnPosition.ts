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
