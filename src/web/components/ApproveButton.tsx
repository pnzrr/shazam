import { AlertDialog, Button, Flex, Text, TextArea } from '@radix-ui/themes'
import { useState } from 'react'
import type { PullRequestItem } from '../../shared/types.js'
import { api } from '../lib/api.js'
import { SplitActionButton } from './SplitActionButton.js'
import { useToast } from './Toaster.js'

export function ApproveButton({ pr, onDone }: { pr: PullRequestItem; onDone: () => void }) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const toast = useToast()

  const approve = async (comment?: string) => {
    setBusy(true)
    try {
      const result = await api.approve(pr.url, comment)
      toast(
        result.ok ? `Approved ${pr.repo.nameWithOwner}#${pr.number}` : result.message,
        result.ok ? 'success' : 'error',
      )
      if (result.ok) {
        setOpen(false)
        setBody('')
        onDone()
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SplitActionButton
        label="Approve"
        color="green"
        primaryTooltip={`Approve #${pr.number} now, no comment`}
        busy={busy}
        onPrimary={() => void approve()}
        menu={[{ label: 'Approve with comment…', onSelect: () => setOpen(true) }]}
      />

      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <AlertDialog.Content maxWidth="480px">
          <AlertDialog.Title>
            Approve {pr.repo.nameWithOwner}#{pr.number}
          </AlertDialog.Title>
          <AlertDialog.Description size="2">{pr.title}</AlertDialog.Description>

          <Flex direction="column" gap="2" mt="4">
            <Text size="2" weight="medium">
              Comment
            </Text>
            <TextArea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="LGTM"
              rows={3}
              autoFocus
            />
          </Flex>

          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <Button color="green" loading={busy} onClick={() => void approve(body)}>
              Approve
            </Button>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  )
}
