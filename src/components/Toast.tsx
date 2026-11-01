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

  onMount(() => {
    const interval = setInterval(() => {
      const next = toasts.value.map((toast) => {
        if (toast.expired) {
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
                toasts.value = toasts.value.filter((t) => t.ts !== toast.ts)
              }
            }}
            element={(state) => <ToastItem toast={toast} state={state} i={i} />}
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
}: {
  toast: Toast
  state: TransitionState
  i: number
}) {
  if (state == "exited") return null
  const translateX = state === "entered" ? 0 : 250
  const translateY = i * 70
  return (
    <div
      style={{
        transform: `translate(${translateX}px, ${translateY}px)`,
      }}
      className={`toast toast-${toast.type}`}
    >
      <span className="toast-message">{toast.message}</span>
    </div>
  )
}
