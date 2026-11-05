import { effect, onMount, Portal, ref, signal, untrack, type Signal } from "kiru"
import { initMouseTracking, mouse } from "../utils/mouse"

const noopClick = () => {}

const closeHandlers = new Set<() => void>()

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
  const closeSelf = () => closeAction?.()

  onMount(() => {
    closeHandlers.add(closeSelf)
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
    function _handleContextMenuOutside(e: MouseEvent) {
      const el = elRef.current
      if (el && e.composedPath().includes(el)) return
      closeAction?.()
    }
    document.addEventListener("click", _handleClickOutside, {
      capture: true,
      passive: true,
    })
    document.addEventListener("contextmenu", _handleContextMenuOutside, {
      capture: true,
      passive: true,
    })
    document.addEventListener("pointerdown", _handlePointerDown, {
      passive: true,
    })
    const isIOS =
      /iP(ad|hone|od)/.test(window.navigator.userAgent) ||
      (window.navigator.maxTouchPoints > 2 &&
        /iPad|Macintosh/.test(window.navigator.userAgent))
    if (isIOS) {
      Array.from(document.body.children).forEach((child) =>
        child.addEventListener("click", noopClick)
      )
      document.documentElement.addEventListener("click", noopClick)
    }
    return () => {
      closeHandlers.delete(closeSelf)
      document.removeEventListener("click", _handleClickOutside, {
        capture: true,
      })
      document.removeEventListener("contextmenu", _handleContextMenuOutside, {
        capture: true,
      })
      document.removeEventListener("pointerdown", _handlePointerDown)
    }
  })

  effect(() => {
    if (!open.value) return
    for (const close of [...closeHandlers]) {
      if (close !== closeSelf) close()
    }
    pos.value = untrack(() => ({ x: mouse.value.x, y: mouse.value.y }))
    function _handleEscapeKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      closeAction?.()
    }
    document.addEventListener("keydown", _handleEscapeKey)
    const frame = requestAnimationFrame(() => {
      const el = elRef.current
      if (!el || !open.value) return
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return
      untrack(() => {
        const x = Math.min(pos.value.x, Math.max(0, window.innerWidth - rect.width))
        const y = Math.min(pos.value.y, Math.max(0, window.innerHeight - rect.height))
        if (x !== pos.value.x || y !== pos.value.y) pos.value = { x, y }
      })
    })
    return () => {
      document.removeEventListener("keydown", _handleEscapeKey)
      cancelAnimationFrame(frame)
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
