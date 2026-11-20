# Flow Generated CRUD: Owned Code And Business Logic

What generated CRUD owns, then hand-written business Flows, transactions, per-user data, pages, sign-in, CSV and jobs on top.

## What is generated and owned

Every generated file starts with an `@generated` comment and belongs to the
model: never edit it with `code-set` (refused) or by patching; change the model
and apply again. A hand edit makes the next apply fail with
`FLOW_CRUD_GENERATED_CONFLICT` and the proof report it.
Hand-written Flows and pages live next to the generated ones under their own names; apply never touches them.

| Flow (prefix `desk`) | Inputs | Result |
| --- | --- | --- |
| `desk_<entity>_list` | `offset`, `limit` (1-200), `search`, `filter`, `orderBy`, `direction`, `includeResource` (default false) | `page.rows[]` (`key`, `values`, `displayValues` with relation labels, `canRead`, `canUpdate`, `canDelete`), `page.total`; `resource` only with `includeResource: true` |
| `desk_<entity>_read` | `id` | `row` (`key`, `values`, `displayValues` with relation labels); 404 when absent |
| `desk_<entity>_count` | none | `rows[0].total` |
| `desk_<entity>_options` | `labelField` | `rows[]` (`value`, `label`), at most 200 |
| `desk_<entity>_save` | `id` (empty to create), `revision`, `patch` (object) | the data write result: `{resource, mutation}`, the row in `mutation.row.values` |
| `desk_<entity>_delete` | `id`, `revision` | the data write result |
| `desk_session` | none | `authenticated`, `user`, `role`, `permissions.<entity>.<operation>` |
| `desk_demo_login`, `desk_logout` | `user` / none | sign in (demo only) / sign out |
| `desk_initialize`, `desk_runtime_proof` | none | private: schema and seed / read-only checks |

A list resolves the labels of its relations with one `data.read` per
relation over the keys of the page (`filter: {field, op: "in", value: keys}`,
at most 200), then looks each row up in a map. A business Flow that shows
related labels does the same: never one read per row.

Each generated Flow carries in its `_flow.config` only the connection, named
queries, writes, data sources and `crud` settings its body names;
`_flow/data/config.generated.json` keeps the whole configuration. A business
Flow that calls `data.read` / `data.write` on a generated source finds it in
the project `config` of `_flow/engine.yaml`, where apply registers it once
(Call the generated Flows), not in a copy inside each Flow.

Each entity Flow checks the session and the role on the server, whatever
calls it. Pages: `+layout.flow.svelte` (an `AppShell` with one link per
entity, unless its `ui.navigation` is `false`, and the root `ui.navigation`), the dashboard (`crud_dashboard`, or a redirection
to `ui.homePage`), `login` (`crud_login`; `ui.loginPage` replaces it as the
sign-in the pages lead to) and, per entity, `<entity>` (`<entity>_list`),
`<entity>/detail` and `<entity>/form`. SQL lives in
`_flow/resources/sql/crud` (`schema.json`, `data.json`, the HSQLDB database).
