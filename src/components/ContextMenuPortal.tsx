import { useClickOutside, useMouse } from "@kaioken-core/hooks";
import { Portal, signal, useEffect, useRef, type Signal } from "kaioken";

interface ContextMenuPortalProps {
  children: JSX.Children
  open: Signal<boolean>
  closeAction: (() => void) | null | undefined
}
export function ContextMenuPortal({ children, open, closeAction }: ContextMenuPortalProps) {
  const { mouse } = useMouse()
  const pos = signal({ x: 0, y: 0 })
  const ref = useRef<HTMLDivElement>(null)

  useClickOutside(ref, () => {
    closeAction?.()
  })

  useEffect(() => {
    if (!open.value) return
    pos.value = mouse.value
    function _handleEscapeKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      closeAction?.()
    }
    document.addEventListener("keydown", _handleEscapeKey)
    return () => {
      document.removeEventListener("keydown", _handleEscapeKey)
    }
  }, [open.value])

  if (!open.value) return null

  return (
    <Portal
      container={() => document.querySelector("#context-menu-portal")!}
    >
      <div
        ref={ref}
        className="fixed z-10 select-none shadow-md rounded min-w-[150px]"
        style={{
          left: `${pos.value.x}px`,
          top: `${pos.value.y}px`,
          zIndex: `1000`
        }}
      >
        {children}
      </div>
    </Portal>
  )
}
