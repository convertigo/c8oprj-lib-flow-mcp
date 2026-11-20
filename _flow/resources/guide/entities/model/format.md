# Entity model format

Read for field types, identities, relations, traits and source declarations.

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
  serialized JSON in a `text` field, or declare a related entity. A `string`
  or `text` without `maxLength` holds 1 024 characters, and a longer value is
  refused: give a mail body or a comment its bound (`"maxLength": 20000`). A
  field without `default` is required unless `nullable: true`.
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
  `Échéance: {reference, delay: {months, days}, timeZone, inclusive, upToDate, due}`
  computes `dateEcheance` and `statut` in SQL (filter, sort, `entity.count`);
  les dates de référence sont publiques : ni `secret: true`, ni `visibleTo`,
  y compris quand plusieurs dates figurent dans `reference`.
  `upToDate`/`due` rename the codes `aJour`/`aRelancer` (e.g. `A_JOUR`).
- **Project traits:** `"traits": {"Tagged": {"parameters": {"tag": "tag"}, "fields": {"$tag": {"type": "string", "maxLength": 40}}}}`
  at the model level. `parameters` gives each parameter its default, taken by a
  `"$name"` field name or value; `fields` are declared as on an entity, `rules`
  is a list of `{kind, ...}` (`active`, `owner`, `deadline`, `revision`,
  `immutable`, `audit`) and `ui` holds display hints. An entity lists the trait
  as `"Tagged"` or `{"Tagged": {"tag": "genre"}}`.
- **Source:** `"source": {"provider": "app.directory"}` on a `"readOnly": true`
  entity: the named block lists its rows; it receives `ids`, `search`, `offset`
  and `limit` and returns `{users, hasMore}`. The entity is never written.
  Declare `"scoped": true` only if the provider enforces the actor's row scope
  before its 200-row limit. Otherwise, an actor with a row scope can list this
  directory only with an identity-bounded filter; an unbounded list is refused
  with `ENTITY_DIRECTORY_SCOPE_UNSUPPORTED`.
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
  **Unique fields** in `flow://guide/entities/model/unique`.

For `Échéance`, months are applied before calendar days; business days are
unsupported. `inclusive: true` includes the deadline day; no reference means
already due. Queue and alert recipe: `flow://guide/entities/widgets/deadlines`.

**Natural key.** An entity may declare a natural identity, such as
`"identity": ["email"]` with a `string` field: `entity.read`, `entity.delete`
and `entity.save` with `key: {email}` (an update, never an upsert) use it.
`entity.save` creates a row only when the database generates its identity, so a
create on such an entity answers `ENTITY_NATURAL_KEY_CREATE_UNSUPPORTED` (400),
after the access policy and before any write; it names only the identity
fields the actor sees. To create rows today, give the entity the generated
identity (declare no identity: an int64 `id`) and declare the natural key as
an ordinary field with `unique: true` (**Unique fields** in `flow://guide/entities/model/unique`), read with
`entity.list` and a filter. Stay under the access policy: a SQL write beside
it would be a second access rule, without the audit or the traits.
