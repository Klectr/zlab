export function moveFocusToToolbarAfterDelete(
  container: HTMLElement | null,
  clicked: HTMLElement | null
) {
  const active = document.activeElement as HTMLElement | null
  if (!active || active === document.body) return
  const insideContainer = !!container && container.contains(active)
  const isClicked = !!clicked && clicked === active
  if (!insideContainer && !isClicked) return
  const target = document.querySelector<HTMLElement>("#card-selector button")
  target?.focus({ preventScroll: true })
}
