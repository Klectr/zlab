import { onMount, ref, signal } from "kiru"
import { StickyNoteButton } from "./StickyNoteButton"
import { ImageCardButton } from "./ImageCardButton"
import { ExportButton } from "./ExportButton"
import { TextButton } from "./TextButton"
import { ImportButton } from "./ImportButton"
import { Divider } from "../Divider"

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
    return () => window.removeEventListener("resize", _updateCenteredLeft)
  })

  return () => (
    <div
      role="toolbar"
      aria-label="Board tools"
      id="card-selector"
      ref={containerRef}
      className="z-50 flex gap-1 border dark:border-[#3c3c3c] border-[#ddd] rounded-full fixed px-4 dark:bg-[#222] bg-[#eee] top-2 py-1 shadow-md"
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
