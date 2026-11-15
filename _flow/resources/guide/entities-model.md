# Flow Entities: Model

Essential model, paging and schema rules; open one drawer for the operation at hand.

`flow-entity-model-get({project})` returns the model and revision. Check the complete declaration with `flow-entity-model-check`, then write with `flow-entity-model-set({project,model,expectedRevision})`; a stale revision requires a fresh read. `gateway: true` creates the local `EntityGateway` for entity pages. Give IDs and revisions as text, including int64 values above JavaScript's safe integer.

`entity.list` returns one page (`rows`, `total`, `hasMore`, `nextOffset`), at most 200 rows. Never treat `rows` as complete until `hasMore` is false; page with `options.offset` or narrow the filter. Public entity calls use `checkAccess: true`. Policy scope is always applied, even with an empty filter group.

Declare the complete model before the first authorized data operation. The server ensures additive schema on first use; incompatible changes are refused. A private demo reset empties and reseeds tables and bypasses business hooks and access checks. On a server it requires the explicit `lib_flow_entity.demoReset.enabled` symbol; an HTTP entry point verifies ADMIN.

## Drawers

- `flow://guide/entities-model/lists` — open for filters, active rows, paging and `hasMore`.
- `flow://guide/entities-model/schema` — open for initialization, migrations, timestamps or demo reset.
- `flow://guide/entities-model/authoring` — open to check and set a model with a revision.
- `flow://guide/entities-model/format` — open for field types, relations, identities, traits and sources.
- `flow://guide/entities-model/unique` — open for uniqueness, ownership and sign-up constraints.
