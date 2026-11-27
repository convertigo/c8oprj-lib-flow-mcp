---
name: convertigo-flow-cli
description: Build or change a Convertigo Flow project as files on disk with the c8o command, without an MCP client. Use when the working directory is a Flow project (_flow/flows, _flow/blocks, .flow.svelte pages) and c8o is on the PATH, to check, sync, run and view it, read its guides and call any engine tool.
---

# Convertigo Flow with c8o

Start with `c8o guide sources` to create or edit a Flow.
Project files are authoritative. List commands with `c8o help`.

## The files

| What | File |
| --- | --- |
| Flow (FlowScript v3) | `_flow/flows/<Flow>.flow.js` |
| Project block | `_flow/blocks/<ns>/<name>.block.js`, its browser side `<name>.browser.js` |
| Page, layout, component | `.flow.svelte` under `_flow/frontbuilder/svelte/model/<App>/src/` |
| Theme | `.flow.css` under the same `src/` |
| Entity model | `_flow/data/model.yaml` |

The engine writes `_flow/schemas/**`, `c8oProject.yaml` and `_c8oProject/**`:
never edit them.

## The loop

1. Read (`rg`, `cat`) and edit the project files.
2. `c8o check` validates the changed files and saves nothing; `c8o sync`
   validates and saves them (blocks, model, Flows, then pages). After a model
   change, `c8o sync --gateway` also creates the `EntityGateway` of its pages.
   `c8o sync` declares the Flow, then publishes it with its inputs and `_flow` accessibility,
   replacing separate `flow-sync-inputs` and `project-save` steps.
3. Read every line of the answer:
   - `saved`: done. `saved, normalized by the engine`: read the file again
     before your next edit.
   - `REFUSED`, then `path:line: severity CODE (block.property): message` and
     `fix:`: nothing was saved. Fix the file and sync again before running it:
     `c8o run` reads the file on disk, HTTP keeps the last synced version.
   - `PENDING`: the file changed during the sync; sync it again.
   A Flow that uses a new block: sync them together; `check` does not see a
   block it has not saved.
4. `c8o run <Flow> key=value key:=<json>` tests in the engine without a session,
   with the full result as JSON on stdout and notes on stderr. `c8o call <Flow>
   key=value` makes an HTTP call with a reusable session. Sign in with the app's
   sign-in Flow, use `--as manager` / `--as contributor` for separate sessions,
   and free a licence session with `c8o session end --as <name>`.
   `c8o call <Flow> k=v --anonymous --json` proves a POST without cookies and reports status, received cookie names and body.
   `c8o session demo` lists the demo accounts a server provides and
   `c8o session demo <account> --as <name>` opens one without its password.
   Never guess passwords, create unrequested accounts or bypass authentication.
   If access fails, stop and report it.
   `c8o view` prints the viewer URL on its first line (it starts a stopped
   viewer); then check the page in the browser. To see it as a session,
   `c8o session cookie --as <name>` prints its cookies: add them with
   `browser_run_code_unsafe`
   (`async (page) => { await page.context().addCookies(<cookies>); }`), then
   open or reload the page.

Exit code: 0 ok, 1 refused, pending or failed, 2 usage or connection error.
Chain with `&&`; in a pipe, `set -o pipefail`. `--json` gives the whole result.

## Guides and tools

- `c8o guide` is the start guide with the tree of guides; `c8o guide sources`
  explains this mode and how to read the other guides in it;
  `flow://guide/<path>` is `c8o guide <path>`, `flow://lib/...` is
  `c8o guide flow://lib/...`.
- Before editing, read the relevant guide: `c8o guide sql` for direct SQL,
  `c8o guide authoring/source` for public Flow accessibility and
  `c8o guide authoring/data` for HTTP inputs, status and error body,
  `c8o guide entities` for entities,
  or `c8o guide frontend-svelte/loop` for Svelte.
- Find blocks with `c8o blocks <word>` or `c8o blocks --namespace <ns>`.
  A library's blocks enter the project catalog once the project references it.
- `c8o block <ns.name>`: the contract of a block. `c8o tools [word]` lists the
  engine tools, `c8o help <tool>` gives their arguments, and any tool a guide
  names runs as `c8o <tool> key=value` (the project is added).
- A guide step `code-set`, `code-patch`, `code-promote`,
  `flow-entity-model-set`, `frontend-svelte-mutate` or `authoring-mutate`:
  edit the file, then `c8o sync`. `flow-crud-upsert` and
  `flow-fullsync-scaffold` do not exist in this mode.
- A specification that says "through the MCP" means through `c8o`.
