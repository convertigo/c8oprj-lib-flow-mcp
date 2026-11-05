# Multi-Page Business Application by Entities

Build a role-based booking application with session authentication, per-user entities, ordinary widget events, CSV export, a scheduled check and atomic auditing.

Use this route for persisted business data with roles. Authentication, exports
and scheduled work are additions, not a reason to choose direct SQL. This
recipe uses a small project account table for a **demo disabled by default**;
replace that provider with `lib_UserManager` for real accounts and passwords.
It extends the entity recipe rather than replacing the explicit SQL escape
hatch in `flow://guide/multipage-roles`.

## 1. Prepare and declare once

Bootstrap the target with `flow-project-bootstrap({project,ui:true})`, then add
the `lib_flow_entity` reference with `flow-project-reference` (dry run first).
Keep its SQL/CRUD dependencies and the Svelte provider available. Read
`flow://guide/entities`, `flow://guide/authoring` and
`flow://guide/frontend-svelte`; agree the backend/frontend contract as in
`flow://guide/fullstack-paperboard`. Read block contracts with `flow-block-get`.

Use `flow-entity-model-get`, `flow-entity-model-check`, then
`flow-entity-model-set` with the returned revision. This model creates no CRUD
source. USER sees and changes only their reservations; MANAGER/ADMIN sees all.
The journal is manager-only. Dates are ISO dates; `id`, `room` and revision
are **exact int64 text**, including values above JavaScript's safe integer.
Never convert them with `Number` or `parseInt`.

<!-- example: booking-model -->
```json
{
  "version": 2,
  "modelVersion": 1,
  "entities": {
    "Room": {
      "permissions": {"read":["USER","MANAGER","ADMIN"],"create":["MANAGER","ADMIN"],"update":["MANAGER","ADMIN"],"delete":["ADMIN"]},
      "traits": ["Révisé"],
      "display": {"title":"name"},
      "fields": {"name":{"type":"string","maxLength":100}}
    },
    "Reservation": {
      "permissions": {"read":["USER","MANAGER","ADMIN"],"create":["USER","MANAGER","ADMIN"],"update":["USER","MANAGER","ADMIN"],"delete":["MANAGER","ADMIN"]},
      "traits": ["Révisé","Horodaté",{"Possédé":{"owner":"owner","unrestricted":["MANAGER","ADMIN"]}},{"Journalisé":{"fields":["title","room","starts","ends","status","owner"]}}],
      "hooks": {"beforeSave":"BookingRule"},
      "display": {"title":"title"},
      "fields": {
        "title":{"type":"string","maxLength":100},
        "room":{"type":"int64","relation":{"entity":"Room","labelField":"name"}},
        "starts":{"type":"date"},
        "ends":{"type":"date"},
        "status":{"type":"enum","values":["OPEN","CANCELLED"],"default":"OPEN"}
      }
    },
    "Audit": {
      "readOnly": true,
      "permissions": {"read":["MANAGER","ADMIN"]},
      "storage": {"table":"FLOW_ENTITY_AUDIT","columns":{"entityKey":"ENTITY_KEY","valuesJson":"VALUES_JSON"}},
      "display": {"title":"operation"},
      "fields": {
        "entity":{"type":"string"},"entityKey":{"type":"string"},
        "operation":{"type":"string"},"actor":{"type":"string"},
        "at":{"type":"timestamp"},"valuesJson":{"type":"string"}
      }
    }
  }
}
```

Add the actor configuration, `app.actor` block and `DemoLogin` Flow from
`flow://guide/entities`. Merge (do not replace) this connection
and these technical queries into the same `_flow/engine.yaml` configuration:

<!-- example: booking-config -->
```yaml
config:
  jobs:
    enabled: "${<project>.jobs.enabled=false}"
  sql:
    connections:
      app:
        dialect: hsqldb
        url: jdbc:hsqldb:file:.//_flow/resources/sql/database/bookings;shutdown=true
        user: SA
        password: "${<project>.db.password.secret=}"
        nativeRead: true
        nativeWrite: true
    initializers:
      accounts:
        connection: app
        schemaFile: _flow/resources/sql/accounts/schema.json
        dataFile: _flow/resources/sql/accounts/data.json
    writes:
      lockRoom:
        connection: app
        operation: update
        expose: false
        sql: 'UPDATE ROOM SET REVISION=REVISION WHERE ID=:room'
        parameters: [{name: room, type: int64}]
    queries:
      overlap:
        connection: app
        readOnly: true
        expose: false
        maxRows: 1
        sql: 'SELECT COUNT(*) AS "total" FROM RESERVATION WHERE ROOM=:room AND STATUS=''OPEN'' AND STARTS<:ends AND ENDS>:starts AND (:id IS NULL OR ID<>:id)'
        parameters: [{name: room, type: int64}, {name: starts, type: date}, {name: ends, type: date}, {name: id, type: int64, nullable: true, default: null}]
        columns: [{name: total, type: int64, nullable: false}]
      startsToday:
        connection: app
        readOnly: true
        expose: false
        maxRows: 1
        sql: 'SELECT COUNT(*) AS "total" FROM RESERVATION WHERE STARTS=:day AND STATUS=''OPEN'''
        parameters: [{name: day, type: date}]
        columns: [{name: total, type: int64, nullable: false}]
```

For HSQLDB keep the database under the protected `_flow/resources/sql/` path,
ignore its files in Git and use an external DBMS for production. CAR replacement
can replace a development database. Do not duplicate the business entity schema
in SQL JSON. Only the separate account directory needs an explicit schema and
seed. Save these as the two paths configured above:

<!-- example: accounts-schema -->
```json
{"version":1,"tables":[{"name":"APP_USER","primaryKey":["USER_ID"],"columns":[{"name":"USER_ID","type":"string","length":100},{"name":"ROLE","type":"string","length":20},{"name":"ACTIVE","type":"boolean"},{"name":"DEMO","type":"boolean"}]}]}
```

<!-- example: accounts-data -->
```json
{"tables":[{"table":"APP_USER","key":["USER_ID"],"rows":[{"USER_ID":"demo-alpha","ROLE":"USER","ACTIVE":true,"DEMO":true},{"USER_ID":"demo-beta","ROLE":"USER","ACTIVE":true,"DEMO":true},{"USER_ID":"demo-manager","ROLE":"ADMIN","ACTIVE":true,"DEMO":true}]}]}
```

Run this private setup once as a platform administrator; it creates only the
separate directory and inserts missing demo keys. Replays preserve edits:

<!-- example: prepare-accounts -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "private" }

function PrepareAccounts({ input, config, result }) {
  result.setup = sql.initialize({ initializer: "accounts", seed: true })
}
```

## Demo login

`DemoLogin` from `flow://guide/entities` checks
`String(config.demo.login) === "true"` **before** looking up the chosen active
demo account and calling `session.authenticate`. The symbol
`<project>.demo.login` defaults false in the delivered project. Enable it only
for the demonstration; show the picker only when `CurrentUser.demoLoginEnabled`
is true. Never add a role input. A demo identity is not a real password check.

Keep the MCP bearer (source author) distinct from application cookie sessions.
After signing in as `demo-manager` through the application, initialize entities
through this hidden facade with that same ADMIN cookie jar; `entity.initialize`
checks ADMIN. Never infer this identity from `code-run` or its author token.

<!-- example: initialize-bookings -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "hidden", authenticatedContextRequired: true }

function InitializeBookings({ input, config, result }) {
  result.setup = entity.initialize({ entity: "Room" })
}
```

Add one Room as ADMIN through its EntityForm. Initialize twice and verify the
room remains. Poll the session endpoint with the **same cookie jar** while the
project migrates; bound retries and surface failures with `Status`.

## Me and logout

The public `CurrentUser` is the `me` endpoint: anonymous is a normal result;
an inactive account or revoked role is refused by the server provider.

<!-- example: current-user -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "hidden" }

function CurrentUser({ input, config, result }) {
  local.user = session.authenticatedUser({})
  local.demoLoginEnabled = String(config.demo.login) === "true"
  if (!local.user) {
    return { authenticated: false, user: null, demoLoginEnabled: local.demoLoginEnabled }
  }
  local.actor = app.actor({})
  return {
    authenticated: true,
    demoLoginEnabled: local.demoLoginEnabled,
    user: { id: local.actor.user, firstName: local.actor.user, role: local.actor.roles[0] },
  }
}
```

<!-- example: logout -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "hidden" }

function Logout({ input, config, result }) {
  session.authenticate({ user: "" })
  return { authenticated: false, user: null }
}
```

## 2. Apply the rule in an ordinary hook

A booking occupies `[starts, ends)`: adjoining dates are allowed; an empty or
reversed interval is refused. `beforeSave` receives `input.mutation`
(`creating`, `key`, `patch`, `revision`) and the trusted `input.actor`.
For an update, merge the patch with the permitted existing row. Use the hook
below, not two independent frontend writes. The private named overlap query
checks **all owners** without exposing their rows to the caller. The no-op
room update locks that resource until the same `entity.save` transaction ends,
so competing saves of this room check after the preceding commit. No role is
invented, no new transaction primitive is needed, and rejection rolls back the
mutation and its journal. Keep all reservation writes on this hook; do not
expose the technical SQL statements as HTTP facades.

<!-- example: booking-rule -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "private", authenticatedContextRequired: true }

function BookingRule({ input, config, result }) {
  local.values = input.mutation.patch
  if (!input.mutation.creating) {
    local.previous = entity.read({ entity: "Reservation", key: input.mutation.key })
    local.values = object.merge({ target: local.previous.values, source: input.mutation.patch })
  }
  if (local.values.starts >= local.values.ends) {
    throw { code: "BOOKING_DATES_INVALID", message: "End must follow start", status: 422 }
  }
  local.lock = sql.write({ statement: "lockRoom", parameters: { room: local.values.room } })
  if (local.lock.affectedRows !== 1) {
    throw { code: "ROOM_NOT_FOUND", message: "Choose an existing room", status: 422 }
  }
  if (local.values.status === "OPEN") {
    local.overlap = sql.query({
      query: "overlap",
      parameters: {
        room: local.values.room,
        starts: local.values.starts,
        ends: local.values.ends,
        id: input.mutation.creating ? null : input.mutation.key.id,
      },
      limit: 1,
    })
    if (local.overlap.rows[0].total !== "0") {
      throw { code: "BOOKING_OVERLAP", message: "This room is already booked", status: 422 }
    }
  }
  return { ok: true }
}
```

This is a small SQL locking convention for this rule, not a second CRUD layer.
When editing the example, qualify the DBMS's transaction isolation and retry
its deadlock/serialization errors as whole operations. A successful sequential
rejection test alone does not prove every concurrent schedule.

## 3. Build pages with ordinary events

Use `BookingApp` below as the target project name (adapt it to your project).
Create home/sign-in, `mine`, `manage` and `journal` pages **before** links. The
root Layout refreshes `CurrentUser` after navigation. Show management and journal
links only for MANAGER/ADMIN, and guard their pages before mounting tables.
The server model enforces the perimeter even if a user navigates directly.
Use `Status actionId="loginCall"` for transport/Flow errors. In a login button,
chain `CallSequence requestable=".DemoLogin"` (account only), then `Navigate`;
do not pass a role. For logout, pass `__disableAutologin=true` so the SDK cannot
replay sign-in. Navigate only in the successful login/logout action chain.

<!-- example: session-layout -->
```svelte
<script module>export const _flow = { sourceVersion: 2 };</script>
<FlowComponent $$id="sessionLayout">
  <Variables><State $$id="session" type="object" value={{ authenticated: false, user: null }} /></Variables>
  <Events><OnAfterNavigate $$id="refreshSession"><Actions>
    <CallSequence $$id="loadSession" requestable=".CurrentUser" $$out="layout.session" />
  </Actions></OnAfterNavigate></Events>
  <Structure>
    <AppShell $$id="shell" title="Bookings" userName={layout.session.user?.firstName ?? ""}>
      <Navigation><LinkButton $$id="mine" label="My bookings" page="mine" /></Navigation>
      <Tools><Button $$id="logout" label="Sign out" variant="ghost"><Events><OnClick $$id="signout"><Actions>
        <CallSequence $$id="logoutCall" requestable=".Logout"><Variables><Variable name="__disableAutologin" value={true} /></Variables></CallSequence>
        <Navigate $$id="goHome" page="home" />
      </Actions></OnClick></Events></Button></Tools>
      <Children><PageContent $$id="content" /></Children>
    </AppShell>
  </Structure>
</FlowComponent>
```

For the guarded `mine` page, use this editing chain; create and delete actions
follow the effective model permissions. MANAGER uses the same widgets without
a forced `scope="mine"`; the user perimeter is enforced server-side in both.
Business validation uses 422 so EntityForm shows its message; 409 is reserved
for the stale-revision reload path. A conflict is shown by EntityForm; its Reload command reloads before retry.

<!-- example: booking-editor -->
```svelte
<script module>export const _flow = { sourceVersion: 2, page: { id: "mine" } };</script>
<FlowComponent $$id="bookingEditor">
  <Variables>
    <State $$id="session" type="object" value={{ authenticated: false, user: null }} />
    <State $$id="row" type="object" value={null} />
    <State $$id="editing" type="boolean" value={false} />
    <State $$id="refresh" type="number" value={0} />
  </Variables>
  <Events><OnMount $$id="checkSession"><Actions>
    <CallSequence $$id="me" requestable=".CurrentUser" $$out="page.session" />
  </Actions></OnMount></Events>
  <Structure>
    <PageHeader $$id="heading" title="My bookings" />
    <Status $$id="sessionStatus" actionId="me" />
    <If $$id="authenticated" test={page.session.authenticated}><Then>
      <Button $$id="create" label="New booking"><Events><OnClick $$id="new"><Actions>
        <SetValue $$id="clear" target="page.row" value={null} />
        <SetValue $$id="open" target="page.editing" value={true} />
      </Actions></OnClick></Events></Button>
      <EntityTable $$id="bookings" entity="Reservation" targetProject="BookingApp" scope="mine" refreshKey="@page.refresh">
        <Events><OnSelect $$id="select"><Actions>
          <SetValue $$id="keep" target="page.row" value="@event.value" />
          <SetValue $$id="edit" target="page.editing" value={true} />
        </Actions></OnSelect></Events>
      </EntityTable>
      <If $$id="editor" test={page.editing}><Then>
        <EntityForm $$id="form" entity="Reservation" targetProject="BookingApp" row="@page.row">
          <Events>
            <OnSaved $$id="saved"><Actions>
              <SetValue $$id="closeSaved" target="page.editing" value={false} />
              <SetValue $$id="clearSaved" target="page.row" value={null} />
              <UpdateNumber $$id="refreshSaved" target="page.refresh" operation="increment" step={1} />
            </Actions></OnSaved>
            <OnDeleted $$id="deleted"><Actions>
              <SetValue $$id="closeDeleted" target="page.editing" value={false} />
              <SetValue $$id="clearDeleted" target="page.row" value={null} />
              <UpdateNumber $$id="refreshDeleted" target="page.refresh" operation="increment" step={1} />
            </Actions></OnDeleted>
            <OnCancel $$id="cancel"><Actions>
              <SetValue $$id="closeCancel" target="page.editing" value={false} />
              <SetValue $$id="clearCancel" target="page.row" value={null} />
            </Actions></OnCancel>
          </Events>
        </EntityForm>
      </Then></If>
    </Then><Else><Text $$id="loginRequired" text="Sign in to see your bookings." /></Else></If>
  </Structure>
</FlowComponent>
```

Add `EntityTable entity="Audit"` to the manager-guarded journal page. For a
custom cell, preserve the generic lexical snippet arguments described in
`flow://guide/entities`; do not copy widget internals or add browser scripts.

## Export CSV

The export reuses `entity.list`, so forged users and roles cannot widen its
perimeter. This minimal export has no client filter and is explicitly complete
up to 200 rows: if more exist, refuse rather than silently export one page.
When adding screen filters, validate and pass the **same** filters here. For
larger exports use a bounded paging loop, not a client-side CSV encoder.

<!-- example: export-bookings -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "hidden", authenticatedContextRequired: true }

function ExportBookings({ input, config, result }) {
  local.page = entity.list({ entity: "Reservation", options: { limit: 200, orderBy: "id" } })
  if (local.page.hasMore) {
    throw { code: "EXPORT_LIMIT", message: "Narrow the export below 201 rows", status: 413 }
  }
  local.rows = list.map({
    items: local.page.rows,
    select: {
      id: current.key.id,
      title: current.values.title,
      starts: current.values.starts,
      ends: current.values.ends,
    },
  })
  result.file = data.csv({
    rows: local.rows,
    columns: [
      { field: "id", type: "int64" },
      { field: "title" },
      { field: "starts", type: "date" },
      { field: "ends", type: "date" },
    ],
    filename: "bookings.csv",
    separator: ";",
    bom: true,
    maxRows: 200,
    maxBytes: 1048576,
  })
}
```

Use ordinary `CallSequence` then `FileDownload` with `@page.export.file`; read
the `data.csv` and frontend file-download contracts from the palette. The CSV
has UTF-8 BOM, French dates and formula protection. A `.bin` facade can instead
end with `file.respond`. Neither a download button nor a hidden link grants
permission.

## Scheduled jobs

Start with a **read-only daily check**: a private Flow counts bookings starting
today, with a server date, no browser session and no notification side effect.
It is naturally replayable; do not claim that a message was sent. The job is off
by default through `<project>.jobs.enabled`. No session is forged for the job.
The private named query has only the aggregate necessary for this service.

<!-- example: daily-bookings -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "private" }

function DailyBookings({ input, config, result }) {
  if (String(config.jobs.enabled) !== "true") {
    return { enabled: false, count: "0" }
  }
  local.day = date.today({ timeZone: "Europe/Paris" })
  local.page = sql.query({ query: "startsToday", parameters: { day: local.day }, limit: 1 })
  return { enabled: true, day: local.day, count: local.page.rows[0].total }
}
```

Inspect `scheduler-list`, then use the advertised relayed `scheduler-apply` to
schedule the exact private `<project>.DailyBookings` requestable with a
project-specific job name, Europe/Paris and a daily trigger. Read that tool's
contract; scheduler availability is deployment-specific. Run it once and replay
it before enabling the schedule. For real sending, add an idempotent outbox and
`email.send` with a capture server first; do not send external effects in a JDBC
transaction.

## Audit

`Journalisé` allowlists only the model fields shown above. The library writes
actor, operation, key, server date and those values **in the mutation's SQL
transaction**. Failure of the hook or journal aborts the write; no password,
token or account secret belongs in this model or journal. The read-only Audit
entity shares the table and checks MANAGER/ADMIN read permissions. Review
retention separately; a journal after a committed mutation is not equivalent.

## 4. Prove and deliver

Test anonymous, two USER sessions and a manager in distinct cookie jars; check
own/foreign reads and writes, client role forgery, revoked roles, two overlapping
bookings by different users, adjoining dates, partial updates, stale revision,
CSV perimeter/formulas/dates/limits, job off/on/replay, journal contents and
rollback, and logout with the old cookie. A page guard complements server checks.
Use `frontend-svelte-action` dev.open, then one relayed verifier for the roles;
a successful build or HTTP 200 alone is not interaction proof. Sign-in errors
may have HTTP 200 with a Flow error: show `Status`, not only a result field.

Keep sources in Git and runtime data out. Run `flow-block-mock-list`, build with
`frontend-svelte-action` build, try the published URL, and run
`flow-app-progress` hardening. Keep CORS same-origin, symbols for credentials,
demo login/jobs off by default, private initialization and documented production
identity/database choices. Entity example tests execute every backend/config
fence above; `frontend-guide-examples` compiles the exact layout and editor.
