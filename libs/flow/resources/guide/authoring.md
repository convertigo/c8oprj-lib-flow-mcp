# Flow Authoring Cycle

Create or modify a Flow sidecar with the smallest loop that proves behavior:

- `flow-list` only to enumerate known Flow names.
- `flow-search` to locate nodes, schemas, block docs or existing examples. Multi-word queries match unordered tokens, like a small `rg`.
- Avoid `flow-catalog detail:"compact"` when an example exists. Use `flow-block-get` for one unknown block, and `flow-catalog` summary only to discover names.
- `flow-context` at the target node to know `request`, `input`, `config`, `local`, `current` and `result` paths.
- For broad edits, use `flow-get.definition`, modify that object, then send it back through `flow-set`.
- Prefer `flow-node-add/edit/move/delete/duplicate` for common node operations.
- For source resources (`libs/flow/blocks`, `libs/flow/types`, type editors), use search/get/patch instead of replacing whole files.
- Use `flow-edit` for lower-level mutations; use `dryRun:true` when unsure.
- With a live `project`, named write tools register/save the Flow DBO and refresh Studio by default. This makes the Flow callable through normal `?__sequence=Name` execution.
- `flow-test` with realistic input and `includeTrace:true` only while debugging.

Do not read every Flow sidecar up front. Search first, then open the narrow target.
