# shazam — personal github dashboard

A single pane for the GitHub work you owe, run locally on your own machine, with
the quick actions that normally cost several clicks across several tools.

```
npx shazam serve
```

## Quick start

```bash
npm install
npm run build
node dist/server/cli.js serve
```

`serve` validates your toolchain, starts on `http://127.0.0.1:4270`, and opens a
browser at a URL carrying the access token. Options:

| Flag | Meaning |
| --- | --- |
| `-p, --port <n>` | Port to listen on (default `4270`) |
| `-i, --poll <ms>` | Poll interval (default `60000`, floor `15000`) |
| `--no-open` | Do not open a browser |
| `--skip-preflight` | Start even if a required tool is missing |

For development, `npm run dev` runs the API and a Vite dev server with HMR on
port 4271.

## What it shows

Four columns, each sorted by last updated, descending:

- **My pull requests** — open PRs you authored. Icons for CI state, review
  decision, merge conflicts, unresolved review threads, and diff size. A
  **Merge** button, enabled when the PR is approved, not a draft, and not one
  GitHub would refuse. CI that is not green does not block it — the button
  turns amber and reads **Merge !** so you know what you are doing. A
  **Request** button carries the count of reviewers who have not answered and
  opens the reviewer panel.
- **Waiting on my review** — PRs where review is requested from you and you have
  not reviewed yet (`review-requested:@me -reviewed-by:@me`). Same status icons,
  plus an **Approve** button.
- **Issues I opened** — `author:@me`, with comment counts and labels, and a
  **Close** button.
- **Assigned to me** — `assignee:@me -author:@me`. The exclusion keeps the two
  issue columns disjoint, the same way *Waiting on my review* excludes your own
  PRs, so assigning yourself to your own issue does not list it twice. These
  rows show who opened them.

Merge, Approve and Close commit immediately on click — no confirmation step.
Each carries a caret with "… with comment", which opens a dialog to write one
first (and, for merge, to pick a different method for that one merge). All
three are reversible on GitHub, which is why the fast path is the default one.

Acting on a row refreshes the dashboard **and** hides that row straight away.
The refresh alone is not enough: GitHub's search index is eventually
consistent, so a PR you just approved keeps matching `-reviewed-by:@me` for a
while and would sit there looking untouched. The row is hidden for 90 seconds
and comes back if the action did not in fact remove it.

### Reviewers

Each of your pull requests carries a **Request** button. It shows how many
reviewers have been asked and have not answered — amber with a count, grey when
nobody is waiting — which is the answer to "is someone still sitting on this?"
without opening anything. That count rides along on the dashboard poll: it is
`reviewRequests.totalCount`, which costs nothing measurable next to the rest of
the query.

Riding on the poll means the count is only ever as fresh as the last one — a
minute old at worst, and older whenever a poll fails, since the poller keeps
serving the last good payload behind its error banner. The panel reads the pull
request directly, so once it has told us the truth that number is kept even
after the panel closes; otherwise the count would snap back to the stale one
the instant you dismissed the thing that had just corrected it. The poll takes
over again the moment its own number moves, which is how we know it has caught
up — or that someone else has changed the reviewers since.

Clicking it opens the panel GitHub keeps in a sidebar two clicks away:

- Everyone on the PR now, each with their own state — waiting, approved,
  changes, commented, dismissed. That is per-person, unlike the `approved` chip
  on the tile, which is GitHub's single verdict for the whole PR.
- A circular arrow next to anyone who has already answered, to ask them again.
  A review goes stale the moment you push, and this is GitHub's own re-request.
- An `×` to withdraw a request.
- A search box over the repository's collaborators, matching on login *and*
  real name, to ask someone new. One click requests the review.

Collaborators come back a hundred at a time, which is the whole list for most
repositories, so typing filters what is already loaded; only a repo with more
than that goes back to GitHub as you type. Listing collaborators needs push
access, so on a PR you opened against a repo you cannot push to the panel still
shows who has reviewed and says why it cannot offer anyone new.

Teams already requested are shown as `org/team`; the search offers people only.

### When Merge is live

A red check is not on its own a reason to grey the button out. Most CI failures
on an approved PR are a lint or preview job that no branch rule requires, and
GitHub merges those without complaint; a failure that a rule *does* require
looks identical in the check rollup. What tells them apart is GitHub's own
`mergeStateStatus` — its answer to "would you take this merge" — and only
`blocked`, `behind`, `dirty` and `draft` disable the button. `unknown` does
not: GitHub computes the field lazily, so a PR that is perfectly fine answers
`unknown` simply because nobody asked recently.

It is read in a second request rather than with the dashboard, and only for the
PRs that are approved and not conflicting. Asking for it inline makes GitHub
compute a trial merge for every row in the response, which reliably times the
whole query out — a 502, or "we couldn't respond to your request in time".

### Merge methods

Merge uses `defaultMergeMethod` from config, but only where it is actually
permitted, checked in two places:

- **Repository settings** — squash, merge commits and rebase can each be
  switched off (`squashMergeAllowed` and friends, read with the dashboard
  query).
- **Branch rulesets** — a ruleset on the base branch can narrow things further,
  so a repo with squash enabled everywhere can still refuse a squash into
  `main`. Read from `/repos/{repo}/rules/branches/{branch}`, cached for ten
  minutes and only fetched for PRs whose Merge button is live, so it costs
  roughly nothing per poll.

Whatever survives both is what the button sends, and the tooltip names it. The
comment dialog offers only those methods too. If a repository has disabled all
three, Merge is greyed out rather than letting you click into a failure.

A PR whose review asked for changes grows a **wrench** next to the `changes`
chip, in the Shazam button's own fill because it is a shortcut to the same
thing: it opens the same worktree with the default agent, but on
`shazamChangesPrompt` instead of `shazamPrompt` — read every review comment and
requested change, fix what is right to fix, argue where the reviewer is wrong
rather than quietly complying, and reply on the thread either way. It is only
rendered where there is something to answer, so a wrench on a tile is itself
the signal that a reviewer is waiting on you.

Every PR row also has a **Shazam** button. Owner filter chips in the header are
derived from whatever is on screen, so they need no configuration.

Every tile is itself a link: clicking anywhere that is not a button or a chip
opens the PR or issue on GitHub. The status chips deep-link into the relevant
tab instead — checks to `/checks`, the conflict marker to GitHub's conflict
resolver at `/conflicts`, and the `+/-` diff stat to `/files`.

### Reading comments without leaving

The comment chip is the exception: it opens the conversation in a scrollable
overlay at the pointer, half the window wide, rather than sending you to
GitHub. On a PR that is the issue comments, each submitted review's own body,
and every inline review comment, flattened into one list in the order they were
written — which is how the page reads — with the file name on the ones that
hang off the diff.

Each comment's timestamp is a link to that comment's own anchor on GitHub, so
"take me to this one" is one click from the overlay rather than a scroll
through the thread.

Bodies come back as `bodyHTML` — the comment as GitHub itself renders it, so
GFM and any HTML the author wrote inline arrive already handled. That is what
makes a Cloudflare Pages deployment table or a `<details>` block read as the
table and the block rather than as its source. GitHub sanitizes what it
renders; shazam runs it through DOMPurify again before it goes near the
document, and rewrites every link in a comment to open in a new tab so none of
them can navigate the dashboard — and any running agent session — away.

The next click anywhere dismisses the overlay and does nothing else. Swallowing
that click matters, because the dashboard is a field of click targets and a
dismissal that fell through would open a tile on GitHub — or press Merge,
Approve or Close — on its way out. Escape closes it too, and the link in its
header is the way out to the full thread.

Comments are fetched on the click, never on the poll, so a hundred rows cost
one request only when you actually read one. The server holds each conversation
for 30 seconds, which is what makes opening the same chip twice free.

## Shazam

Shazam gets you from "this PR needs work" to a coding agent sitting in the right
branch, in one click:

1. Ensures a bare clone of the base repo under `~/.shazam/mirrors/`, reused
   across every PR in that repo.
2. Fetches just that PR's head (`refs/pull/<n>/head`), which works the same for
   fork and same-repo PRs.
3. Adds a git worktree under `~/.shazam/worktrees/<owner>-<repo>-pr<n>` and sets
   up branch tracking so a plain `git push` updates the PR — including pushing
   to the contributor's fork when the PR came from one.
4. Spawns Claude Code or Codex there with a prompt telling it to load the PR,
   read the review comments and CI state, and wait for your instruction.
5. Streams the session into a terminal dock that opens across the bottom half
   of the window and takes keyboard focus, so you can type at the agent
   straight away. Drag its top edge to resize; the terminal reflows to fit.
   Sessions survive a page reload, and scrollback is replayed on reattach.

A fork PR's branch is namespaced `pr-<n>-<branch>` so a fork branch called `main`
cannot clobber the base repo's `main`.

The primary half opens `defaultAgent`; the caret picks the other one. Agents
that were not found on `PATH` at startup are disabled rather than hidden, and
`defaultAgent` falls back to whichever one is installed.

### Workspace trust

Both agents ask whether you trust a directory the first time they open one.
Because every worktree shares a single bare mirror, and both agents key that
question on the canonical git root, it gets asked **once per repository** rather
than once per PR — the second PR you open in the same repo starts silently.

`trustWorktrees` (on by default) answers even that first question ahead of time.
It only ever applies to directories under `~/.shazam/`, never to your own
checkouts:

- **Codex** accepts a per-invocation setting, so shazam passes
  `-c projects."<worktree>".trust_level="trusted"` and writes nothing to disk.
- **Claude Code** has no equivalent flag, so shazam records the answer where its
  own dialog would record it: `hasTrustDialogAccepted` against the mirror in
  `~/.claude.json`. Running Claude sessions rewrite that file wholesale, so
  shazam re-reads it immediately before writing, writes through a temporary file
  and a rename, and skips the write entirely once the grant exists — which makes
  it at most one write per repository.

Set `"trustWorktrees": false` to answer the prompts yourself instead.

## Configuration

Optional, at `~/.shazam/config.json`:

```json
{
  "pollIntervalMs": 60000,
  "port": 4270,
  "defaultAgent": "claude",
  "defaultMergeMethod": "squash",
  "perColumnLimit": 100,
  "trustWorktrees": true,
  "terminalFontSize": 20,
  "shazamPrompt": "You are working on pull request {url}. ...",
  "shazamChangesPrompt": "You are working on pull request {url}, where a reviewer has requested changes. ..."
}
```

`shazamPrompt` is what a plain Shazam opens with; `shazamChangesPrompt` is what
the wrench opens with. Both substitute `{url}`, `{number}`, `{repo}`, `{path}`
and `{branch}`.

`defaultAgent` is the agent both of them open — the primary half of the Shazam
split button, and the wrench. Where that agent is not installed, they fall back
to whichever one is.

## How it works

- **Auth.** Reads use a token from `gh auth token` against the GraphQL API;
  writes shell out to `gh` so merges and approvals run as exactly the identity
  in `gh auth status`. shazam never stores a GitHub credential of its own.
- **Polling.** The server polls GitHub on an interval into an in-memory cache
  and the browser reads that cache, so extra tabs and manual refreshes cost no
  API quota. One GraphQL request covers all four columns, plus a second for the
  merge states of the PRs that could merge. Remaining rate limit is in the
  header.
- **Access control.** The dashboard can spawn shells, so `/api` and `/ws` require
  a token (`~/.shazam/token`, mode 0600) and a loopback `Origin`. The server
  binds `127.0.0.1` only.

## Swapping components out

Columns are the unit of swappability. A column is a `ColumnDef`
(`src/web/components/registry.ts`) that knows how to select its rows from the
dashboard payload and how to render one row:

```ts
export const myPullRequests: ColumnDef = {
  id: 'myPullRequests',
  title: 'My pull requests',
  select: (data) => data.columns.myPullRequests,
  renderItem: (item, ctx) => <PrCard pr={item} ctx={ctx} action="merge" />,
}
```

Adding, removing or reordering a list is an edit to the `COLUMNS` array in
`src/web/components/columns/index.ts`. Agents are similarly behind an
`AgentAdapter` (`src/server/agent/adapter.ts`) — adding one is a new adapter plus
a preflight entry.

## Known gaps

- Worktrees and mirrors under `~/.shazam/` are never garbage collected. Closing
  a session kills the process but leaves the checkout on disk.
- Each column is capped at `perColumnLimit` (100, GitHub's own ceiling for a
  search page); there is no pagination beyond that.
- Merge does not delete the branch, wait for a merge queue, or offer auto-merge.
- Sessions live in the server process; restarting `shazam` ends them.

## Assumptions

The developer has `gh`, `claude`, `codex` and `git` installed and is logged in on
the machine where this runs. Preflight checks all of them at startup and refuses
to start without `git`, `gh` and a working `gh auth status`.

## Design brief

The original brief this was built from:

> The goal of this project is to create a simple web application that can be run
> locally on a developer's machine which gives a single-pane state of the
> developer's work to be done on github, and give them quick actions to take that
> are currently several clicks in different tools.
>
> We are going to iterate on this idea as we assess its viability, so build
> components in a way that can easily be swapped in and out on the dashboard.
>
> - open pull requests that I have created in all repos sorted by last updated
>   descending. icons to show if it's approved, if it's passing/failing ci, if
>   there are review comments and/or changes requested. button to merge if it's
>   approved.
> - open/outstanding (I haven't reviewed yet) pull requests where I have been
>   assigned as a reviewer sorted by last updated descending. icons to show if
>   it's approved, if it's passing/failing ci. button to approve.
> - open issues i have created sorted by last updated descending. icon to show
>   how many comments. link to the issue.
> - all pr list entities should have a link to the pr and a shazam button:
>   opens a claude/codex session, clones the repo where the pr came from, at the
>   branch of the pr, with an initial prompt giving the instruction to load the
>   PR from the link and then be prepared to do work on this PR, including
>   responding to review comments.
> - lists should auto update periodically by polling
>
> Implementation: typescript, radix themes, dark/light mode, `npx blah serve`,
> validate the state of all the tools at startup.
