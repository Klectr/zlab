import { effect, onMount, Portal, ref, signal, type Signal } from "kiru"
import { initMouseTracking, mouse } from "../utils/mouse"

interface ContextMenuPortalProps {
  children: JSX.Children
  open: Signal<boolean>
  closeAction: (() => void) | null | undefined
}

export function ContextMenuPortal({
  open,
  closeAction,
}: ContextMenuPortalProps) {
  initMouseTracking()
  const pos = signal({ x: 0, y: 0 })
  const elRef = ref<HTMLDivElement>(null)

  onMount(() => {
    function _handleClickOutside(e: Event) {
      if (!open.value) return
      const el = elRef.current
      if (!el) return
      if (e.target instanceof Node && el.contains(e.target)) return
      closeAction?.()
    }
    document.addEventListener("pointerdown", _handleClickOutside, true)
    document.addEventListener("click", _handleClickOutside, true)
    return () => {
      document.removeEventListener("pointerdown", _handleClickOutside, true)
      document.removeEventListener("click", _handleClickOutside, true)
    }
  })

  effect(() => {
    if (!open.value) return
    pos.value = { x: mouse.value.x, y: mouse.value.y }
    function _handleEscapeKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      closeAction?.()
    }
    document.addEventListener("keydown", _handleEscapeKey)
    return () => {
      document.removeEventListener("keydown", _handleEscapeKey)
    }
  })

  return ({ children }: ContextMenuPortalProps) => {
    if (!open.value) return null

    return (
      <Portal
        container={() => document.querySelector("#context-menu-portal")!}
      >
        <div
          ref={elRef}
          className="fixed z-10 select-none shadow-md rounded min-w-[150px]"
          style={{
            left: `${pos.value.x}px`,
            top: `${pos.value.y}px`,
            zIndex: `1000`,
          }}
        >
          {children}
        </div>
      </Portal>
    )
  }
}
