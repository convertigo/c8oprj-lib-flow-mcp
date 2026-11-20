# Multi-Page Entities: Login And Access Rules

Demo login, me and logout, application access in one editable block, and the rule applied in an ordinary hook.

## Demo login

`DemoLogin` from `flow://guide/entities` checks
`String(config.demo.login) === "true"` **before** looking up the chosen active
demo account and calling `session.authenticate`. The symbol
`<project>.demo.login` defaults false in the delivered project. Enable it only
for the demonstration; show the picker only when `CurrentUser.demoLoginEnabled`
is true. Never add a role input. A demo identity is not a real password check.

Keep the MCP bearer (source author) distinct from application cookie sessions.
After `demo_reset`, sign in through the application; never infer this identity
from `code-run` or its author token. Public `entity.*` calls use `checkAccess:true` and the unique application policy.
Trusted private calls require no session or model ACL. Their first use ensures the additive
schema once per JVM/connection/model fingerprint; no initialization screen or
ADMIN cookie is needed. Explicit `entity.initialize({})` is available for
maintenance or a read-only `dryRun` / `verifyOnly`, without a session.

## Me and logout

The public `CurrentUser` is the `me` endpoint: anonymous is a normal result;
an inactive account is refused by the server provider. A revoked role stops
authorizing entity operations as soon as the server table changes.

<!-- example: current-user -->
```javascript
const _flow = { sourceVersion: 3, accessibility: "hidden" }

function CurrentUser({ input, config, result }) {
  const user = session.authenticatedUser({})
  const demoLoginEnabled = String(config.demo.login) === "true"
  if (!user) {
    return { authenticated: false, user: null, demoLoginEnabled }
  }
  const actor = app.actor({})
  return {
    authenticated: true,
    demoLoginEnabled,
    user: { id: actor.user, firstName: actor.user, role: actor.roles[0] },
  }
}
```

<!-- example: logout -->
```javascript
const _flow = { sourceVersion: 3, accessibility: "hidden" }

function Logout({ input, config, result }) {
  session.authenticate({ user: "" })
  return { authenticated: false, user: null }
}
```

## Application access, one editable block

Model-set has created the default private `app.entityAccess`, and
`EntityGateway` with `gateway: true`, without overwriting existing code. Replace **only the policy**
with this application decision. The actor provider of `flow://guide/multipage-entities` supplies server roles.
No gateway slot or config key is needed; no model ACL opens additional rights.
`Audit`/`APP_USER` retain optional deny-only ACLs as a second restriction.

<!-- example: booking-access-policy -->
```javascript
const _meta = {sourceVersion:3,version:1,private:true,properties:{request:{type:"object",kind:"expression"}},outputs:{out:{type:"object"}}}

const _flow = { sourceVersion: 3 }

function block({ input, config, result }) {
  // Explicit public catalog reads only; leave empty for authenticated reads.
  const publicRead = []
  if (!input.request.user) {
    if (!input.request.write && (publicRead.includes("*") || publicRead.includes(input.request.entity))) {
      return {}
    }
    throw { code: "UNAUTHENTICATED", message: "Sign in first" }
  }
  const roles = input.request.roles || []
  const manager = roles.includes("MANAGER") || roles.includes("ADMIN")
  if (!manager && !roles.includes("USER")) {
    throw { code: "FORBIDDEN", message: "Booking role required" }
  }
  if (input.request.entity === "APP_USER" || (input.request.entity === "Audit" && !manager)) {
    throw { code: "FORBIDDEN", message: "Directory or audit unavailable" }
  }
  if (input.request.write && ((input.request.entity === "Room" && !manager) || (input.request.operation ===
    "delete" && !manager))) {
    throw { code: "FORBIDDEN", message: "Manager action required" }
  }
  if (input.request.entity === "Reservation" && !manager) {
    return { scope: { owner: input.request.user } }
  }
  return {}
}
```

`publicRead` is the single explicit opt-in for anonymous reads. Carefully choose
public entities, including their fields and relations. Server scope is also
applied to labels, options and counts. `Possédé` remains a reusable checked
ownership trait; private hooks may read across owners deliberately.
`initialize` and `demoReset` are not gateway operations and are not protected by
this policy. Initialization callers supply their own application guard. A reset
Flow must be private; an HTTP entry point verifies ADMIN before calling it with
`requestable.call`. Demo reset runs only in Studio, or with the explicit server
symbol `lib_flow_entity.demoReset.enabled=true` (false by default). A project demo
login symbol never enables a reset.

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
const _flow = { sourceVersion: 3, accessibility: "private", authenticatedContextRequired: true }

function BookingRule({ input, config, result }) {
  let values = input.mutation.patch
  if (!input.mutation.creating) {
    const previous = entity.read({ entity: "Reservation", key: input.mutation.key })
    values = object.merge({ target: previous.values, source: input.mutation.patch })
  }
  if (values.starts >= values.ends) {
    throw { code: "BOOKING_DATES_INVALID", message: "End must follow start" }
  }
  const lock = sql.write({ statement: "lockRoom", parameters: { room: values.room } })
  if (lock.affectedRows !== 1) {
    throw { code: "ROOM_NOT_FOUND", message: "Choose an existing room" }
  }
  if (values.status === "OPEN") {
    const overlap = sql.query({
      query: "overlap",
      parameters: {
        room: values.room,
        starts: values.starts,
        ends: values.ends,
        id: input.mutation.creating ? null : input.mutation.key.id,
      },
      limit: 1,
    })
    if (overlap.rows[0].total !== "0") {
      throw { code: "BOOKING_OVERLAP", message: "This room is already booked" }
    }
  }
  return { ok: true }
}
```

This is a small SQL locking convention for this rule, not a second CRUD layer.
When editing the example, qualify the DBMS's transaction isolation and retry
its deadlock/serialization errors as whole operations. A successful sequential
rejection test alone does not prove every concurrent schedule.
