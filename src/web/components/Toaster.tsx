import { Callout, Flex } from '@radix-ui/themes'
import {
  CheckCircledIcon,
  Cross2Icon,
  CrossCircledIcon,
  InfoCircledIcon,
} from '@radix-ui/react-icons'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type Tone = 'success' | 'error' | 'info'

interface Toast {
  id: number
  tone: Tone
  message: string
}

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {})

export const useToast = () => useContext(ToastContext)

const ICONS: Record<Tone, ReactNode> = {
  success: <CheckCircledIcon />,
  error: <CrossCircledIcon />,
  info: <InfoCircledIcon />,
}

const COLORS = { success: 'green', error: 'red', info: 'blue' } as const

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
      <Flex direction="column" gap="2" className="toaster">
        {toasts.map((toast) => (
          <Callout.Root
            key={toast.id}
            color={COLORS[toast.tone]}
            variant="surface"
            size="1"
            onClick={() => dismiss(toast.id)}
            className="toast"
          >
            <Callout.Icon>{ICONS[toast.tone]}</Callout.Icon>
            <Callout.Text>{toast.message}</Callout.Text>
            <Cross2Icon className="toast-close" />
          </Callout.Root>
        ))}
      </Flex>
    </ToastContext.Provider>
  )
}
