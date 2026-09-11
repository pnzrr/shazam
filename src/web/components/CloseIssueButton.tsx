import { AlertDialog, Button, Flex, Text, TextArea } from '@radix-ui/themes'
import { useState } from 'react'
import type { IssueItem } from '../../shared/types.js'
import { api } from '../lib/api.js'
import { SplitActionButton } from './SplitActionButton.js'
import { useToast } from './Toaster.js'

export function CloseIssueButton({ issue, onDone }: { issue: IssueItem; onDone: () => void }) {
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const toast = useToast()

  const close = async (withComment?: string) => {
    setBusy(true)
    try {
      const result = await api.closeIssue(issue.url, withComment)
      toast(
        result.ok ? `Closed ${issue.repo.nameWithOwner}#${issue.number}` : result.message,
        result.ok ? 'success' : 'error',
      )
      if (result.ok) {
        setOpen(false)
        setComment('')
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
        label="Close"
        color="gray"
        primaryTooltip={`Close #${issue.number} now, no comment`}
        busy={busy}
        onPrimary={() => void close()}
        menu={[{ label: 'Close with comment…', onSelect: () => setOpen(true) }]}
      />

      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <AlertDialog.Content maxWidth="480px">
          <AlertDialog.Title>
            Close {issue.repo.nameWithOwner}#{issue.number}
          </AlertDialog.Title>
          <AlertDialog.Description size="2">{issue.title}</AlertDialog.Description>

          <Flex direction="column" gap="2" mt="4">
            <Text size="2" weight="medium">
              Closing comment
            </Text>
            <TextArea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Fixed in #123"
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
            <Button color="red" loading={busy} onClick={() => void close(comment)}>
              Close issue
            </Button>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  )
}
