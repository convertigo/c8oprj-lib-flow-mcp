# Interpreted Flow Entities

Declare business data once, expose your own HTTP contract with entity blocks, and add schema-driven widgets when useful.

## Your own HTTP contract over entities

No widget or generated CRUD is required. Name public Flows as your application
contract requires: `MyReservations` → `entity.list`, `ReadReservation` →
`entity.read` (not `entity.get`), `SaveReservation` → `entity.save`,
`DeleteReservation` → `entity.delete`. Use the same guard and error translation
for each endpoint; keep SQL, ownership and audit in the declared model.
With the Reservation model in `flow://guide/multipage-entities`, this
complete create/update facade accepts flat request fields and returns exact keys:

<!-- example: http-save-reservation -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "hidden" }

function SaveReservation({ input, config, result }) {
  local.user = session.authenticatedUser({})
  if (!local.user) {
    throw { code: "UNAUTHENTICATED", message: "Sign in first", status: 401 }
  }
  local.roomId = text.match({ text: input.room || "", pattern: "^[0-9]+$" })
  if (typeof input.title !== "string" || !input.title.trim() || typeof input.room !== "string" ||
    !local.roomId.matched || !input.starts || !input.ends) {
    throw { code: "VALIDATION_FAILED", message: "Title, room and dates required", status: 400 }
  }
  try({
    error: "local.failure",
    $$try: function () {
      local.row = entity.save({
        entity: "Reservation",
        key: input.id ? { id: input.id } : {},
        revision: input.revision || "",
        values: { title: input.title, room: input.room, starts: input.starts, ends: input.ends },
      })
    },
    $$catch: function () {
      if (local.failure.code === "ENTITY_UNAUTHENTICATED" || local.failure.code === "UNAUTHENTICATED") {
        throw { code: "UNAUTHENTICATED", message: "Sign in first", status: 401 }
      }
      if (local.failure.code === "ENTITY_VALIDATION") {
        throw { code: "VALIDATION_FAILED", message: local.failure.message, status: 400 }
      }
      if (local.failure.code === "ENTITY_NOT_FOUND" || local.failure.code === "ENTITY_FORBIDDEN" ||
        local.failure.code === "FORBIDDEN") {
        throw { code: "FORBIDDEN", message: "Reservation unavailable", status: 403 }
      }
      if (local.failure.code === "ENTITY_CONFLICT") {
        throw { code: "REVISION_CONFLICT", message: "Reload before saving", status: 409 }
      }
      if (local.failure.code === "BOOKING_WINDOW_CONFLICT") {
        throw { code: "BOOKING_WINDOW_CONFLICT", message: local.failure.message, status: 409 }
      }
      if (local.failure.code === "BOOKING_OVERLAP") {
        throw { code: "ROOM_ALREADY_BOOKED", message: local.failure.message, status: 409 }
      }
      throw { code: "BOOKING_FAILED", message: "Booking service unavailable", status: 500 }
    },
  })
  return {
    reservation: {
      id: local.row.key.id,
      revision: local.row.revision,
      title: local.row.values.title,
      roomId: local.row.values.room,
      starts: local.row.values.starts,
      ends: local.row.values.ends,
    },
  }
}
```

Identifiers/revisions stay text, including int64 above 2^53; dates stay ISO.
`Possédé` supplies the owner from the server actor and scopes reads/writes.
Its hidden/absent-row 404 becomes 403 **for both** in this contract: do not
unmask another user's row to distinguish them. If the contract requires 404,
keep that code instead. Adapt only the facade's JSON keys to your contract.

<!-- example: http-list-reservations -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "hidden" }

function MyReservations({ input, config, result }) {
  local.user = session.authenticatedUser({})
  if (!local.user) {
    throw { code: "UNAUTHENTICATED", message: "Sign in first", status: 401 }
  }
  local.actor = app.actor({})
  if (local.actor.roles.indexOf("USER") < 0 && local.actor.roles.indexOf("MANAGER") < 0 &&
    local.actor.roles.indexOf("ADMIN") < 0) {
    throw { code: "FORBIDDEN", message: "Booking role required", status: 403 }
  }
  local.page = entity.list({ entity: "Reservation", options: { limit: 20, offset: input.offset || 0 } })
  local.rows = list.map({
    items: local.page.rows,
    select: {
      id: current.key.id,
      title: current.values.title,
      starts: current.values.starts,
      ends: current.values.ends,
    },
  })
  return { reservations: local.rows, total: local.page.total }
}
```

For an imposed business 409, set `Reservation.hooks.beforeSave` to
`HttpBookingRule`. It adds the application's date-order refusal and reuses the
detailed recipe's locked overlap check. Its code/status reach the Flow unchanged:

<!-- example: http-booking-rule -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "private", authenticatedContextRequired: true }

function HttpBookingRule({ input, config, result }) {
  local.values = input.mutation.patch
  if (!input.mutation.creating) {
    local.previous = entity.read({ entity: "Reservation", key: input.mutation.key })
    local.values = object.merge({ target: local.previous.values, source: input.mutation.patch })
  }
  if (local.values.starts >= local.values.ends) {
    throw { code: "BOOKING_WINDOW_CONFLICT", message: "End must follow start", status: 409 }
  }
  flow.call({ flow: "BookingRule", input: input })
}
```

| Native error | Application example | Where to adapt |
|---|---|---|
| ENTITY_UNAUTHENTICATED / 401 | UNAUTHENTICATED / 401 | Prevent with the session guard **before** entity.*; do not require authenticatedContextRequired on the public facade, which would preempt your guard. |
| ENTITY_FORBIDDEN / 403 | FORBIDDEN / 403 | Prevent with server actor roles, or convert in catch. Never trust client roles. |
| ENTITY_NOT_FOUND / 404 (also outside Possédé) | FORBIDDEN / 403 | Convert in catch, uniformly for absent and hidden rows; keep 404 if required instead. |
| ENTITY_VALIDATION / 422 | VALIDATION_FAILED / 400 | Validate inputs before save; convert remaining model validation in catch. |
| ENTITY_CONFLICT / 409 | REVISION_CONFLICT / 409 | Convert in catch; reload, do not blindly retry. |
| Your hook's code/status | BOOKING_WINDOW_CONFLICT / 409 | Throw in the hook; preserve that literal code/status in catch. Map BOOKING_OVERLAP separately if your contract calls it ROOM_ALREADY_BOOKED / 409. |

A throw code is literal text: add one catch branch per expected business code,
not `code: local.failure.code`. Unexpected failures become BOOKING_FAILED / 500
at this public boundary, without exposing internal errors; never report success.
A thrown error interrupts the Flow: HTTP status is its `status`, JSON contains
`error.code`, `error.message`, `error.status`, and no success result. Use
`return { ... }` for exact success keys, not `{error:...}` as a successful result.
For demo login and `me`, use the project actor in **Authentication** below and
**Demo login** in `flow://guide/multipage-entities`; the switch stays off by
default. Login/session shape is independent of the choice of entities.

Read `flow://guide/multipage-entities` for the ordered application recipe.
The target project references `lib_flow_entity`, the SQL and CRUD data libraries,
and the Svelte frontbuilder. Authentication may use the Flow port of
`lib_UserManager` or a project actor provider backed by the server session.
Client-supplied roles never establish rights. Read each available contract
with `flow-block-get` before use.

## Schema initialization and demo reset

The schema is ensured on the first authorized entity operation, once per JVM,
connection settings and model fingerprint. Only additive changes are applied;
`autoVersion` derives the next schema version, while removed/changed columns
are refused before writes. No MCP database access or initialization step is
needed when writing the model. An explicit `entity.initialize({})` can also run
without a session; `dryRun:true` previews, `verifyOnly:true` checks a DBA schema.
`config.entities.schema: verify` makes the automatic check read-only.

**Neither entity.initialize nor entity.demoReset is protected by session, role
or a library demo switch.** The application protects any public caller. Private
Convertigo code has no internal ACL. The configured database account and its
DDL/DML grants are the production boundary; use a secret password symbol and
a restricted account, not root. Missing CREATE rights return a clear
ENTITY_SCHEMA_MISSING / 403 with the available additive plan.

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
Reset bypasses business hooks/permissions; ordinary CRUD remains session-bound.

## Authentication

`config.entities.actorProvider` names an ordinary **project block**, called with
**no inputs (`{}`)** on every entity operation. The default is `userManager.actor`.
It returns `{user: string, roles: string[]}`; return active, authorized roles
from the server directory, never from request inputs or browser state. Entity
resolution first requires `context.getAuthenticatedUser()` (401 if absent),
then rejects a missing actor, a non-array `roles`, a `user` different from that
session identity, or roles lacking read permission (`ENTITY_FORBIDDEN`, 403).
It does not cache actors with model plans. Create/update/delete permissions and
ownership are then checked for that same actor. A hook also receives this actor.
Read the directory directly in this provider: calling `entity.*` here would
resolve the actor again and recurse.

For a project with its own account table, the following minimal configuration
uses `APP_USER(USER_ID, ROLE, ACTIVE, DEMO)`; `USER_ID` is a unique text key,
`ROLE` is a role stored by server-side administration, the last two columns
are booleans. Entity permission lists authorize your domain role names; they
need not be named USER, MANAGER or ADMIN. The SQL
connection `app` is configured separately (see the multi-page recipe). Both
queries remain private, parameterized and bounded. The demo switch defaults off.

<!-- example: actor-config -->
```yaml
config:
  entities:
    connection: app
    gateway: true
    actorProvider: app.actor
  demo:
    login: "${<project>.demo.login=false}"
  sql:
    queries:
      actorBySession:
        connection: app
        readOnly: true
        expose: false
        maxRows: 1
        sql: 'SELECT USER_ID AS "user", ROLE AS "role" FROM APP_USER WHERE USER_ID=:user AND ACTIVE=TRUE'
        parameters: [{name: user, type: string}]
        columns: [{name: user, type: string, nullable: false}, {name: role, type: string, nullable: false}]
      demoAccount:
        connection: app
        readOnly: true
        expose: false
        maxRows: 1
        sql: 'SELECT USER_ID AS "user" FROM APP_USER WHERE USER_ID=:user AND ACTIVE=TRUE AND DEMO=TRUE'
        parameters: [{name: user, type: string}]
        columns: [{name: user, type: string, nullable: false}]
```

Save this block with `code-set({project,block:"app.actor",code:...})`:

<!-- example: actor-block -->
```javascript
const _meta = {
  sourceVersion: 2,
  private: true,
  properties: {},
  outputs: { out: { type: "object", properties: { user: { type: "string" }, roles: { type: "array", items: { type: "string" } } } } },
}

function block({ input, config, result }) {
  local.user = session.authenticatedUser({})
  if (!local.user) {
    throw { code: "UNAUTHENTICATED", message: "Sign in first", status: 401 }
  }
  local.accounts = sql.query({ query: "actorBySession", parameters: { user: local.user }, limit: 1 })
  local.account = object.get({ source: local.accounts.rows, key: "0", defaultValue: null })
  if (!local.account || !local.account.role) {
    throw { code: "FORBIDDEN", message: "Active account required", status: 403 }
  }
  return { user: local.account.user, roles: [local.account.role] }
}
```

`session.authenticate` **sets** a server session; it does not verify a password.
A demo picker may call the flow below only after an administrator explicitly
enables the symbol. A chosen demo account is looked up on the server before
opening the session; a client-supplied role is unused. Keep demo accounts neutral
and distinct from real accounts, and hide the picker when the switch is off.
Do not enable this route in production. Authentication is separate from the
choice of entities, direct SQL, CSV or scheduling.

<!-- example: demo-login -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "hidden", inputs: { account: { type: "string" } } }

function DemoLogin({ input, config, result }) {
  if (String(config.demo.login) !== "true") {
    throw { code: "DEMO_LOGIN_DISABLED", message: "Demo sign-in is disabled", status: 403 }
  }
  local.accounts = sql.query({ query: "demoAccount", parameters: { user: input.account }, limit: 1 })
  local.account = object.get({ source: local.accounts.rows, key: "0", defaultValue: null })
  if (!local.account) {
    throw { code: "FORBIDDEN", message: "Demo account required", status: 403 }
  }
  session.authenticate({ user: local.account.user })
  local.actor = app.actor({})
  result.authenticated = true
  result.user = local.actor.user
  result.roles = local.actor.roles
}
```

Prefer **`lib_UserManager` for real accounts, passwords and user administration**:
reference it, use its sign-in/session flows, and retain the default actor provider.
For a responsible-person relation to that directory, use the imported
`userManager.User` provider below; do not assume its storage. A project directory
can instead expose its non-secret account identifiers through a read-only entity.
Never accept an arbitrary user parameter in a production session-setting flow.
The MCP authoring token identifies the author, not an application user; browser
sessions and test sessions remain separate.

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

## Reusable widgets and named snippets

Find `EntityTable` and `EntityForm` with `authoring-palette` under the qualified
Structure parent returned by `authoring-tree`. Execute `items[].apply` unchanged.
Both are library widgets. Their inputs remain model driven; a page supplies the
entity name, transport configuration and selection/event bindings supported by
the installed widget contract. Do not copy their implementations into a page. Declare the application locale
once in the root source, for example `_flow.app.locale:"fr-FR"`; the
frontbuilder passes it to the widgets. Their default spacing and controls use
the shared Flow theme tokens, without application CSS.

`EntityTable` exposes `select`; `EntityForm` exposes `saved`, `deleted` and `cancel`.
Handle them with ordinary `Events` / `OnSelect`, `OnSaved`, `OnDeleted` actions:
`@event.value` is the selected row, saved row or deletion result. Keep the row
in page state and bind it to `EntityForm.row`. After save or deletion, clear the
selection, close the editor, and increment the table's `refreshKey` state with `UpdateNumber`
(`operation:"increment"`, `step:1`) to reload its current page. A New command clears the row and opens the creation form.
Handle `OnCancel` by closing the editor and clearing its row as well.
Use the conflict reload command before retrying a stale revision; do not blindly
resubmit the stale row. Effective permissions disable immutable-row updates and
hide forbidden deletion actions.

```svelte
<script module>export const _flow = { sourceVersion: 2 };</script>
<FlowComponent $$id="selectionExample">
  <Variables><State $$id="row" type="object" value={null} /></Variables>
  <Structure>
    <EntityTable $$id="equipment" entity="Equipement" targetProject="EquipmentApp">
      <Events><OnSelect $$id="selected"><Actions>
        <SetValue $$id="keepRow" target="page.row" value="@event.value" />
      </Actions></OnSelect></Events>
    </EntityTable>
    <EntityForm $$id="edit" entity="Equipement" targetProject="EquipmentApp" row="@page.row" />
  </Structure>
</FlowComponent>
```

Named snippet parameters are lexical sources, with the schema declared in the
component descriptor; they appear in pickers and are preserved by source edits:

| Widget slot | Parameters in order |
| --- | --- |
| table `cell` | `row`, `field` |
| table `actions` | `row`, `context` |
| table `toolbar` | `context` |
| table `empty` | none |
| form `field` | `field`, `value`, `set`, `error` |
| form `actions` | `context` |

Use `<Cell><Text text="@row.values.libelle" /></Cell>` for a row field and
`@field.label` for the declared field's label. A generic cell override should
use the current field, rather than rendering the same field in every column.
The `set` argument is a callback value for a native input component's declared
setter property; it is not a FlowScript function call. Pass it unchanged as
`@set` to a compatible component and keep `@value` and `@error` alongside it.
Do not introduce an inline browser script to run it. Read the installed input
component contract before replacing the default field renderer.

Native Svelte callers can also pass `cell_<field>` / `field_<field>` overrides,
for example `cell_libelle` and `field_noteInterne`. These are concrete names,
not angle-bracket wildcard slots. Preserve all other slots during an edit.

The server removes hidden fields and enforces ownership, permissions and
revision checks. Hiding an action or a management link is only presentation.
Test anonymous, ordinary-user and administrator sessions over HTTP, then test
the pages. A page loading or a successful model write is not that proof.

## Atomic business actions: borrow and return a book

Use **one backend Flow with `sql.transaction` child nodes** for a business
operation that writes several entities. `entity.save` joins the parent SQL
transaction; its hooks and allowlisted journal writes join it too. This needs
no new entity block, generated CRUD Flow, or Java change.

Preconditions for this example:

- `Livre` has `disponible: boolean` (default true); `Pret` has the `livre`
  and `adherent` relations and `rendu: boolean` (default false).
- Both `Livre` and `Pret` use the `Révisé` trait, on the same named SQL
  connection `app`. The additive schema is ensured on first use; no ADMIN
  initialization facade is needed. Use the application’s public `demo_reset`
  before demo sign-in, as in `flow://guide/multipage-entities`.
- The authenticated application role has read/create/update rights needed by
  the operation. This example grants the two writes to `BIBLIOTHECAIRE`;
  `ADHERENT` does not acquire those rights by calling the Flow. Keep the real
  session actor provider and the model's ownership rules. A domain member key
  is not automatically the authenticated user's identifier.
- Add the `lib_flow_entity` project reference. Read the installed contracts of
  `sql.transaction`, `entity.read` and `entity.save` before adapting the names.

Borrow in a single request:

<!-- example: borrow-book -->
```javascript
const _flow = {
  sourceVersion: 2,
  authenticatedContextRequired: true,
  inputs: { livre: { type: "object" }, adherent: { type: "string" } },
}

function Emprunter({ input, config, result }) {
  sql.transaction({
    connection: "app",
    $$nodes: function () {
      local.livre = entity.read({ entity: "Livre", key: input.livre })
      if (!local.livre.values.disponible) {
        throw { code: "LIVRE_INDISPONIBLE", message: "Livre déjà emprunté", status: 409 }
      }
      local.pret = entity.save({
        entity: "Pret",
        values: { livre: local.livre.key.id, adherent: input.adherent, rendu: false },
      })
      local.updated = entity.save({
        entity: "Livre",
        key: local.livre.key,
        revision: local.livre.revision,
        values: { disponible: false },
      })
    },
  })
  result.pret = local.pret
}
```

Return in a single request:

<!-- example: return-book -->
```javascript
const _flow = { sourceVersion: 2, authenticatedContextRequired: true, inputs: { pret: { type: "object" } } }

function Rendre({ input, config, result }) {
  sql.transaction({
    connection: "app",
    $$nodes: function () {
      local.pret = entity.read({ entity: "Pret", key: input.pret })
      if (local.pret.values.rendu) {
        throw { code: "PRET_DEJA_RENDU", message: "Prêt déjà rendu", status: 409 }
      }
      local.livre = entity.read({ entity: "Livre", key: { id: local.pret.values.livre } })
      local.closed = entity.save({
        entity: "Pret",
        key: local.pret.key,
        revision: local.pret.revision,
        values: { rendu: true },
      })
      local.updated = entity.save({
        entity: "Livre",
        key: local.livre.key,
        revision: local.livre.revision,
        values: { disponible: true },
      })
    },
  })
  result.pret = local.closed
}
```

`livre` and `pret` inputs are resource keys such as `{id:"1"}`. Use the revision
read **inside** the transaction. A stale competing writer conflicts and rolls
back the new loan as well. On conflict, reload and retry the entire business
action; do not retry only the last save. An identity sequence may have gaps
after rollback; this is not an orphaned record.

Keep the default `onError:"throw"`, propagate every failure, and return the
business result after the scope commits. Do not catch and suppress a child
failure, return early inside the scope, or send mail/HTTP side effects there:
JDBC rollback only covers database writes on that connection. Two successive
HTTP calls to EntityGateway are separate transactions. The `steps` form of
`sql.transaction` is for configured named SQL statements; entity calls belong
in `$$nodes`, without an additional nested `sql.transaction`.

For loans, use these business actions from frontend ordinary actions rather
than exposing the two writes as separate form submissions. A transaction does
not itself prohibit another permitted CRUD route: model permissions and server
hooks must also cover any route the application exposes. It does not grant
privileges to an ADHERENT or impersonate a librarian.

Regression: `lib_flow_entity/tests/borrowing-transaction.js`, run with
`tools/run-borrowing-tests.sh` (HSQLDB by default, `postgresql` with JDBC test
environment variables). It verifies committed borrow/return, unavailable-book
refusal, failure between and after both writes, validation of the second save,
stale competing borrow, failed return, audit rollback, and a negative control
without the parent scope. The stale competitor is a deterministic interleaving,
not a simultaneous-thread stress test.
