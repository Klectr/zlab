export const activeDragDisarmers = new Set<() => void>()

export function disarmActiveDrags() {
  for (const disarm of [...activeDragDisarmers]) disarm()
}
