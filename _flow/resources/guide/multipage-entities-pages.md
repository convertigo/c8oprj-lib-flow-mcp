# Multi-Page Entities: Pages, Export, Jobs And Proof

Pages with ordinary events, CSV export, scheduled jobs, audit, then proof and delivery.

Sub-guide of `flow://guide/multipage-entities`: read that guide first.

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

For the guarded `mine` page, use this editing chain. Omit `targetProject`: both
widgets call this application's `EntityGateway` (hidden, signed-in sessions), never a library Flow.
Only cross-project screens set `targetProject` to the other application.
`describe` returns effective capabilities: put New inside the table Toolbar
and test `context.permissions.create`; EntityForm hides denied save/delete
actions and sends `create` for a new row, `update` for an existing key.
MANAGER uses the same widgets: `app.entityAccess` decides the server perimeter.

The optional table `ownershipFilter="mine"` narrows an authorized result; it is
not the policy's typed `scope` and cannot grant access. Leave it unset for the
nominal path. A refusal answers 200 with `ok: false`: `ENTITY_UNAUTHENTICATED` invites sign-in,
`ENTITY_FORBIDDEN` reports a forbidden action, and 400 shows field validation when supplied. Native model validation can also return
422. A 409 shows the existing Reload command before retrying the stale row.
The widgets clear old rows while reloading after a permission/session change.

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
      <EntityTable $$id="bookings" entity="Reservation" refreshKey="@page.refresh">
        <Toolbar><If $$id="mayCreate" test={context.permissions.create}><Then>
          <Button $$id="create" label="New booking"><Events><OnClick $$id="new"><Actions>
            <SetValue $$id="clear" target="page.row" value={null} />
            <SetValue $$id="open" target="page.editing" value={true} />
          </Actions></OnClick></Events></Button>
        </Then></If></Toolbar>
        <Events><OnSelect $$id="select"><Actions>
          <SetValue $$id="keep" target="page.row" value="@event.value" />
          <SetValue $$id="edit" target="page.editing" value={true} />
        </Actions></OnSelect></Events>
      </EntityTable>
      <If $$id="editor" test={page.editing}><Then>
        <EntityForm $$id="form" entity="Reservation" row="@page.row">
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

The export reuses `entity.list` with `checkAccess:true`, so forged users and roles cannot widen its
perimeter. This minimal export has no client filter and is explicitly complete
up to 200 rows: if more exist, refuse rather than silently export one page.
When adding screen filters, validate and pass the **same** filters here. For
larger exports use a bounded paging loop, not a client-side CSV encoder.

<!-- example: export-bookings -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "hidden", authenticatedContextRequired: true }

function ExportBookings({ input, config, result }) {
  local.page = entity.list({ entity: "Reservation", checkAccess: true, options: { limit: 200, orderBy: "id" } })
  if (local.page.hasMore) {
    throw { code: "EXPORT_LIMIT", message: "Narrow the export below 201 rows" }
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
transaction. A manual run of a job for the ADMIN is a separate hidden Flow that
checks the ADMIN role, then calls the private job with `requestable.call`;
never make the job itself public or hidden.

## Audit

`Journalisé` allowlists only the model fields shown in `flow://guide/multipage-entities`. The library writes
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
return HTTP 200 with an `error` envelope: show `Status`, not only a result field.

Keep sources in Git and runtime data out. Run `flow-block-mock-list`, build with
`frontend-svelte-action` build, try the published URL, and run
`flow-app-progress` hardening. Keep CORS same-origin, symbols for credentials,
demo login/jobs off by default, application-protected initialization and documented production
identity/database choices. Entity example tests execute every backend/config
fence above; `frontend-guide-examples` compiles the exact layout and editor.


Entity CRUD supports HSQLDB and PostgreSQL only; MariaDB's SQL bootstrap support
is not Entity qualification. `initialize`/`demoReset` remain exported blocks
without guards (`private:false`), called from a Flow protected by the application.
Trusted ownership prefers a live session, otherwise preserves an explicit owner.
`describe` is metadata-only and bounded; unreadable relation targets are omitted.
Public errors omit SQL names and DDL. Author diagnostics and the additive preview
stay in the server log and authenticated MCP `code-run` of `entity.initialize`
with `dryRun:true`. See Backend preview boundary in `flow://guide/entities-actions`.
