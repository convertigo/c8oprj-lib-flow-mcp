# Search And Edit

Locate existing Flow code with `flow-search` and `code-rg`, then change it with the smallest revision-checked `code-patch`.

For `code-set` and `code-patch`, prefer the returned `revision`. If it is
omitted, an authenticated MCP conversation (`X-Convertigo-Conversation-Id`
or `Mcp-Session-Id`, with a separate subagent run) can reuse the revision of
its last `code-get` or actual write to that source. This observation expires
after one hour and may be evicted earlier. It never means “use the latest
revision”: a concurrent edit still fails. Without an observation, the existing
revision requirement applies. An explicit revision always wins.

A refused backend write with `written:true` is the new working copy: use the
revision in that refusal. A refused frontend write is **not** saved: apply
`error.details.proposedPatch.edits` to the submitted text and retry `code-set`
with the previous revision. Backend `proposedPatch.edits` can be sent directly
to `code-patch` with `proposedPatch.revision`. A patch marked `requiresChoice`
needs the indicated value first. Do not resend the last successful text as a
patch base. `oldText` must match exactly once; use `code-set` for a whole source.


## Find

`flow-search` is the Flow equivalent of `rg` over one project. Project scope
also searches visible library samples, and matches are scored token by token,
so `GetFeed requestable call` finds a `requestable.call` node whose
requestable is `.GetFeed`. Useful arguments: `query`, `kinds:["sample","node"]`,
`context:1`, `limit`, `cursor`. Samples are private executable Flows named
`sample_*` (`kind:"sample"`); open the matching one first.

Each node match returns `flowQName`, `flow`, `nodeId` (the node `$$id`), a
canonical JSON Pointer `path`, `summary` and `snippet`. Reuse `path` as
`nodePointer` in `flow-node-output-schema` when a `nodeId` is ambiguous.

`code-rg({ project, qname | block | sourceFile | kind:"source", pattern })`
searches the code itself and returns revisioned contextual extracts.
`flow-resource-search` covers other project resources (types, editors,
libraries, fragments).

## Edit

1. `code-rg` for the phrase, property or `$$id` to change.
2. When one extract identifies the change, apply the smallest `code-patch`
   with the extract's `revision`, in one of two formats. `edits` replaces
   exact texts, in order: `edits: [{ oldText: "local.price = 10", newText:
   "local.price = 12" }]`; each `oldText` is copied from the code read and
   found exactly once, otherwise nothing is written (`EDIT_TEXT_NOT_FOUND`,
   `EDIT_TEXT_NOT_UNIQUE` with the lines: extend `oldText` with a
   neighbouring line). `codepatch` is a unified diff: the line numbers of
   every hunk refer to that revision, hunks may come in any order, and each
   hunk needs its exact context lines: re-read the range with `code-get`
   rather than guessing a context. Send one format, not both. Prefer `edits`
   to rebuilding the code in a script: in JavaScript, `code.replace(old,
   text)` and `replaceAll` read `$$` in `text` as a single `$`, so `$$id`
   becomes `$id`; pass `() => text` or use `code.split(old).join(text)`.
3. When context is missing, read only that range with `code-get({ ...,
   revision, startLine, endLine })`; read a whole source only for an
   ambiguous or broad change.
4. For an executable Flow, `code-run` then `code-promote`; blocks and Flow
   Svelte sources are saved by `code-patch` itself. `code-promote` may omit
   `revision` to select and recheck the only current draft; an explicit stale
   revision stays refused. A `code-run` of a draft answers `unsaved:true` with
   the `qname` and `revision` to resume.

Backend writes keep the exact submitted text. Equivalent forms compile without
rewriting. A guessed block name, key, positional call or lifted intermediate
is offered as a `proposedPatch` with line, before/after and exact replacement
edits. Review it and patch explicitly; `autoCorrect` never applies it.
Promotion alone formats and checks the same tree, returning `linted`,
`changedLines`, and the text revision. Unchanged text keeps its revision.

Typical source edits:

- change a value: patch the property line inside the call identified by its
  source line or implicit name;
- skip a node: add `$$disabled: true` (FlowScript) or `$$disabled={true}`
  (Flow Svelte); remove it to restore the node;
- insert a node: add the new call on its own line next to its sibling, with a
  new unique source line or implicit name;
- move a node into a slot: cut its call into the `$$then`, `$$else`,
  `$$nodes` or `$$fields` function (FlowScript) or the slot tag (Flow Svelte).

Rename a `$$id` with a mutation replacing `<node path>.id`
(`frontend-svelte-mutate`, `authoring-mutate`), as the Studio Rename does: the
references in the same file follow (States, actions, ForEach, short
references, destinations, free expressions) and a backend node keeps its
learned output schema. A text patch does not rewrite anything. A rename that
would leave another file with an unresolved reference is refused
(`FLOW_RENAME_REFERENCE_CONFLICT`), nothing is written.

## Structure and palette

`authoring-tree` gives a compact structural view of a project's Flow and
frontend surfaces; `frontend-svelte-tree` does the same for the Svelte
builder, with `detail:"inspect"` for one property picker. `authoring-palette`
lists the blocks accepted at one qualified `parentPath`; execute an item's
`apply` unchanged. `authoring-mutate` and `frontend-svelte-mutate` apply
structured mutations returned by the palette or picker; prefer source patches
for everything else.

A tree node names its object twice. `summary` is the line the Studio tree shows,
its main configuration (`bronn = false`, `if page.count > 0`,
`loginCard · padding: 24px`): read it to follow a Flow or a page without
fetching every node. It may be truncated with `…`, never parse it. Its identity
is `path` and `nodeId` (the `$$id` of the source): address and edit nodes with
them, and read or change their properties, never their summary.

## Project resources

`_flow/engine.yaml`, types, editors, libraries, fragments, project documents
and Java sources are project resources: read one with
`flow-resource-get({project, path})`, then change it with
`flow-resource-patch` and the returned `hash` as `baseHash`.

- `patch` is a unified diff of the text read: several hunks in file order,
  numbered on that text, `--- a/` and `+++ b/` headers optional. An unchanged
  line starts with a space, an empty unchanged line is one space. A hunk whose
  numbers are off is applied where its lines match once; a mismatch answers
  `PATCH_CONTEXT_MISMATCH` with the expected line and the actual lines around.
- Give an inserted block one unchanged line before or after it: a hunk made of
  added lines only (`@@ -N,0 +M,k @@`) is placed by its numbers alone, after
  line N, and is refused when M disagrees (`PATCH_INSERT_AMBIGUOUS`).
- `content` replaces the whole text instead, with `baseHash`: simpler for many
  changes or a short file such as `_flow/engine.yaml`.
- `fromFile` copies a file of the Convertigo workspace or of the folder of the
  projects (in the Studio, the folder holding the projects and the documents a
  user puts next to them) into the resource, byte for byte, instead of sending
  its text: `fromFile:"notes/guide.md"` with `path:"docs/guide.md"`. Its path is
  relative to one of them (the workspace first) or absolute, outside hidden
  folders, the `_private` folders of projects and the private folders of the
  workspace; replacing an existing resource needs `baseHash`.
- The text is written as computed, line for line, and the answer gives the new
  `hash` for the next change: do not read the resource again in between. An
  engine configuration change made by another tool (`authoring-mutate` or a
  palette item on the engine configuration, saved with the project) renders
  `_flow/engine.yaml` again as a whole: its hash then changes, and a stale
  `baseHash` is refused (`RESOURCE_BASE_HASH_MISMATCH`). Read it again then.

## Project HTTP exclusions

`flow-resource-get({project,path:".httpignore"})` reads the exact root file.
Patch it with the returned hash (`baseHash`), first with `dryRun:true`, to add
private directories such as `/docs/flow-port/`. Creation uses the SHA-256 of
an empty file. The API preserves `/_flow/` and every existing ignore rule;
it refuses removing rules, adding unignore (`!`) rules, deleting the file,
control characters and files over 64 KiB. These safeguards still apply with
`validate:false`. Other root dotfiles and paths outside the project remain
inaccessible. Private material belongs under an excluded directory; public
assets stay outside it. A literal path containing `input.csv` is text, not an
undeclared Flow input.

An unknown block is diagnosed before nested-call corrections; inspect its
suggestions and keep the intended contract. No suggested block is substituted
automatically.

## Cancel a frontend working copy

`code-discard({project:"App",sourceFile:"_flow/frontbuilder/svelte/model/App/src/routes/scratch/+page.flow.svelte"})`
discards only that source's working copy. A scratch page that was never saved disappears; a saved page returns to its
saved text. `recoveryFile` names a backup of discarded text under the project's `_private/flow-discard/` folder.
To diagnose a refused new source, send its text inline to `code-check({project:"App",sourceFile,code})`.
