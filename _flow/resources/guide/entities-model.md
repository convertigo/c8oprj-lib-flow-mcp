# Flow Entities: Model, Lists And Schema Initialization

Entity model authoring and format, list filters and pages, schema initialization and demo reset.

Sub-guide of `flow://guide/entities`: read that guide first.

## Lists: filters and pages

`entity.list` returns **one page**: `rows`, `total`, `hasMore`, `nextOffset`
(`limit` 25 by default, 200 at most). `options.filter` is ANDed with the policy
scope and takes the same short form, `{field: value}` (equalities, relations
included; an array means one of, `null` an empty value, an absent value is
`ENTITY_FILTER_INVALID`), or `{field, op, value}` with `eq`, `in`,
`contains`, `between`, grouped by `{and:[...]}` / `{or:[...]}`. Do not use `rows`
as the whole list without checking `hasMore`: `code-set` warns
`ENTITY_LIST_PAGE_UNCHECKED`, and a run that gets a partial page without an
offset warns `ENTITY_LIST_INCOMPLETE`. The first is a heuristic on the source text:
it can miss a case (false negatives) and never proves that a list is complete.

```javascript
local.page = entity.list({
  entity: "Ticket",
  checkAccess: true,
  options: { limit: 200, filter: { equipmentId: input.equipmentId } },
})
if (local.page.hasMore) {
  throw { code: "TOO_MANY_ROWS", message: "Narrow the filter" }
}
result.tickets = local.page.rows
```

An empty group is the neutral element of its operator: `{and: []}` adds no
condition and `{or: []}` matches no row (as `{field: []}` does), so a filter
built piece by piece may start from either. Both stay ANDed with the policy
scope: an empty group never reaches a row outside it. A group holds at most 12
members, 5 levels deep. For `options.active` of an `Activable` entity, see
**Inactive rows** in `flow://guide/entities-policy`.

To page instead, pass `offset: input.offset || 0` and return `local.page.nextOffset`
(`null` on the last page) with the rows.

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
During development, keep the existing declaration and add a new entity (table)
or a new nullable field (column), or a required field with a default. Copy old
values into a new field explicitly if needed; do not rename or alter the old one.
Send decimals as exact text, for example `"12.50"`; a JSON number within the
field's precision and scale is also stored as exact text, but a computed one
such as `0.1 + 0.2` is refused: send its text. Omit server-managed timestamps
on writes: `Horodaté` supplies `dateCreation` and `dateModification` (or declare
`"createdAt": {"type": "timestamp", "auto": "create"}`). A timestamp you send
is local `yyyy-MM-ddTHH:mm:ss`, without `Z`. On `ENTITY_VALIDATION`,
`details.fields` names each refused field with its expected type and form.

**Neither entity.initialize nor entity.demoReset is protected by session, role
or a library demo switch.** The application protects any public caller. Private
Convertigo code has no internal ACL. The configured database account and its
DDL/DML grants are the production boundary; use a secret password symbol and
a restricted account, not root. Missing CREATE rights return a clear
ENTITY_SCHEMA_MISSING without the DDL plan; see Backend preview boundary.

Declare `demo: {dataFile: "_flow/resources/entities/demo.json"}` in the model.
The JSON seed maps entity names to rows using **field names**, not SQL columns;
IDs are text, dates ISO, and owner/currentUser values must be explicit because
there is no actor. Stored read-only fields can be seeded; computed fields cannot.
Auto timestamps are filled by the server. `entity.demoReset({})` explicitly
empties the model's SQL tables (including mapped tables and the journal), then
uses the SQL typed seed in dependency order. External provider entities are not
SQL tables and cannot be seeded this way. Cyclic dependencies need an explicit
application reset. See the complete public `demo_reset` and seed in
`flow://guide/multipage-entities`; its optional guard belongs to the application.
Reset bypasses business hooks/access checks. Public CRUD must use the local
gateway or explicit `checkAccess: true`; trusted primitives are not session-bound.

## Model authoring without generated code

1. `flow-entity-model-get({project})` returns the model, its canonical path and
   revision. `revision:"missing"` means first creation.
2. `flow-entity-model-check({project,model})` runs validation without writing.
   Inspect `valid` and every diagnostic's `code`, `path`, `severity` and
   `message`. This verifies declarations, not a live database or user session.
3. `flow-entity-model-set({project,model,expectedRevision})` checks the same
   model and writes only with the revision just read. A stale revision is a
   conflict: read again, reconcile the change and check before retrying.
   An invalid declaration never replaces the stored model.

The model is JSON data, including literal strings containing braces. It is not
FlowScript. Entity operations interpret it; this tool creates neither CRUD
Flows nor pages. Keep project-specific validation and side effects as ordinary
Flow hooks. SQL initialization is explicit and preserves existing data.

<!-- example: equipment-model -->
```json
{"version":2,"modelVersion":1,"entities":{"Equipement":{"label":"Equipment","display":{"title":"libelle"},"permissions":{"read":["USER","ADMIN"],"create":["USER","ADMIN"],"update":["USER","ADMIN"],"delete":["ADMIN"]},"traits":["Activable","Horodaté","Révisé"],"fields":{"libelle":{"type":"string","maxLength":120},"dateDerniereVerification":{"type":"date","notFuture":true}}}}}
```

When using lib_UserManager for ownership and responsible-person pickers, declare `imports: {userManager:
"lib_UserManager"}` and a local read-only `Utilisateur` entity with
`extends:"userManager.User"`, rather than copying its SQL table. Read the installed entity and user
manager contracts for the exact identity type, directory adapter and allowed
roles. Never store a password, reset token or authentication secret in the
business model, frontend source, journal or tool output.

## Model format

`"version": 2` is required. `flow-entity-model-check` and `flow-entity-model-set`
refuse an unknown section, entity or field property, type, trait or trait
parameter, and a reference to a missing entity or field, naming its full path
(`entities.Task.fields.team.type`), the accepted values and the correct form,
every problem at once. The `model` property of both tools
lists every accepted key; `flow-entity-model-get` on an empty model returns the
same `format` and the exact `example` shown in **Short path** of `flow://guide/entities`.

- **Types:** `string`, `text`, `enum` (with `values`), `int64`, `decimal`,
  `boolean`, `date`, `timestamp`. There is no array or JSON type: store
  serialized JSON in a `text` field, or declare a related entity. A field
  without `default` is required unless `nullable: true`.
- **Identity:** `"identity": ["id"]`, the default, without an `id` field, is an
  int64 auto-incremented by the database. Never send it on create; read it in
  `row.key.id`.
- **Relation:** not a type. The field has the type of the target identity,
  `int64` for the default identity as in the example (an imported identity may
  be a `string`), and `relation: {entity, labelField}`; `where` filters its options.
- **Traits:** `Possédé: {owner, unrestricted}` names the owner field, which the
  trait adds and fills with the session user, and the roles that see every row;
  it needs `Révisé`. `Journalisé` takes `{fields: [...]}`; `Révisé`, `Horodaté`,
  `Activable` and `Immuable` take no parameter.
- **Project traits:** `"traits": {"Tagged": {"parameters": {"tag": "tag"}, "fields": {"$tag": {"type": "string", "maxLength": 40}}}}`
  at the model level. `parameters` gives each parameter its default, taken by a
  `"$name"` field name or value; `fields` are declared as on an entity, `rules`
  is a list of `{kind, ...}` (`active`, `owner`, `deadline`, `revision`,
  `immutable`, `audit`) and `ui` holds display hints. An entity lists the trait
  as `"Tagged"` or `{"Tagged": {"tag": "genre"}}`.
- **Source:** `"source": {"provider": "app.directory"}` on a `"readOnly": true`
  entity: the named block lists its rows; it receives `ids`, `search`, `offset`
  and `limit` and returns `{users, hasMore}`. `provider` is the only key, and
  the entity is never written.
- **Outputs:** with a literal entity name, `entity.list`, `entity.read`,
  `entity.describe` and `entity.options` declare the fields of that entity, so
  pickers and binding diagnostics offer them. `labels.<relation>` is the text
  of the related label field, `—` when the related row is missing; it is
  optional: it is omitted when the related entity is refused. With a dynamic
  `field`, `entity.options` leaves the types of `value` and `label` open.
- **Hidden and required:** a field hidden by `visibleTo` from a role that may
  create needs a `default`, an `auto` rule or the policy create scope (a hook
  cannot fill it); otherwise the model is refused.
- **Unique:** `"unique": true` keeps one row per value of a field; see
  **Unique fields** below.

**Natural key.** An entity may declare a natural identity, such as
`"identity": ["email"]` with a `string` field: `entity.read`, `entity.delete`
and `entity.save` with `key: {email}` (an update, never an upsert) use it.
`entity.save` creates a row only when the database generates its identity, so a
create on such an entity answers `ENTITY_NATURAL_KEY_CREATE_UNSUPPORTED` (400),
after the access policy and before any write; it names only the identity
fields the actor sees. To create rows today, give the entity the generated
identity (declare no identity: an int64 `id`) and declare the natural key as
an ordinary field with `unique: true` (**Unique fields** below), read with
`entity.list` and a filter. Stay under the access policy: a SQL write beside
it would be a second access rule, without the audit or the traits.

## Unique fields

Declare `"unique": true` on a field of an entity with the generated identity:
`"email": {"type": "string", "maxLength": 120, "unique": true}`. Its table gets
the constraint `UQ_<TABLE>_<COLUMN>`: one row per value, several `null` values
stay allowed. `flow-entity-model-check` accepts it on a `string` declared with
a `maxLength` of 600 at most, an `int64`, `date` or `enum` field that every creating role
sees and sends; never on the identity, a computed, `auto`, `readOnly` or
`secret` field, a field hidden by `visibleTo` from a role that may create, or an
entity with `storage`, `source` or `readOnly`. The comparison is exact:
normalize the value in your Flow before `entity.save` (an email in lower case).

After the access policy and the model ACL, a duplicate answers:
- `ENTITY_VALIDATION` (422) with `{field, rule: "unique", message, expected}`
  when a row the actor could list with the default options (its scope, the
  fields it sees, active rows) holds the value; never the value nor the other key;
- exactly the refusal of the model ACL, `ENTITY_FORBIDDEN` "The declared model
  ACL denies this operation.", for any other row: another owner or scope, a
  hidden field, an inactive row, a write committed meanwhile. The server log
  gets one `ENTITY_UNIQUE_CONFLICT` line with the actor, the entity, the field
  and the operation, never the value.

Read a row by its unique value with `entity.list({entity: "Reader", checkAccess: true,
options: {filter: {email: input.email}, limit: 1}})` (the same empty page for an
absent or a hidden row), then update it with `key: {id}`. An inactive row
(`Activable`) keeps its value: reactivate it rather than create another.

Before declaring it:
- **Owners.** Uniqueness is global to the table. On a `Possédé` entity, a unique
  personal field (an email, a phone) tells each creator that a value exists among
  the rows of other owners. When owners are third parties to each other
  (different customers), wait for uniqueness per owner.
- **Open sign-up.** A create open to anonymous users or self sign-up on a unique
  field lets anyone test which accounts exist: use the sign-up of
  lib_UserManager (the same answer either way, a mail to the address), not a
  direct `entity.save`. The library has no rate limit: limit attempts in the
  application and watch the `ENTITY_UNIQUE_CONFLICT` lines.
- **Journal.** Keep a personal unique field out of `Journalisé.fields`: the
  journal keeps the `id` key.
- **Hooks.** `beforeSave` runs before the database decides, which may still
  refuse a concurrent duplicate: no mail, outbound call or file there. Put such
  effects in `afterSave`, which runs only once the database accepted the row.
- **Transactions.** In `sql.transaction`, a refused duplicate marks the
  transaction rollback-only even when caught: its other writes are not
  committed. On PostgreSQL, after a duplicate the database itself refused,
  every later statement of that transaction fails: do not catch and continue.

Adding `unique: true` to the field of an existing entity adds the constraint and
keeps the rows. When two rows already share a value, the change is refused
before any DDL: `SQL_SCHEMA_MIGRATION_UNSUPPORTED` with `details.change`
`addUnique` and `details.reason` `duplicates`, never a value. Removing `unique`
is refused (`changeUnique`).
