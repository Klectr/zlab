import {
  createContext,
  onMount,
  Portal,
  Transition,
  useContext,
  signal,
  type TransitionState,
} from "kiru"
import { canvasDimentsion } from "../signals"

type Toast = {
  ts: number
  type: "info" | "success" | "warning" | "error"
  message: string
  expires: number
  expired?: boolean
}

const defaultDuration = 3000

const noop = () => {}

const ToastContext = createContext<{
  showToast: (type: Toast["type"], message: string) => void
}>({ showToast: noop })

export const useToast = () => useContext(ToastContext)

interface ToastProviderProps {
  children: JSX.Children
}

export function ToastContextProvider({ children }: ToastProviderProps) {
  const toasts = signal<Toast[]>([])
  const politeAnnouncement = signal("")
  const assertiveAnnouncement = signal("")
  const pauseSources = new Map<number, { since: number; sources: Set<string> }>()

  const pauseToast = (ts: number, source: string) => {
    const entry = pauseSources.get(ts)
    if (entry) {
      entry.sources.add(source)
    } else {
      pauseSources.set(ts, { since: Date.now(), sources: new Set([source]) })
    }
  }

  const resumeToast = (ts: number, source: string) => {
    const entry = pauseSources.get(ts)
    if (!entry) {
      return
    }
    entry.sources.delete(source)
    if (entry.sources.size > 0) {
      return
    }
    pauseSources.delete(ts)
    const shift = Date.now() - entry.since
    toasts.value = toasts.value.map((toast) =>
      toast.ts === ts ? { ...toast, expires: toast.expires + shift } : toast
    )
  }

  const dismissToast = (ts: number) => {
    pauseSources.delete(ts)
    toasts.value = toasts.value.map((toast) =>
      toast.ts === ts ? { ...toast, expired: true } : toast
    )
  }

  const estimateToastHeight = (message: string) => {
    const lines = Math.max(1, Math.ceil(message.length / 20))
    return Math.max(64, lines * 24 + 16)
  }

  const toastStackBudget = () => {
    const stackTop = window.innerWidth <= 640 ? 52 : 16
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight
    const scaleFactor = Math.max(
      10,
      canvasDimentsion.value.width / (viewportWidth / 2),
      canvasDimentsion.value.height / (viewportHeight / 2)
    )
    const minimapReserve = canvasDimentsion.value.height / scaleFactor + 20 + 64
    return window.innerHeight - stackTop - minimapReserve + 64
  }

  const stackHeight = (list: Toast[]) =>
    list.reduce(
      (total, toast) => total + estimateToastHeight(toast.message) + 6,
      0
    ) - (list.length > 0 ? 6 : 0)

  const evictOverflowToasts = (list: Toast[]) => {
    const budget = toastStackBudget()
    while (list.length > 1 && stackHeight(list) > budget) {
      const evicted = list.shift()!
      pauseSources.delete(evicted.ts)
    }
    return list
  }

  onMount(() => {
    const handleResize = () => {
      if (stackHeight(toasts.value) > toastStackBudget()) {
        toasts.value = evictOverflowToasts([...toasts.value])
      }
    }
    window.addEventListener("resize", handleResize)
    const interval = setInterval(() => {
      const next = toasts.value.map((toast) => {
        if (toast.expired || pauseSources.has(toast.ts)) {
          return toast
        }
        return {
          ...toast,
          expired: Date.now() > toast.expires,
        }
      })
      if (next.some((toast, i) => toast.expired !== toasts.value[i].expired)) {
        toasts.value = next
      }
    }, 500)
    return () => {
      window.removeEventListener("resize", handleResize)
      clearInterval(interval)
    }
  })

  let lastToastTs = 0
  let politeTimer: ReturnType<typeof setTimeout> | undefined
  let assertiveTimer: ReturnType<typeof setTimeout> | undefined

  const showToast = (
    type: Toast["type"],
    message: string,
    duration?: number
  ) => {
    const ts = Math.max(Date.now(), lastToastTs + 1)
    lastToastTs = ts
    const toast = {
      ts,
      type,
      message,
      expires: ts + (duration ?? defaultDuration),
    }
    toasts.value = evictOverflowToasts([...toasts.value, toast])
    const announcement =
      type === "error" ? assertiveAnnouncement : politeAnnouncement
    if (type === "error") {
      clearTimeout(assertiveTimer)
    } else {
      clearTimeout(politeTimer)
    }
    announcement.value = ""
    const timer = setTimeout(() => {
      announcement.value = message
    }, 50)
    if (type === "error") {
      assertiveTimer = timer
    } else {
      politeTimer = timer
    }
  }

  return () => (
    <ToastContext value={{ showToast }}>
      {children}
      <span
        id="toast-live-polite"
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {politeAnnouncement.value}
      </span>
      <span
        id="toast-live-assertive"
        role="alert"
        aria-live="assertive"
        className="sr-only"
      >
        {assertiveAnnouncement.value}
      </span>
      <Portal container={() => document.getElementById("toast-root")!}>
        {toasts.value.map((toast) => (
          <Transition
            key={toast.ts}
            in={!toast.expired}
            duration={{
              in: 50,
              out: 300,
            }}
            onTransitionEnd={(state) => {
              if (state === "exited") {
                pauseSources.delete(toast.ts)
                toasts.value = toasts.value.filter((t) => t.ts !== toast.ts)
              }
            }}
            element={(state) => (
              <ToastItem
                toast={toast}
                state={state}
                onDismiss={() => dismissToast(toast.ts)}
                onPause={(source) => pauseToast(toast.ts, source)}
                onResume={(source) => resumeToast(toast.ts, source)}
              />
            )}
          />
        ))}
      </Portal>
    </ToastContext>
  )
}

function ToastItem({
  toast,
  state,
  onDismiss,
  onPause,
  onResume,
}: {
  toast: Toast
  state: TransitionState
  onDismiss: () => void
  onPause: (source: string) => void
  onResume: (source: string) => void
}) {
  if (state == "exited") return null
  const translateX = state === "entered" ? 0 : 250
  return (
    <div
      style={{
        transform: `translate(${translateX}px, 0px)`,
      }}
      className={`toast toast-${toast.type}`}
      onmouseenter={() => onPause("hover")}
      onmouseleave={() => onResume("hover")}
    >
      <span className="toast-message pr-4">{toast.message}</span>
      <button
        type="button"
        aria-label={`Dismiss notification: ${toast.message}`}
        onclick={onDismiss}
        onfocus={() => onPause("focus")}
        onblur={() => onResume("focus")}
        className="absolute right-1 top-1 cursor-pointer px-2 py-0.5 leading-none text-[#e5e5e5]"
      >
        x
      </button>
    </div>
  )
}
