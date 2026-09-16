import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { setToken } from '../lib/token.js'

/**
 * Shown when the API rejects our token. The dashboard can spawn shells, so we
 * would rather make the user re-open the CLI's URL than drop the gate.
 */
export function TokenGate() {
  const [value, setValue] = useState('')

  return (
    <div className="flex h-screen items-center justify-center">
      <Card className="max-w-[460px] gap-3 p-6">
        <h2 className="text-lg font-semibold">shazam needs its access token</h2>
        <p className="text-sm text-muted-foreground">
          Open the dashboard link printed by <code>shazam serve</code>, or paste the contents of{' '}
          <code>~/.shazam/token</code> below.
        </p>
        <Input
          placeholder="token"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && value.trim()) {
              setToken(value)
              window.location.reload()
            }
          }}
        />
        <Button
          disabled={!value.trim()}
          onClick={() => {
            setToken(value)
            window.location.reload()
          }}
        >
          Use this token
        </Button>
      </Card>
    </div>
  )
}
