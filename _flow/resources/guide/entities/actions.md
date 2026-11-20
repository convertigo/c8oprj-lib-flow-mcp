# Flow Entities: Atomic Business Actions

Atomic business actions over entities (borrow and return a book) and the backend preview boundary.

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
  initialization facade is needed. Use the application’s private Studio `demo_reset`
  before demo sign-in, as in `flow://guide/multipage-entities`.
- The authenticated application role has read/create/update rights needed by
  the operation. This example grants the two writes to `BIBLIOTHECAIRE`;
  `ADHERENT` does not acquire those rights by calling the Flow. Keep the real
  session actor provider, app.entityAccess policy and optional model ownership rules. A domain member key
  is not automatically the authenticated user's identifier.
- Add the `lib_flow_entity` project reference. Read the installed contracts of
  `sql.transaction`, `entity.read` and `entity.save` before adapting the names.

Borrow in a single request:

<!-- example: borrow-book -->
```javascript
const _flow = {
  sourceVersion: 3,
  authenticatedContextRequired: true,
  inputs: { livre: { type: "object" }, adherent: { type: "string" } },
}

function Emprunter({ input, config, result }) {
  let pret
  sql.transaction({
    connection: "app",
    $$nodes() {
      const livre = entity.read({ entity: "Livre", checkAccess: true, key: input.livre })
      if (!livre.values.disponible) {
        throw { code: "LIVRE_INDISPONIBLE", message: "Livre déjà emprunté" }
      }
      pret = entity.save({
        entity: "Pret",
        checkAccess: true,
        values: { livre: livre.key.id, adherent: input.adherent, rendu: false },
      })
      entity.save({
        entity: "Livre",
        checkAccess: true,
        key: livre.key,
        revision: livre.revision,
        values: { disponible: false },
      })
    },
  })
  result.pret = pret
}
```

Return in a single request:

<!-- example: return-book -->
```javascript
const _flow = { sourceVersion: 3, authenticatedContextRequired: true, inputs: { pret: { type: "object" } } }

function Rendre({ input, config, result }) {
  let closed
  sql.transaction({
    connection: "app",
    $$nodes() {
      const pret = entity.read({ entity: "Pret", checkAccess: true, key: input.pret })
      if (pret.values.rendu) {
        throw { code: "PRET_DEJA_RENDU", message: "Prêt déjà rendu" }
      }
      const livre = entity.read({ entity: "Livre", checkAccess: true, key: { id: pret.values.livre } })
      closed = entity.save({
        entity: "Pret",
        checkAccess: true,
        key: pret.key,
        revision: pret.revision,
        values: { rendu: true },
      })
      entity.save({
        entity: "Livre",
        checkAccess: true,
        key: livre.key,
        revision: livre.revision,
        values: { disponible: true },
      })
    },
  })
  result.pret = closed
}
```

`livre` and `pret` inputs are resource keys such as `{id:"1"}`. Use the revision
read **inside** the transaction. A stale competing writer conflicts and rolls
back the new loan as well. On conflict, reload and retry the entire business
action; do not retry only the last save. An identity sequence may have gaps
after rollback; this is not an orphaned record.

A failed Entity mutation marks a borrowed `sql.transaction` rollback-only even if its error is caught: commit raises `SQL_TRANSACTION_ROLLBACK_ONLY` (409), or explicitly reports `committed:false` with `onError:"return"`.

Keep the default `onError:"throw"`, propagate every failure, and return the
business result after the scope commits. Do not catch and suppress a child
failure, return early inside the scope, or send mail/HTTP side effects there:
JDBC rollback only covers database writes on that connection. Two successive
HTTP calls to EntityGateway are separate transactions. The `steps` form of
`sql.transaction` is for configured named SQL statements; entity calls belong
in `$$nodes`, without an additional nested `sql.transaction`.

For loans, use these business actions from frontend ordinary actions rather
than exposing the two writes as separate form submissions. A transaction does
not itself prohibit another permitted CRUD route: the application policy, optional model ACLs and server
hooks must also cover any route the application exposes. It does not grant
privileges to an ADHERENT or impersonate a librarian.

Regression: `lib_flow_entity/tests/borrowing-transaction.js`, run with
`tools/run-borrowing-tests.sh` (HSQLDB by default, `postgresql` with JDBC test
environment variables). It verifies committed borrow/return, unavailable-book
refusal, failure between and after both writes, validation of the second save,
stale competing borrow, failed return, audit rollback, and a negative control
without the parent scope. The stale competitor is a deterministic interleaving,
not a simultaneous-thread stress test.

## Backend preview boundary

Entity data operations support **HSQLDB and PostgreSQL only**. MariaDB is not
qualified for Entity CRUD; the SQL initializer's MariaDB support is separate.
Other dialects return `ENTITY_DIALECT_UNQUALIFIED` before data bootstrap.

`describe` is metadata-only: no DDL, hooks or mutation. Its explicit public keys
are name, label, identity, traits (names only), fields, display, ui, permissions
and revision. Fields contain only UI scalars/constraints; readable relations
expose only entity and labelField. Unreadable relations have no relation metadata
and are read-only. Rules, provider sources, SQL storage/columns and internal
relation predicates never enter this contract. Capabilities are general dry
probes, not an authorization for every row or value.

Scope equality uses the field's type: exact decimal/int64 text, local timestamps
with optional millisecond fraction, strict strings/booleans and explicit null.
No conversion to JavaScript Number. Directory filters use the same equality;
an OR with a non-identity branch cannot be reduced to an identity prefilter.

`entity.initialize` and `entity.demoReset` are exported blocks (`private:false`
in the catalog), so project Flows can call them. The reset Flow must be private.
Demo reset is refused outside Studio unless the server symbol
`lib_flow_entity.demoReset.enabled` is `true` (default false); project config or
request input cannot enable it. A separate hidden application entry point must
verify ADMIN before calling the private reset with `requestable.call`.
The reset trace records the actor, instant and actual number of seeded rows.

The trace also names the tables the reset empties (`resetTables`: every table of
the model schema) and the tables it seeds (`seededTables`). The desktop Studio
counts as Studio. Two limits of the `code-check` rule, which the server refusal
covers in production: a project block (`app.*`) that wraps `entity.demoReset` is
not followed, and a Flow without an accessibility declaration is treated as
public, so declare the reset Flow `private` explicitly.

In trusted mode, creating a Possédé row prefers the authenticated server session
for its owner; without a session, an explicit owner is preserved. No ACL is added.
Controlled calls still use the application policy, scope and ownership rules.

Application failures contain no SQL object/constraint names or DDL plan.
`ENTITY_SCHEMA_MISSING` invites the administrator to fix the database.
The structural plan stays in the server author-diagnostic log. An authenticated
MCP author can run `entity.initialize({dryRun:true})` through `code-run` in a
private project Flow to inspect the full additive plan; no ADMIN application
cookie is required. Keep that author preview separate from the public gateway.
SQL row locks share SQL binding/deadlines/error translation: concurrent retry is
409, backend timeout/cancellation is 504; a cancelled Flow keeps SQL_CANCELLED.
