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
  const ready = signal(false)
  const elRef = ref<HTMLDivElement>(null)
  const closeSelf = () => closeAction?.()

  onMount(() => {
    closeHandlers.add(closeSelf)
    let pointerStartedOutside = true
    function _handlePointerDown(e: PointerEvent) {
      const el = elRef.current
      pointerStartedOutside = !!el && !e.composedPath().includes(el)
      if (el && pointerStartedOutside) closeAction?.()
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
      if (el && e.composedPath().includes(el)) {
        e.preventDefault()
        return
      }
      closeAction?.()
    }
    document.addEventListener("click", _handleClickOutside, {
      capture: true,
      passive: true,
    })
    document.addEventListener("contextmenu", _handleContextMenuOutside, {
      capture: true,
      passive: false,
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
    if (!open.value) {
      ready.value = false
      return
    }
    for (const close of [...closeHandlers]) {
      if (close !== closeSelf) close()
    }
    pos.value = untrack(() => ({ x: mouse.value.x, y: mouse.value.y }))
    const previouslyFocused = document.activeElement as HTMLElement | null
    function _handleMenuKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeAction?.()
        return
      }
      if (
        e.key !== "ArrowDown" &&
        e.key !== "ArrowUp" &&
        e.key !== "Home" &&
        e.key !== "End"
      )
        return
      const el = elRef.current
      if (!el) return
      const active = document.activeElement as HTMLElement | null
      if (!active || !el.contains(active)) return
      const items = Array.from(el.querySelectorAll("button"))
      if (items.length === 0) return
      e.preventDefault()
      const idx = items.indexOf(active as HTMLButtonElement)
      let next: number
      if (e.key === "Home") next = 0
      else if (e.key === "End") next = items.length - 1
      else if (e.key === "ArrowDown")
        next = idx < 0 ? 0 : (idx + 1) % items.length
      else next = idx < 0 ? items.length - 1 : (idx - 1 + items.length) % items.length
      items[next].focus({ preventScroll: true })
    }
    function _handleViewportChange() {
      closeAction?.()
    }
    function _handleFocusIn(e: FocusEvent) {
      const el = elRef.current
      if (!el) return
      const target = e.target as HTMLElement | null
      if (target && el.contains(target)) return
      if (target?.closest?.("#context-menu-portal")) return
      closeAction?.()
    }
    document.addEventListener("keydown", _handleMenuKey)
    document.addEventListener("focusin", _handleFocusIn)
    window.addEventListener("scroll", _handleViewportChange, {
      capture: true,
      passive: true,
    })
    window.addEventListener("resize", _handleViewportChange)
    window.addEventListener("blur", _handleViewportChange)
    const frame = requestAnimationFrame(() => {
      const el = elRef.current
      if (!el || !open.value) return
      el.focus({ preventScroll: true })
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) {
        ready.value = true
        return
      }
      untrack(() => {
        const x = Math.min(pos.value.x, Math.max(0, window.innerWidth - rect.width))
        const y = Math.min(pos.value.y, Math.max(0, window.innerHeight - rect.height))
        if (x !== pos.value.x || y !== pos.value.y) pos.value = { x, y }
      })
      ready.value = true
    })
    return () => {
      document.removeEventListener("keydown", _handleMenuKey)
      document.removeEventListener("focusin", _handleFocusIn)
      window.removeEventListener("scroll", _handleViewportChange, {
        capture: true,
      })
      window.removeEventListener("resize", _handleViewportChange)
      window.removeEventListener("blur", _handleViewportChange)
      cancelAnimationFrame(frame)
      const active = document.activeElement as HTMLElement | null
      const activeInPortal =
        !!active &&
        (!!elRef.current?.contains(active) ||
          !!active.closest?.("#context-menu-portal"))
      const activeIsBody = !active || active === document.body
      if (
        previouslyFocused &&
        previouslyFocused !== active &&
        document.contains(previouslyFocused) &&
        !previouslyFocused.closest("#context-menu-portal") &&
        (activeInPortal || activeIsBody)
      ) {
        previouslyFocused.focus({ preventScroll: true })
      }
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
          role="menu"
          tabIndex={-1}
          className="fixed z-10 select-none shadow-md rounded min-w-[150px]"
          style={{
            left: `${pos.value.x}px`,
            top: `${pos.value.y}px`,
            zIndex: `1000`,
            opacity: ready.value ? "1" : "0",
            pointerEvents: ready.value ? "auto" : "none",
          }}
        >
          {children}
        </div>
      </Portal>
    )
  }
}
