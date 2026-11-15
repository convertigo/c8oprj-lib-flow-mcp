# Entity unique fields

Read when a model has uniqueness constraints or sign-up.

## Unique fields

Declare `"unique": true` on a field of an entity with the generated identity:
`"email": {"type": "string", "maxLength": 120, "unique": true}`. Its table gets
the constraint `UQ_<TABLE>_<COLUMN>`: one row per value, several `null` values
stay allowed. `flow-entity-model-check` accepts it on a `string` declared with
a `maxLength` of 600 at most, an `int64`, `date` or `enum` field that every creating role
sees and sends; never on the identity, a computed, `auto`, `readOnly` or
`secret` field, a field hidden by `visibleTo` from a role that may create, or an
entity with `storage`, `source` or `readOnly`. The comparison is exact:
normalize the value in your Flow before `entity.save` when your rule ignores case or
surrounding spaces.

After the access policy and the model ACL, a duplicate answers:
- `ENTITY_VALIDATION` (422) with `{field, rule: "unique", message, expected}`
  when a row the actor could list with the default options (its scope, the
  fields it sees, active rows) holds the value; never the value nor the other key;
- exactly the refusal of the model ACL, `ENTITY_FORBIDDEN` "The declared model
  ACL denies this operation.", for any other row: another owner or scope, a
  hidden field, an inactive row, a write committed meanwhile. The server log
  gets one `ENTITY_UNIQUE_CONFLICT` line with the actor, the entity, the field
  and the operation, never the value.

Read a row by its unique value with `entity.list({entity: "Supplier", checkAccess: true,
options: {filter: {email: input.email}, limit: 1}})` (the same empty page for an
absent or a hidden row), then update it with `key: {id}`. An inactive row
(`Activable`) keeps its value: reactivate it rather than create another.

Before declaring it:
- **Owners.** Uniqueness is global to the table. On a `Possédé` entity, a unique
  personal field (an email, a phone) tells each creator that a value exists among
  the rows of other owners. The same cost applies when the access policy declares
  row scope fields: an actor limited to a scope learns that the value exists
  elsewhere, although no row is revealed. `model.check` and `model.set` warn in
  these cases. When owners are third parties to each other (different customers),
  wait for uniqueness per owner. If that disclosure matters for scoped actors,
  wait for per-scope uniqueness via `unique: {per: [...]}`; this form is planned
  and is not accepted yet.
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
