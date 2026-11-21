# Flow Entities: Model

Essential model, paging and schema rules; open one drawer for the operation at hand.

`flow-entity-model-get({project})` returns the model and revision. Check the complete declaration with `flow-entity-model-check`, then write with `flow-entity-model-set({project,model,expectedRevision})`; a stale revision is refused (`ENTITY_MODEL_STALE`) with the stored revision in `details.currentRevision`. `gateway: true` creates the local `EntityGateway` for entity pages. Give IDs and revisions as text, including int64 values above JavaScript's safe integer.

`entity.list` returns one page (`rows`, `total`, `hasMore`, `nextOffset`), at most 200 rows. Never treat `rows` as complete until `hasMore` is false; page with `options.offset` or narrow the filter. Public entity calls use `checkAccess: true`. Policy scope is always applied, even with an empty filter group.

Declare the complete model before the first authorized data operation. The server ensures additive schema on first use; incompatible changes are refused. A private demo reset empties and reseeds tables and bypasses business hooks and access checks. On a server it requires the explicit `lib_flow_entity.demoReset.enabled` symbol; an HTTP entry point verifies ADMIN.
