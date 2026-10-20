# Search And Edit

Locate existing Flow code with `flow-search` and `code-rg`, then change it with the smallest revision-checked `code-patch`.

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
   (unified diff in `codepatch`, with the extract's `revision`). The line
   numbers of every hunk refer to that revision, hunks may come in any order,
   and each hunk needs its exact context lines: re-read the range with
   `code-get` rather than guessing a context.
3. When context is missing, read only that range with `code-get({ ...,
   revision, startLine, endLine })`; read a whole source only for an
   ambiguous or broad change.
4. For an executable Flow, `code-run` then `code-promote`; blocks and Flow
   Svelte sources are saved by `code-patch` itself. `code-promote` may omit
   `revision` to select and recheck the only current draft; an explicit stale
   revision stays refused. `FLOW_CODE_UNSAVED_WORKING_COPY` gives the `qname`
   and `revision` to resume.

Backend writes (`code-set`, `code-patch`) apply only unambiguous corrections:
a nested block call lifted into a named intermediate, positional arguments
named from the block contract, a statically read input or block property
declared. Each one is listed in `fixes` (`code`, `line`, `before`, `after`)
with the complete corrected code: inspect them, and use the returned
`revision` for the next patch. Everything that changes the meaning stays a
refusal with its diagnostic (unknown block, ambiguous signature, changed
execution conditions, repeated external calls).

Typical source edits:

- change a value: patch the property line inside the call identified by its
  `$$id`;
- skip a node: add `$$disabled: true` (FlowScript) or `$$disabled={true}`
  (Flow Svelte); remove it to restore the node;
- insert a node: add the new call on its own line next to its sibling, with a
  new unique `$$id`;
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
