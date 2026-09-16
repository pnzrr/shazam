import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * The card's "someone else wrote this" mark: an avatar in the corner instead
 * of a `· login` suffix on the meta line, which kept pushing long repo names
 * into a wrap. GitHub serves any user's avatar at github.com/USERNAME.png, so
 * no extra API call is needed; the login itself moves into the tooltip.
 */
export function AuthorAvatar({ login }: { login: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar size="sm">
          <AvatarImage src={`https://github.com/${login}.png?size=64`} alt="" />
          <AvatarFallback>{login.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent>{login}</TooltipContent>
    </Tooltip>
  )
}
