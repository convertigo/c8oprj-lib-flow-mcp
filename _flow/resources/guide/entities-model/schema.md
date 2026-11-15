# Entity schema and demo reset

Read before schema initialization, migration changes or demo reset.

## Schema initialization and demo reset

The schema is ensured on the first authorized data operation, once per JVM,
connection settings and model fingerprint. Only additive changes are applied;
`autoVersion` derives the next schema version, while removed/changed columns
are refused before writes. No MCP database access or initialization step is
needed when writing the model. An explicit `entity.initialize({})` can also run
without a session; `dryRun:true` previews, `verifyOnly:true` checks a DBA schema.
`config.entities.schema: verify` makes the automatic check read-only.

Define the complete entity before the first `entity.*` call, including fields,
traits and relations. For example, set the model with both entities first:

```json
{"version":2,"modelVersion":1,"entities":{"Customer":{"fields":{"name":{"type":"string"}}},"Order":{"traits":["Horodaté"],"fields":{"amount":{"type":"decimal","precision":12,"scale":2},"customerId":{"type":"int64","relation":{"entity":"Customer","labelField":"name"}}}}}}
```

Only then call `entity.save({ entity: "Order", values: { amount: "12.50", customerId: "1" } })`.
After initialization, changing `amount`'s type or precision,
replacing a trait, or renaming its table is refused with
`SQL_SCHEMA_MIGRATION_UNSUPPORTED` (409): its message, `hint` and `details` name the
table, the column, the kind of change (`details.change`: `addColumn`,
`changeColumn`, `removeColumn`…) and the reason (`notNullWithoutDefault`,
`changed`, `missing`), never a row value. The full detail (the refusal text, a
failed statement and its database cause) is in the server log, and in
`details.detail`, `details.sql` and `details.cause` of a `code-run` only, never
in the answer of a Flow called over HTTP.
`flow-entity-model-set` refuses it before writing (`ENTITY_MODEL_STORAGE_CHANGE`, with
the declaration to restore; `confirmStorageChange: true` only for an unused entity).
Keep the existing declaration: add an entity, a nullable field, or a required
field with a default; copy old values into a new field, never alter the old one.
Send decimals as exact text, for example `"12.50"`; a JSON number within the
field's precision and scale is also stored as exact text, but a computed one
such as `0.1 + 0.2` is refused: send its text. Omit server-managed timestamps
on writes: `Horodaté` supplies `dateCreation` and `dateModification` (or declare
`"createdAt": {"type": "timestamp", "auto": "create"}`). A timestamp you send
is local `yyyy-MM-ddTHH:mm:ss`, without `Z`; declare `"timeZone": "Europe/Paris"`
at the root of the model so that automatic timestamps are written in that zone
too (UTC without it). A local time has no offset and an hour repeats when the
clocks go back: order a journal by revision or identity, never by timestamp.
Declaring or changing `timeZone` on a model that has data leaves its earlier
timestamps in their former zone. On `ENTITY_VALIDATION`,
`details.fields` names each refused field with its expected type and form.

`entity.initialize` is session independent. `entity.demoReset` runs only in Studio,
or when the server symbol `lib_flow_entity.demoReset.enabled` is explicitly true
(false by default). Both are exported building blocks. A reset Flow must be private;
a separate HTTP entry point verifies ADMIN and uses `requestable.call`.
The configured database account and its
DDL/DML grants are the production boundary; use a secret password symbol and
a restricted account, not root. Missing CREATE rights return a clear
ENTITY_SCHEMA_MISSING without the DDL plan; see the backend preview boundary in `flow://guide/entities-actions`.

Declare `demo: {dataFile: "_flow/resources/entities/demo.json"}` in the model.
The JSON seed maps entity names to rows using **field names**, not SQL columns;
IDs are text, dates ISO, and owner/currentUser values must be explicit because
there is no actor. Stored read-only fields can be seeded; computed fields cannot.
Auto timestamps are filled by the server. `entity.demoReset({})` explicitly
empties the model's SQL tables (including mapped tables and the journal), then
uses the SQL typed seed in dependency order. External provider entities are not
SQL tables and cannot be seeded this way. Cyclic dependencies need an explicit
application reset. See the private Studio `demo_reset` and seed in
`flow://guide/multipage-entities`. A server needs the explicit reset symbol; an
HTTP entry point must verify ADMIN before calling the private reset Flow.
Reset bypasses business hooks/access checks. Public CRUD must use the local
gateway or explicit `checkAccess: true`; trusted primitives are not session-bound.
