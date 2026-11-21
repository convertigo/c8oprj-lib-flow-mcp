# Flow Svelte authoring loop

Read before creating or modifying Svelte source and running the dev viewer.

## Authoring Loop

For a fresh, simple single-Page application, use this fast path and do not add
inspection calls between its steps:

```text
flow-project-bootstrap(ui:true) -> dev.ensure(wait:false) -> code-get
-> code-set(reveal:true) -> app.flow.css set if needed
-> dev.sync once -> one browser proof -> dev.open only if no viewer was returned
```

`dev.ensure`, `dev.sync` and `dev.open` are `actionId` values of
`frontend-svelte-action`. The bootstrap `studioTarget` and
`code-get.authoringContract` are sufficient to address the initial Page. Do
not call `frontend-svelte-tree` merely to rediscover it. When a portable block
property contract is missing, make one focused `authoring-palette` call with
the exact qualified `parentPath` returned by `code-get` or `authoring-tree`;
never compose that path from the logical Page id. After a successful
`code-set(reveal:true)`, use the authored `$$id` and source path as the reveal
target.

When bootstrap returns `existing:true`, treat the sequence as an existing
project, not as a creation. If the one `dev.ensure` response is already active
(`pending:false`, with `browser` and `openUrl`) and `code-get` proves that the
source already does what is asked, change nothing: a successful no-op for the sources. Do not repeat `dev.ensure`, and do not call `code-check`, `code-set`, `dev.sync` or `flow-app-progress` for unchanged source; verify the visible behavior asked that is not observed yet before answering. `code-check` is for an
explicit dry-run or a changed draft; `dev.sync` follows a mutation or completes
a pending preparation, never an unchanged active viewer.

1. Call `code-get({ project, kind:"source" })` once. It returns the current
   source, revision, every Page (`id`, `path`, typed parameters, sourceFile),
   the compact block contract and the application stylesheet path in
   `authoringContract.sources.applicationStyles`. Then call
   `frontend-svelte-action({ project, actionId:"dev.ensure", wait:false })`
   once: it preserves a running viewer and restarts it after a Studio
   relaunch. Do not poll or repeat it.
2. Plan the Pages and transitions. A link to a Page not written yet is a
   warning at writing and an error at the build (`FLOW_PAGE_LINK_UNKNOWN`)
   while that Page is missing: write every linked Page before building. Write each complete Page with `code-set`
   and `sourceFile`; it validates before the atomic write. A new Page has no
   revision; existing Pages use theirs.
   The home Page `flow-project-bootstrap(ui:true)` created exists: pass its `frontbuilderModelRevision`.
3. For later changes, `code-rg({ project, kind:"source", pattern })`: a unique
   match carries the `sourceFile` and `revision` for the smallest
   `code-patch`. Use a bounded `code-get` range only when context is missing.
   The same tools edit the stylesheet at
   `authoringContract.sources.applicationStyles`; do not guess that path.
4. Use one targeted palette lookup only when the contract lacks a block,
   property or schema path, and a focused tree only when a source target is
   genuinely unknown. Apply returned picker mutations unchanged.
5. The UI bootstrap prepares the dev server while you author (existing backend
   included); keep it: the first `dev.ensure` then answers at once.
   `devStart:false` remains available when you choose to refuse preparation,
   such as for a backend-only check. Vite starts after setup without opening
   a viewer. Call `dev.sync` once
   after the final repair pass; use `dev.open` to reveal the running viewer.
6. `flow-app-progress` is optional on the fast path; add `qname` only when a
   real backend Flow is part of the application. Prove the requested visible
   and interactive behavior in the live viewer, including images without 404.
   Build production only for deployment or an explicit production check;
   an application handed to users (acceptance criteria, links in e-mails) is
   a deployment: `frontend-svelte-action({ project, actionId:"build" })`, then
   check that `<server>/convertigo/projects/<project>/DisplayObjects/mobile/`
   serves it. Links meant for users use that URL, never the dev viewer.
   Never claim a color, layout, timer, navigation or viewer state that was
   not observed.

For a multi-page build, make the target-Page step above three passes: create
minimal skeletons for **all** Pages with their final ids, add links only after
every target exists, then fill each Page with its full content. Validate after
each pass.

For a multi-page application, group the browser proof by visible assertions:
open a fresh session, submit login and assert the signed-in identity; visit
each list and assert its rows; open a record and assert its details; add one
record and assert it appears; edit it and assert the new value; trigger a
recalculation and assert the updated total. Also assert a failed login displays
its error. Wait for the relevant element or backend response at each step,
using the browser tool's actual selector/target and parameter contract; avoid
fixed sleeps. One coherent verifier run can collect these assertions and
screenshots without restarting the viewer between pages.

A French application sets `app: { locale: "fr-FR" }` in the `_flow` header of
its entry source: `DataTable`, `Select` and the other controls then show French
texts and dates (the default locale is `en`).

For browser proof, reuse the current context. Open at most one additional
context per role (for example, USER and manager), and keep each until its checks
finish. Sign out in the application (`SignOut`/`Logout`) before closing an
unused test context; closing it alone leaves its Convertigo session alive.
The development engine allows only 5 HTTP sessions in Standard Edition, and
each browser context can occupy one for 30 minutes. If all MCP calls suddenly
fail without a readable response, suspect the session limit: sign out and
close test contexts, retry once, and report it.

`code-set` and `code-patch` validate, then atomically save canonical `.flow.svelte`, `app.flow.css`
and `theme.flow.css` files, also in Studio. No promotion; `code-check` is the dry-run. Backend Flows
keep `code-run` → `code-promote`. Before declaring a batch finished, check `unsavedSources.count` in
`dev.sync`, build or `flow-app-progress`: it must be `0`. Resolve each draft with `code-promote`
(Flow), a direct Svelte save, or `code-discard` to abandon it.

`dev.sync` on a stopped server reports `status`, `stopReason` and `next: dev.ensure(wait:true)`.
During preparation, `dev.sync(wait:true)` waits for readiness or reports its deadline.
