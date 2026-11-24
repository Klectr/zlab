export const activeDragDisarmers = new Set<() => void>()

export function disarmActiveDrags() {
  for (const disarm of [...activeDragDisarmers]) disarm()
}

export const activeDragChecks = new Set<() => boolean>()

export function isAnyDragArmed() {
  for (const check of activeDragChecks) if (check()) return true
  return false
}
