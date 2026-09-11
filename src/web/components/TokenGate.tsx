import { Button, Card, Flex, Heading, Text, TextField } from '@radix-ui/themes'
import { useState } from 'react'
import { setToken } from '../lib/token.js'

/**
 * Shown when the API rejects our token. The dashboard can spawn shells, so we
 * would rather make the user re-open the CLI's URL than drop the gate.
 */
export function TokenGate() {
  const [value, setValue] = useState('')

  return (
    <Flex align="center" justify="center" className="gate">
      <Card size="3" style={{ maxWidth: 460 }}>
        <Flex direction="column" gap="3">
          <Heading size="4">shazam needs its access token</Heading>
          <Text size="2" color="gray">
            Open the dashboard link printed by <code>shazam serve</code>, or paste the contents of{' '}
            <code>~/.shazam/token</code> below.
          </Text>
          <TextField.Root
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
        </Flex>
      </Card>
    </Flex>
  )
}
