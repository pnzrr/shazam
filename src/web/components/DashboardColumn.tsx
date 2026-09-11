import { Badge, Flex, Heading, ScrollArea, Text, Tooltip } from '@radix-ui/themes'
import type { DashboardItem } from '../../shared/types.js'
import type { ColumnContext, ColumnDef } from './registry.js'

export interface DashboardColumnProps {
  column: ColumnDef
  items: DashboardItem[]
  /** Rows hidden by the owner filter, reported so the count is not confusing. */
  hiddenCount: number
  ctx: ColumnContext
}

export function DashboardColumn({ column, items, hiddenCount, ctx }: DashboardColumnProps) {
  return (
    <Flex direction="column" gap="2" className="column">
      <Flex align="center" justify="between" gap="2" px="1">
        <Tooltip content={column.hint}>
          <Heading size="3">{column.title}</Heading>
        </Tooltip>
        <Flex gap="1" align="center">
          {hiddenCount > 0 ? (
            <Tooltip content={`${hiddenCount} hidden by the owner filter`}>
              <Text size="1" color="gray">
                +{hiddenCount}
              </Text>
            </Tooltip>
          ) : null}
          <Badge variant="soft" radius="full">
            {items.length}
          </Badge>
        </Flex>
      </Flex>

      <ScrollArea scrollbars="vertical" className="column-scroll">
        <Flex direction="column" gap="2" pr="2">
          {items.length === 0 ? (
            <Text size="2" color="gray" className="column-empty">
              {column.empty}
            </Text>
          ) : (
            items.map((item) => column.renderItem(item, ctx))
          )}
        </Flex>
      </ScrollArea>
    </Flex>
  )
}
