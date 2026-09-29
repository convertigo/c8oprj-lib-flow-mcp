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
   (unified diff in `codepatch`, with the extract's `revision`).
3. When context is missing, read only that range with `code-get({ ...,
   revision, startLine, endLine })`; read a whole source only for an
   ambiguous or broad change.
4. For an executable Flow, `code-run` then `code-promote`; blocks and Flow
   Svelte sources are saved by `code-patch` itself.

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
