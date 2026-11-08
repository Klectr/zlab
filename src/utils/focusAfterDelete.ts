export function moveFocusToToolbarAfterDelete(
  container: HTMLElement | null,
  clicked: HTMLElement | null,
  menuContainer?: HTMLElement | null
) {
  const active = document.activeElement as HTMLElement | null
  if (!active || active === document.body) return
  const insideContainer = !!container && container.contains(active)
  const insideMenu = !!menuContainer && menuContainer.contains(active)
  const isClicked = !!clicked && clicked === active
  if (!insideContainer && !insideMenu && !isClicked) return
  const target = document.querySelector<HTMLElement>("#card-selector button")
  target?.focus({ preventScroll: true })
}
