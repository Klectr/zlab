export function findMinimapMarker(itemKey: string): HTMLElement | null {
  for (const el of document.querySelectorAll("[data-minimap-card]")) {
    if (el.getAttribute("data-minimap-card") === itemKey) return el as HTMLElement
  }
  return null
}

export function moveFocusToToolbarAfterDelete(
  container: HTMLElement | null,
  clicked: HTMLElement | null,
  menuContainer?: HTMLElement | null,
  marker?: HTMLElement | null
) {
  const active = document.activeElement as HTMLElement | null
  if (!active || active === document.body) return
  const insideContainer = !!container && container.contains(active)
  const insideMenu = !!menuContainer && menuContainer.contains(active)
  const isMarker = !!marker && marker === active
  const isClicked = !!clicked && clicked === active
  if (!insideContainer && !insideMenu && !isMarker && !isClicked) return
  const target = document.querySelector<HTMLElement>("#card-selector button")
  target?.focus({ preventScroll: true })
}
