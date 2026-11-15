# Flow Generated CRUD

Generate CRUD only on an explicit request: the model, the generation modes, preview and proof; business logic on top in a sub-guide.

Use this generated path only when the user explicitly requests generated
CRUD. For any persisted business data with roles, the default is interpreted
entities: `flow://guide/entities`, then `flow://guide/multipage-entities`.
Authentication, CSV export and scheduled jobs do not select generated CRUD
or direct SQL (`flow://guide/start`).

## When to use it

When the user explicitly requests generated CRUD, use this guide before
writing generated CRUD Flows or pages. It suits a set of entities with list,
detail and form screens:
reference data managed by an administrator, records with a status, relations
between them, roles that may read or change each entity. One model gives the
SQL schema and seed, the secured Flows, the session and the pages in seconds;
your own work then goes to the business rules the model cannot express.

Do not use it for an application without tables of records (an API relay, a
FullSync application, a calculator): follow `flow://guide/start` instead.


Generated files belong to the model: change the spec and apply again, never patch generated sources. Preview with `dryRun:true`, then apply the same spec and `planHash`; prove the result. For persisted business data with roles, prefer interpreted entities unless generation was explicitly requested.

## Drawers

- `flow://guide/crud/model` — open to write the generated CRUD specification.
- `flow://guide/crud/lifecycle` — open for preview, apply, proof and evolution.
- `flow://guide/crud-business` — open for owned business Flows and page extensions.
- `flow://guide/crud-modes` — open for generation modes.
