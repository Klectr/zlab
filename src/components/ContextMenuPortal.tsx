import { effect, onMount, Portal, ref, signal, untrack, type Signal } from "kiru"
import { initMouseTracking, mouse } from "../utils/mouse"

const noopClick = () => {}

function eventMenuTriggerId(e: Event): string | null {
  const t = e.target as HTMLElement | null
  if (t && typeof t.closest === "function") {
    const el = t.closest("[data-menu-trigger]")
    if (el) return el.getAttribute("data-menu-trigger")
  }
  if (typeof e.composedPath === "function") {
    for (const n of e.composedPath()) {
      if (n instanceof Element && n.hasAttribute("data-menu-trigger"))
        return n.getAttribute("data-menu-trigger")
    }
  }
  return null
}

function eventHitsOwnMenuTrigger(e: Event, menuId: string | undefined): boolean {
  const id = eventMenuTriggerId(e)
  if (id === null) return false
  if (menuId === undefined) return true
  return id === menuId
}

const closeHandlers = new Set<() => void>()

const openPortals = new Set<Signal<boolean>>()

let lastMenuRestore: { menuId: string | undefined; target: HTMLElement } | null =
  null
let lastMenuRestoreAt = 0

export function isAnyContextMenuOpen(): boolean {
  return openPortals.size > 0
}

const pendingItemFocus = new Map<string | undefined, "first" | "last">()

export function requestMenuItemFocus(
  menuId: string | undefined,
  which: "first" | "last"
) {
  pendingItemFocus.set(menuId, which)
}

interface ContextMenuPortalProps {
  children: JSX.Children
  open: Signal<boolean>
  closeAction: (() => void) | null | undefined
  label?: string
  menuId?: string
}

export function ContextMenuPortal({
  open,
  closeAction,
  menuId,
}: ContextMenuPortalProps) {
  initMouseTracking()
  const pos = signal({ x: 0, y: 0 })
  const ready = signal(false)
  const elRef = ref<HTMLDivElement>(null)
  const closeSelf = () => closeAction?.()

  onMount(() => {
    closeHandlers.add(closeSelf)
    let pointerStartedOutside = true
    let pointerStartedInsideMenu = false
    function _handlePointerDown(e: PointerEvent) {
      if (eventHitsOwnMenuTrigger(e, menuId)) {
        pointerStartedOutside = false
        pointerStartedInsideMenu = false
        return
      }
      const el = elRef.current
      pointerStartedInsideMenu = !!el && e.composedPath().includes(el)
      pointerStartedOutside = !!el && !pointerStartedInsideMenu
      if (el && pointerStartedOutside) closeAction?.()
    }
    function _handleClickOutside(e: MouseEvent) {
      if (eventHitsOwnMenuTrigger(e, menuId)) return
      const el = elRef.current
      if (!el || e.target === el || e.composedPath().includes(el)) return
      if (e.detail === 0) pointerStartedOutside = true
      if (!pointerStartedOutside && !pointerStartedInsideMenu) {
        pointerStartedOutside = true
        return
      }
      pointerStartedInsideMenu = false
      closeAction?.()
    }
    function _handleContextMenuOutside(e: MouseEvent) {
      if (eventHitsOwnMenuTrigger(e, menuId)) return
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
      openPortals.delete(open)
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
      openPortals.delete(open)
      ready.value = false
      return
    }
    const activeAtOpen = document.activeElement as HTMLElement | null
    const chainedRestore =
      !!lastMenuRestore &&
      lastMenuRestore.menuId !== menuId &&
      activeAtOpen === lastMenuRestore.target &&
      Date.now() - lastMenuRestoreAt < 1000
    const previouslyFocused =
      activeAtOpen &&
      !activeAtOpen.closest?.("#context-menu-portal") &&
      !chainedRestore
        ? activeAtOpen
        : ((Array.from(document.querySelectorAll("[data-menu-trigger]")).find(
            (el) => el.getAttribute("data-menu-trigger") === menuId
          ) as HTMLElement | undefined) ?? activeAtOpen)
    openPortals.add(open)
    for (const close of [...closeHandlers]) {
      if (close !== closeSelf) close()
    }
    pos.value = untrack(() => ({
      x: Math.max(0, mouse.value.x),
      y: Math.max(0, mouse.value.y),
    }))
    function _handleMenuKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeAction?.()
        e.stopImmediatePropagation()
        return
      }
      if (e.key === "Tab") {
        const el = elRef.current
        const active = document.activeElement as HTMLElement | null
        if (!el || !active || !el.contains(active)) return
        const trigger = Array.from(
          document.querySelectorAll("[data-menu-trigger]")
        ).find(
          (t) => t.getAttribute("data-menu-trigger") === menuId
        ) as HTMLElement | undefined
        if (trigger) trigger.focus({ preventScroll: true })
        return
      }
      if (e.key === " " || e.key === "PageUp" || e.key === "PageDown") {
        if (e.ctrlKey || e.metaKey || e.altKey) return
        const el = elRef.current
        const active = document.activeElement as HTMLElement | null
        if (!el || !active) return
        if (e.key === " " ? active === el : el.contains(active))
          e.preventDefault()
        return
      }
      if (
        e.key !== "ArrowDown" &&
        e.key !== "ArrowUp" &&
        e.key !== "Home" &&
        e.key !== "End"
      )
        return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const el = elRef.current
      if (!el) return
      const active = document.activeElement as HTMLElement | null
      const inside = !!active && el.contains(active)
      if (!inside) {
        const triggerEl =
          active && typeof active.closest === "function"
            ? active.closest("[data-menu-trigger]")
            : null
        const onOwnTrigger =
          !!triggerEl &&
          (menuId === undefined ||
            triggerEl.getAttribute("data-menu-trigger") === menuId)
        const onBody = !active || active === document.body
        if (!onOwnTrigger && !onBody) return
      }
      const items = Array.from(el.querySelectorAll("button"))
      if (items.length === 0) return
      e.preventDefault()
      e.stopPropagation()
      const idx = inside ? items.indexOf(active as HTMLButtonElement) : -1
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
    function _handleScroll(e: Event) {
      const el = elRef.current
      if (el && e.target instanceof Node && el.contains(e.target)) return
      closeAction?.()
    }
    function _handleWheel(e: Event) {
      const el = elRef.current
      if (el && e.target instanceof Node && el.contains(e.target)) return
      closeAction?.()
    }
    function _handleFocusIn(e: FocusEvent) {
      const el = elRef.current
      if (!el) return
      if (eventHitsOwnMenuTrigger(e, menuId)) return
      const target = e.target as HTMLElement | null
      if (target && el.contains(target)) return
      if (target?.closest?.("#context-menu-portal")) return
      closeAction?.()
    }
    document.addEventListener("keydown", _handleMenuKey)
    document.addEventListener("focusin", _handleFocusIn)
    window.addEventListener("scroll", _handleScroll, {
      capture: true,
      passive: true,
    })
    window.addEventListener("wheel", _handleWheel, {
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
      } else {
        untrack(() => {
          const x = Math.max(0, Math.min(pos.value.x, Math.max(0, window.innerWidth - rect.width)))
          const y = Math.max(0, Math.min(pos.value.y, Math.max(0, window.innerHeight - rect.height)))
          if (x !== pos.value.x || y !== pos.value.y) pos.value = { x, y }
        })
        ready.value = true
      }
      const which = pendingItemFocus.get(menuId)
      if (which) {
        pendingItemFocus.delete(menuId)
        const items = Array.from(el.querySelectorAll("button"))
        const target = which === "first" ? items[0] : items[items.length - 1]
        if (target) target.focus({ preventScroll: true })
      }
    })
    return () => {
      openPortals.delete(open)
      pendingItemFocus.delete(menuId)
      document.removeEventListener("keydown", _handleMenuKey)
      document.removeEventListener("focusin", _handleFocusIn)
      window.removeEventListener("scroll", _handleScroll, {
        capture: true,
      })
      window.removeEventListener("wheel", _handleWheel, {
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
        lastMenuRestore = { menuId, target: previouslyFocused }
        lastMenuRestoreAt = Date.now()
      }
    }
  })

  return ({ children, label, menuId: renderMenuId }: ContextMenuPortalProps) => {
    if (!open.value) return null

    return (
      <Portal
        container={() => document.querySelector("#context-menu-portal")!}
      >
        <div
          ref={elRef}
          id={renderMenuId}
          role="menu"
          aria-label={label}
          tabIndex={-1}
          className="fixed z-10 select-none shadow-md rounded min-w-[150px]"
          style={{
            left: `${pos.value.x}px`,
            top: `${pos.value.y}px`,
            zIndex: `1000`,
            minWidth: "min(150px, 100vw)",
            maxWidth: "100vw",
            maxHeight: "100vh",
            overflowX: "auto",
            overflowY: "auto",
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
