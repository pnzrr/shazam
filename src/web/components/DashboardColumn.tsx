import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { DashboardItem } from '../../shared/types.js'
import type { ColumnContext, ColumnDef } from './registry.js'

export interface DashboardColumnProps {
  column: ColumnDef
  items: DashboardItem[]
  /** Rows hidden by the filters, reported so the count is not confusing. */
  hiddenCount: number
  /** True before the first poll lands: skeletons, not "nothing here". */
  loading: boolean
  ctx: ColumnContext
  collapsed: boolean
  onToggleCollapse: () => void
}

/*
 * bg-secondary, not bg-muted: in this palette muted is within a shade of the
 * card surface, and an invisible skeleton is just the blank column again.
 */
function CardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-2 rounded-lg border bg-card p-3">
      <div className="h-4 w-2/5 rounded bg-secondary" />
      <div className="h-5 w-4/5 rounded bg-secondary" />
      <div className="flex gap-2">
        <div className="h-6 w-14 rounded-full bg-secondary" />
        <div className="h-6 w-9 rounded-full bg-secondary" />
        <div className="h-6 w-9 rounded-full bg-secondary" />
      </div>
    </div>
  )
}

export function DashboardColumn({
  column,
  items,
  hiddenCount,
  loading,
  ctx,
  collapsed,
  onToggleCollapse,
}: DashboardColumnProps) {
  if (collapsed) {
    return (
      // A collapsed column keeps its slot in the flex row - same stretch, just
      // narrow - so collapsing never reflows the neighbours or breaks the
      // row's horizontal scroll. The whole rail is one button: at 40px wide
      // there is no room for a separate expand control worth aiming at.
      <button
        type="button"
        onClick={onToggleCollapse}
        title={`Expand ${column.title}`}
        className="flex min-h-0 w-10 shrink-0 flex-col items-center gap-2 rounded-lg border bg-card py-2 transition-colors hover:bg-accent"
      >
        <ChevronsRight className="size-4 shrink-0 text-muted-foreground" />
        {column.dot ? <span className={cn('size-2 shrink-0 rounded-full', column.dot)} /> : null}
        {/* Vertical writing mode rather than a rotation transform: the text
            keeps real layout, so truncation still works when the title is
            taller than the rail. */}
        <span className="min-h-0 truncate text-sm font-semibold [writing-mode:vertical-rl]">
          {column.title}
        </span>
        <Badge className="min-w-6 shrink-0 justify-center bg-accent px-1 text-accent-foreground tabular-nums">
          {loading ? '–' : items.length}
        </Badge>
      </button>
    )
  }

  return (
    // Fixed width rather than an equal share of the window: card content is
    // designed around this measure, and the row scrolls when it runs out.
    <div className="flex min-h-0 w-95 shrink-0 flex-col gap-2">
      {/* pr-4 matches the card gutter below, so the count badge lines up with
          the cards' right edge instead of overhanging it. */}
      <div className="flex items-start justify-between gap-2 pl-1 pr-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {column.dot ? (
              <span className={cn('size-2 shrink-0 rounded-full', column.dot)} />
            ) : null}
            <h3 className="truncate text-lg font-semibold">{column.title}</h3>
          </div>
          {/* The hint used to hide in a tooltip on the title; in the open it
              earns its keep as the column's one-line description. */}
          <p className="truncate text-xs text-muted-foreground" title={column.hint}>
            {column.hint}
          </p>
        </div>
        {/* pt-0.5 centres the controls on the title line, not the two-line block. */}
        <div className="flex items-center gap-1 pt-0.5">
          {hiddenCount > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground">+{hiddenCount}</span>
              </TooltipTrigger>
              <TooltipContent>{`${hiddenCount} hidden by your filters`}</TooltipContent>
            </Tooltip>
          ) : null}
          <Badge className="min-w-6 justify-center bg-accent px-1 text-accent-foreground tabular-nums">
            {loading ? '–' : items.length}
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground"
                aria-label={`Collapse ${column.title}`}
                onClick={onToggleCollapse}
              >
                <ChevronsLeft />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Collapse</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {/* The gutter keeps the overlay scrollbar (10px + its inset) off the
            cards instead of running over their right edge. */}
        <div className="flex flex-col gap-2 pr-4 group-data-[density=compact]/density:gap-1">
          {items.length === 0 ? (
            loading ? (
              <>
                <span className="sr-only">Loading {column.title}</span>
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </>
            ) : (
              <span className="px-2 py-4 text-base text-muted-foreground">{column.empty}</span>
            )
          ) : (
            items.map((item) => column.renderItem(item, ctx))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
