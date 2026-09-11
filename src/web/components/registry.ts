import type { ReactNode } from 'react'
import type {
  AgentSession,
  ColumnId,
  DashboardData,
  DashboardItem,
  HealthReport,
  MergeMethod,
} from '../../shared/types.js'

/** Everything a column needs from the app shell to render its rows. */
export interface ColumnContext {
  viewer: string
  agents: HealthReport['agents']
  /** Merge method the primary Merge click uses without asking. */
  defaultMergeMethod: MergeMethod
  onSessionLaunched: (session: AgentSession) => void
  /**
   * Called with the item's id after an action that changes GitHub state. It
   * refreshes and hides the row, which a refresh alone cannot always do.
   */
  onActioned: (itemId: string) => void
  /** Item id of the tile touched most recently, marked across all columns. */
  lastClickedId: string | null
  /** Any click anywhere inside a tile reports it, buttons and chips included. */
  onTileClicked: (id: string) => void
}

/**
 * A column is the unit of swappability. Adding, removing or reordering a list
 * on the dashboard is an edit to COLUMNS below - the shell knows nothing about
 * what any particular column contains.
 */
export interface ColumnDef {
  id: ColumnId
  title: string
  hint: string
  empty: string
  select: (data: DashboardData) => DashboardItem[]
  renderItem: (item: DashboardItem, ctx: ColumnContext) => ReactNode
}

export const ownerOf = (item: DashboardItem): string => item.repo.owner
