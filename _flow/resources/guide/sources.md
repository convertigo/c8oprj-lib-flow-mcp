# Sources Mode

When `tools/list` starts with `flow-source-sync`: edit the project files on disk, then sync them.

The project files on disk are the truth. Read, search and edit them with your
own file tools; then `flow-source-sync` checks each changed file with the
validator of its kind (the one of `code-check`) and saves it. A synced file is
saved: there is no working copy and nothing to promote. Flows and pages are
saved as written; the engine may normalize a block, and it saves the data
model as JSON, which is valid YAML.

## The files

| What | File |
| --- | --- |
| Executable Flow | `_flow/flows/<Flow>.flow.js` (FlowScript v3, `sourceVersion: 3`) |
| Project block, contract and backend code | `_flow/blocks/<ns>/<name>.block.js`, block `ns.name` |
| Browser implementation of a block | `_flow/blocks/<ns>/<name>.browser.js`, next to its `.block.js` |
| Page, layout, component | `.flow.svelte` under `_flow/frontbuilder/svelte/model/<App>/src/` (`sourceVersion: 2`) |
| Theme CSS | `.flow.css` under the same `src/` |
| Entity model | `_flow/data/model.yaml` |

Never edit `_flow/schemas/**`, `c8oProject.yaml` or `_c8oProject/**`: the engine
writes them (schemas when a Flow runs or is saved, Convertigo objects when a
Flow is synced), and a sync without `paths` ignores them. Output schemas are
managed by `flow-output-schema` and `flow-schema-reset`.

## The loop

1. If the project does not exist, create it with `flow-project-bootstrap`: it
   writes the first files.
2. Edit the files.
3. `flow-source-sync({ project })`. Without `paths` it takes every file
   changed since the last sync, in this order: blocks, browser
   implementations, data model, Flows, pages. `dryRun: true` checks without
   saving.
4. Read each result:
   - refused: nothing was saved. The file stays on disk: `code-run` reads it,
     while HTTP keeps the last synced version. Fix it and sync again before
     running. The diagnostics, hints and
     guide links are those of `code-check`; apply a `proposedPatch` to the
     file. A data model that removes or retypes a stored field is refused
     against the last synced model.
   - `rewritten: true`: the engine normalized the file when saving it. Read it
     again before your next edit.
5. Prove it: `code-run` for a Flow; for a page, `frontend-svelte-action`
   `dev.sync`, then the browser.

## Reading the other guides in this mode

| A guide says | In sources mode |
| --- | --- |
| `code-set`, `code-patch` (Flow, block, page) | edit the file, then `flow-source-sync` |
| `code-promote`, `code-status`, `code-discard`, working copy, `unsaved` | nothing to do: a synced file is saved |
| `flow-entity-model-set` | edit `_flow/data/model.yaml`, then sync; `flow-entity-model-check` stays available |
| `flow-entity-model-set` with `gateway: true` | `flow-source-sync({ project, gateway: true })` after the model: it creates the `EntityGateway` of EntityTable and EntityForm pages |
| `flow-block-mock` | write the `.block.js`, and the `.browser.js` for a browser target, yourself |
| `frontend-svelte-mutate`, `authoring-mutate`, an `apply` of `authoring-palette` | edit the file at that node |
| Deleting a Flow, block or page | not available: a deleted file is reported, nothing is removed in the engine |

`flow-crud-upsert`, `flow-fullsync-scaffold` and
`frontend-svelte-fullsync-schema` are not available in this mode. Reading,
search, guides, palette, `code-check`, `code-run`, the dev actions and
`flow-app-progress` work as everywhere else, and so do the tools that change
what is not a source file: `flow-project-reference`, `flow-project-symbol-set`,
`frontend-svelte-asset-import`, `tags-apply`.
