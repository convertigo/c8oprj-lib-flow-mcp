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
2. Plan the Pages and transitions. Write each complete Page with `code-set`
   and `sourceFile`; it validates before the atomic write. Write target Pages
   before the Pages that navigate to them (`FRONTEND_NAVIGATE_PAGE_UNKNOWN`
   otherwise). A new Page has no revision; existing Pages use theirs.
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

A French application sets `app: { locale: "fr-FR" }` in the `_flow` header of
its entry source: `DataTable`, `Select` and the other controls then show French
texts and dates (the default locale is `en`).

On a project loaded in Convertigo, MCP writes are working copies like Studio
edits (`draft:true`, `dirty:true`): they are previewed and checked at once and
written to disk by **Save project**. Standalone runs write the files.
