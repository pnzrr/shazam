import { CircleCheck, CircleX, Info, X } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

type Tone = 'success' | 'error' | 'info'

interface Toast {
  id: number
  tone: Tone
  message: string
}

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {})

export const useToast = () => useContext(ToastContext)

const ICONS: Record<Tone, ReactNode> = {
  success: <CircleCheck className="size-4" />,
  error: <CircleX className="size-4" />,
  info: <Info className="size-4" />,
}

const COLORS: Record<Tone, string> = {
  success: 'border-success/50 text-emerald-700 dark:text-success',
  error: 'border-destructive/50 text-red-700 dark:text-red-400',
  info: 'border-primary/50 text-primary',
}

let nextId = 1

export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (message: string, tone: Tone = 'info') => {
      const id = nextId++
      setToasts((current) => [...current, { id, tone, message }])
      // Errors tend to carry gh output worth reading, so they linger.
      setTimeout(() => dismiss(id), tone === 'error' ? 12_000 : 5_000)
    },
    [dismiss],
  )

  const value = useMemo(() => push, [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 bottom-4 z-50 flex max-w-[420px] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'flex cursor-pointer items-start gap-2 whitespace-pre-wrap rounded-lg border bg-card px-3 py-2 text-sm shadow-md',
              COLORS[toast.tone],
            )}
            onClick={() => dismiss(toast.id)}
          >
            <span className="mt-0.5 shrink-0">{ICONS[toast.tone]}</span>
            <span className="flex-1">{toast.message}</span>
            <X className="size-3.5 shrink-0 self-center opacity-40" />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
