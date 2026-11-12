import { onMount, ref, signal } from "kiru"
import { StickyNoteButton } from "./StickyNoteButton"
import { ImageCardButton } from "./ImageCardButton"
import { ExportButton } from "./ExportButton"
import { TextButton } from "./TextButton"
import { ImportButton } from "./ImportButton"
import { Divider } from "../Divider"
import { focusedItem } from "../../signals"

export function CardSelector() {
  const containerRef = ref<HTMLDivElement>(null)
  const centeredLeft = signal(window.innerWidth / 2)

  onMount(() => {
    const _updateCenteredLeft = () => {
      const width = containerRef.current?.getBoundingClientRect().width ?? 1
      centeredLeft.value = Math.max(0, window.innerWidth / 2 - width / 2)
    }
    _updateCenteredLeft()
    window.addEventListener("resize", _updateCenteredLeft)
    const container = containerRef.current
    const _toolbarButtons = () =>
      Array.from(container?.querySelectorAll("button") ?? [])
    const _setActiveButton = (index: number) => {
      _toolbarButtons().forEach((button, i) => {
        button.tabIndex = i === index ? 0 : -1
      })
    }
    _setActiveButton(0)
    const _handleFocusIn = (e: FocusEvent) => {
      const index = _toolbarButtons().indexOf(e.target as HTMLButtonElement)
      if (index >= 0) _setActiveButton(index)
    }
    const _handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const buttons = _toolbarButtons()
      const index = buttons.indexOf(e.target as HTMLButtonElement)
      if (index < 0) return
      let next: number | null = null
      if (e.key === "ArrowRight") next = (index + 1) % buttons.length
      else if (e.key === "ArrowLeft")
        next = (index - 1 + buttons.length) % buttons.length
      else if (e.key === "Home") next = 0
      else if (e.key === "End") next = buttons.length - 1
      if (next === null) return
      e.preventDefault()
      _setActiveButton(next)
      buttons[next].focus()
    }
    container?.addEventListener("focusin", _handleFocusIn)
    container?.addEventListener("keydown", _handleKeyDown)
    return () => {
      window.removeEventListener("resize", _updateCenteredLeft)
      container?.removeEventListener("focusin", _handleFocusIn)
      container?.removeEventListener("keydown", _handleKeyDown)
    }
  })

  return () => (
    <div
      role="toolbar"
      aria-label="Board tools"
      id="card-selector"
      ref={containerRef}
      onmousedown={(e: Kiru.MouseEvent<HTMLDivElement>) => {
        if (!(e.target as HTMLElement).closest("button")) focusedItem.value = null
      }}
      className="z-50 flex gap-1 border dark:border-[#5c5c5c] border-[#ddd] rounded-full fixed px-4 dark:bg-[#222] bg-[#eee] top-2 py-1 shadow-md"
      style={{
        left: `${centeredLeft.value}px`
      }}>
      <StickyNoteButton />
      <ImageCardButton />
      <TextButton />

      <Divider />

      <ExportButton />
      <ImportButton />
    </div>
  )
}
