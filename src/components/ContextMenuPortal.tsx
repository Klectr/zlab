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
    let pointerStartedOutside = true
    function _handlePointerDown(e: PointerEvent) {
      const el = elRef.current
      pointerStartedOutside = !!el && !e.composedPath().includes(el)
    }
    function _handleClickOutside(e: MouseEvent) {
      const el = elRef.current
      if (!el || e.target === el || e.composedPath().includes(el)) return
      if (e.detail === 0) pointerStartedOutside = true
      if (!pointerStartedOutside) {
        pointerStartedOutside = true
        return
      }
      closeAction?.()
    }
    document.addEventListener("click", _handleClickOutside, {
      capture: true,
      passive: true,
    })
    document.addEventListener("pointerdown", _handlePointerDown, {
      passive: true,
    })
    return () => {
      document.removeEventListener("click", _handleClickOutside, {
        capture: true,
      })
      document.removeEventListener("pointerdown", _handlePointerDown)
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
