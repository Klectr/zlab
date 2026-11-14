import {
  createContext,
  onMount,
  Portal,
  Transition,
  useContext,
  signal,
  type TransitionState,
} from "kiru"

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

  onMount(() => {
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
    return () => clearInterval(interval)
  })

  const showToast = (
    type: Toast["type"],
    message: string,
    duration?: number
  ) => {
    const ts = Date.now()
    const toast = {
      ts,
      type,
      message,
      expires: ts + (duration ?? defaultDuration),
    }
    toasts.value = [...toasts.value, toast]
  }

  return () => (
    <ToastContext value={{ showToast }}>
      {children}
      <Portal container={() => document.getElementById("toast-root")!}>
        {toasts.value.map((toast, i) => (
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
                i={i}
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
  i,
  onDismiss,
  onPause,
  onResume,
}: {
  toast: Toast
  state: TransitionState
  i: number
  onDismiss: () => void
  onPause: (source: string) => void
  onResume: (source: string) => void
}) {
  if (state == "exited") return null
  const translateX = state === "entered" ? 0 : 250
  const translateY = i * 70
  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      style={{
        transform: `translate(${translateX}px, ${translateY}px)`,
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
