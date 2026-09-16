import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
    // Fixed width rather than an equal share of the window: card content is
    // designed around this measure, and the row scrolls when it runs out.
    <div className="flex min-h-0 w-95 shrink-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <h3 className="text-lg font-semibold">{column.title}</h3>
          </TooltipTrigger>
          <TooltipContent>{column.hint}</TooltipContent>
        </Tooltip>
        <div className="flex items-center gap-1">
          {hiddenCount > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground">+{hiddenCount}</span>
              </TooltipTrigger>
              <TooltipContent>{`${hiddenCount} hidden by the owner filter`}</TooltipContent>
            </Tooltip>
          ) : null}
          <Badge className="min-w-6 justify-center bg-accent px-1 text-accent-foreground tabular-nums">
            {items.length}
          </Badge>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {/* The gutter keeps the overlay scrollbar (10px + its inset) off the
            cards instead of running over their right edge. */}
        <div className="flex flex-col gap-2 pr-4">
          {items.length === 0 ? (
            <span className="px-2 py-4 text-base text-muted-foreground">{column.empty}</span>
          ) : (
            items.map((item) => column.renderItem(item, ctx))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
