# Flow Entities: Authentication

Session authentication and the actor provider for entity applications.

Sub-guide of `flow://guide/entities`: read that guide first.

## Authentication

`config.entities.actorProvider` optionally names a **project block**, called with
**no inputs (`{}`)** only when the policy reads `request.roles`, or declared
ACL/visibility/owner rules need roles. There is no default provider. It returns
`{user: string, roles: string[]}` from the server directory. A provider user
which differs from `context.getAuthenticatedUser()` is refused (`ENTITY_FORBIDDEN`); an
anonymous session cannot invent an actor. Actors are never cached with models.
Without an ACL or `checkAccess`, entity primitives require neither actor nor
session. `Possédé` still fills its owner from the session or a supplied value;
`Journalisé` records the session user or `system`; revision, timestamps,
validation and immutability remain active. Read the directory directly in the
provider; controlled entity calls from an access policy are rejected as recursion.

For a project with its own account table, the following minimal configuration
uses `APP_USER(USER_ID, ROLE, ACTIVE, DEMO)`; `USER_ID` is a unique text key,
`ROLE` is a role stored by server-side administration, the last two columns
are booleans. Entity permission lists authorize your domain role names; they
need not be named USER, MANAGER or ADMIN. The SQL
connection `app` is configured separately (see the multi-page recipe). Both
queries remain private, parameterized and bounded. Quote the physical SQL
identifiers as shown: the model creates uppercase names, while PostgreSQL folds
unquoted names to lowercase. The demo switch defaults off.

<!-- example: actor-config -->
```yaml
config:
  entities:
    connection: app
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
        sql: 'SELECT "USER_ID" AS "user", "ROLE" AS "role" FROM "APP_USER" WHERE "USER_ID"=:user AND "ACTIVE"=TRUE'
        parameters: [{name: user, type: string}]
        columns: [{name: user, type: string, nullable: false}, {name: role, type: string, nullable: false}]
      demoAccount:
        connection: app
        readOnly: true
        expose: false
        maxRows: 1
        sql: 'SELECT "USER_ID" AS "user" FROM "APP_USER" WHERE "USER_ID"=:user AND "ACTIVE"=TRUE AND "DEMO"=TRUE'
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
    throw { code: "UNAUTHENTICATED", message: "Sign in first" }
  }
  local.accounts = sql.query({ query: "actorBySession", parameters: { user: local.user }, limit: 1 })
  local.account = object.get({ source: local.accounts.rows, key: "0", defaultValue: null })
  if (!local.account || !local.account.role) {
    throw { code: "FORBIDDEN", message: "Active account required" }
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
    throw { code: "DEMO_LOGIN_DISABLED", message: "Demo sign-in is disabled" }
  }
  local.accounts = sql.query({ query: "demoAccount", parameters: { user: input.account }, limit: 1 })
  local.account = object.get({ source: local.accounts.rows, key: "0", defaultValue: null })
  if (!local.account) {
    throw { code: "FORBIDDEN", message: "Demo account required" }
  }
  session.authenticate({ user: local.account.user })
  local.actor = app.actor({})
  result.authenticated = true
  result.user = local.actor.user
  result.roles = local.actor.roles
}
```

Prefer **`lib_UserManager` for real accounts, passwords and user administration**:
reference it, use its sign-in/session flows, and set actorProvider to userManager.actor.
For a responsible-person relation to that directory, use the imported
`userManager.User` provider below; do not assume its storage. A project directory
can instead expose its non-secret account identifiers through a read-only entity.
Never accept an arbitrary user parameter in a production session-setting flow.
The MCP authoring token identifies the author, not an application user; browser
sessions and test sessions remain separate.
