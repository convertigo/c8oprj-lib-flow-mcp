# Flow project workspace

Read for authentication add-ons, project layout, drafts, Save and caches.

## Authentication and add-ons

These additions are independent of the data route:

- Session and actor provider: `flow://guide/entities-auth`, Authentication section.
- Demo login, CSV, jobs and audit: `flow://guide/multipage-entities-access` and `flow://guide/multipage-entities/pages` for pages or `flow://guide/multipage-entities/operations` for CSV and jobs.

Accounts, passwords and roles: reference `lib_UserManager` and read
`flow://lib/lib_UserManager/user-manager` (sign-in Flow, `actorProvider:
userManager.actor`, a confirmed demonstration account with a password).

A password-free demo login requires `String(config.demo.login) === "true"`;
bootstrap declares `<project>.demo.login` false by default. Enable it only for a
demo, never production. Identity and roles come from the server. CSV reuses read
permissions/filters; jobs are private and bounded, without a browser session;
mutation and allowlisted audit share a transaction. Never journal secrets.

Address executable Flows with `qname:"Project.Flow"`, project blocks with
`block:"ns.name"`, and Flow Svelte or CSS sources with `sourceFile`. Never
encode a block in `qname`.

## Project layout

Flow sources live only under `<project>/_flow/`, which `.httpignore` keeps
private (`/_flow/`). Public files live outside it (project `resources/`, app
`static/`).

| Path | Content |
| --- | --- |
| `_flow/engine.yaml` | project Flow `config` and frontbuilder settings |
| `_flow/flows/<Name>.flow.js` | executable Flow (FlowScript) |
| `_flow/blocks/<ns>/<name>.block.js` | block: `_meta` then FlowScript function or Rhino IIFE |
| `…/<name>.hooks.js`, `…/<name>.browser.js` | analysis hooks, browser implementation |
| `…/<name>.block.defaults.json` | optional defaults history |
| `_flow/types/*.type.yaml`, `_flow/types/editors/*.html` | property types and their editors |
| `_flow/schemas/<Flow>/<node>.out.schema.json` | learned or adopted output schemas |
| `_flow/fragments/*.fragment.yaml` | fragments used by `fragment.use` |
| `_flow/icons/iconify/<set>/<name>.svg` + `LICENSE.json` | icons (SVG only) |
| `_flow/fonts/<provider>/<family>/font.json` + `*.woff2` | custom fonts |
| `_flow/dependencies.json` | definer versions, written on save |
| `_flow/frontbuilder/svelte/model/<App>/src/routes/**` | Pages and Layouts (`+page.flow.svelte`, `+layout.flow.svelte`) |
| `_flow/frontbuilder/svelte/model/<App>/src/{lib,theme.flow.css,app.flow.css,i18n}` | app components, theme, CSS, translations |
| `_flow/frontbuilder/svelte/components/<ns>/<Tag>.flow.svelte` | shared (Catalog) components |

Generated output (`_private/svelte`, `DisplayObjects/mobile`) is never edited.

## Drafts, Save and caches

- Add references before drafts: persisted business data with roles needs
  `lib_flow_entity`; its storage/transaction layer and explicit direct SQL use
  `lib_flow_sql` and `lib_flow_crud_data`.
  On `PROJECT_HAS_STUDIO_DRAFTS`, retain Flow code with `code-get`, then
  `code-promote` valid drafts. For drafts needing the reference: retain code,
  `code-discard`, add the reference, then restore with `code-set`.
- Studio edits are in-memory working copies: the Properties **Apply** button
  changes a draft, **Save project** writes files, Reload discards drafts.
- MCP reads and previews share Studio working copies (`draft:true`), including
  frontend, Catalog and palette-created sources. Ask for **Save project** when
  done; `saveProject` refuses while other unsaved Studio work exists.
- `code-set` / `code-patch` on a Flow update its working copy (the Studio
  shows it unsaved); `code-promote` with the returned `revision` saves it.
  Project `.block.js` sources are written directly by `code-set`, which is
  refused while the Studio has unsaved changes to that block.
- Runtime caches follow project source fingerprints automatically. Exception:
  after lib_flow_engine or frontbuilder code changed outside the Studio (git
  pull, disk edit), call `flow-cache-clear` once for the project, then retry.
- The first `authoring-tree`, palette or `code-get` on a cold project can
  take several seconds; do not retry it.
