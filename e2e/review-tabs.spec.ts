import { expect, test } from './fixtures.js'

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'board-only controls')
})

const card = (board: import('@playwright/test').Page, title: string) =>
  board.locator('[data-item-id]', { hasText: title }).first()

test('an approved PR names its reviewer on the reviewers button', async ({ board }) => {
  const button = card(board, 'Dark mode for the invoice view').locator('[data-card-action="reviewers"]')
  await expect(button.getByRole('img', { name: 'carol' })).toBeVisible()
  await button.hover()
  await expect(board.getByRole('tooltip')).toContainText('carol approved')
  await board.screenshot({ path: 'test-results/review-tabs-board.png' })
})

test('Ready to merge and Ready to approve sit beside All and filter the board', async ({ board }) => {
  await board.getByRole('button', { name: 'Ready to merge' }).click()
  await expect(board).toHaveURL(/q=is%3Amergeable/)
  // canMerge: false on these two in the fixtures.
  await expect(board.getByText('Idempotency keys for refunds')).toHaveCount(0)
  await expect(board.getByText('Bump node to 22')).toHaveCount(0)

  await board.getByRole('button', { name: 'Ready to approve' }).click()
  // Changes requested is not ready to approve.
  await expect(board.getByText('Bump node to 22')).toHaveCount(0)
  await expect(board.getByText('Idempotency keys for refunds').first()).toBeVisible()
  await board.screenshot({ path: 'test-results/review-tabs-approve.png' })
})
