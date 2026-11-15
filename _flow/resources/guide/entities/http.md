# Entity HTTP facade

Read when an application must expose imposed Flow names, JSON keys or business error codes.

## Your own HTTP contract over entities

For a custom HTTP contract, name public Flows as your application
contract requires: `MyReservations` → `entity.list`, `ReadReservation` →
`entity.read` (not `entity.get`), `SaveReservation` → `entity.save`,
`DeleteReservation` → `entity.delete`. Use `checkAccess: true` on each public facade call (or the local
`EntityGateway`); a session guard alone is not an authorization policy.
`flow-entity-model-set` creates `app.entityAccess` without overwriting it;
facades need no gateway (`gateway: true` adds one for EntityTable/EntityForm
pages). Edit that one policy before opening writes;
see **One access policy** in `flow://guide/entities-policy`. Use the same guard and error translation
for each endpoint; keep SQL, ownership and audit in the declared model.
With the Reservation model in `flow://guide/multipage-entities`, this
complete create/update facade accepts flat request fields and returns exact keys:

<!-- example: http-save-reservation -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "hidden" }

function SaveReservation({ input, config, result }) {
  local.user = session.authenticatedUser({})
  if (!local.user) {
    throw { code: "UNAUTHENTICATED", message: "Sign in first" }
  }
  local.roomId = text.match({ text: input.room || "", pattern: "^[0-9]+$" })
  if (typeof input.title !== "string" || !input.title.trim() || typeof input.room !== "string" ||
    !local.roomId.matched || !input.starts || !input.ends) {
    throw { code: "VALIDATION_FAILED", message: "Title, room and dates required" }
  }
  try({
    error: "local.failure",
    $$try: function () {
      local.row = entity.save({
        entity: "Reservation",
        checkAccess: true,
        key: input.id ? { id: input.id } : {},
        revision: input.revision || "",
        values: { title: input.title, room: input.room, starts: input.starts, ends: input.ends },
      })
    },
    $$catch: function () {
      if (local.failure.code === "ENTITY_UNAUTHENTICATED" || local.failure.code === "UNAUTHENTICATED") {
        throw { code: "UNAUTHENTICATED", message: "Sign in first" }
      }
      if (local.failure.code === "ENTITY_SCHEMA_MISSING") {
        throw { code: "ENTITY_SCHEMA_MISSING", message: local.failure.message }
      }
      if (local.failure.code === "ENTITY_VALIDATION") {
        throw { code: "VALIDATION_FAILED", message: local.failure.message }
      }
      if (local.failure.code === "ENTITY_NOT_FOUND" || local.failure.code === "ENTITY_FORBIDDEN" ||
        local.failure.code === "ENTITY_SCOPE_VIOLATION" || local.failure.code === "FORBIDDEN") {
        throw { code: "FORBIDDEN", message: "Reservation unavailable" }
      }
      if (local.failure.code === "ENTITY_CONFLICT") {
        throw { code: "REVISION_CONFLICT", message: "Reload before saving" }
      }
      if (local.failure.code === "BOOKING_WINDOW_CONFLICT") {
        throw { code: "BOOKING_WINDOW_CONFLICT", message: local.failure.message }
      }
      if (local.failure.code === "BOOKING_OVERLAP") {
        throw { code: "ROOM_ALREADY_BOOKED", message: local.failure.message }
      }
      throw { code: "BOOKING_FAILED", message: "Booking service unavailable" }
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
`checkAccess: true` applies the policy scope and the optional model restrictions,
including `Possédé` and `visibleTo`. Trusted calls default to `false` and do not
apply those access restrictions; their public caller must protect them.
A hidden row and an absent row answer the same 404 `ENTITY_NOT_FOUND`, and a
refusal answers 200 with an `ENTITY_*` code. This facade imposes `FORBIDDEN` for
both rows, so another user's row is never unmasked. Adapt only the facade's JSON
keys to your contract.

<!-- example: http-list-reservations -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "hidden" }

function MyReservations({ input, config, result }) {
  local.user = session.authenticatedUser({})
  if (!local.user) {
    throw { code: "UNAUTHENTICATED", message: "Sign in first" }
  }
  local.page = entity.list({
    entity: "Reservation",
    checkAccess: true,
    options: { limit: 20, offset: input.offset || 0 },
  })
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

For `entity.list`, `options.orderBy` is one field name string, never an array.
When sorting by another field, the engine adds the automatic identity field as a stable tie-breaker.

An `Activable` entity lists and counts active rows only. `options.active` of
`entity.list`, `entity.count` and `entity.read` is `"active"` (the default of a
list or a count), `"inactive"` or `"all"`; `null` reads as absent, any other
value is `ENTITY_ACTIVE_INVALID`. A read by key without it returns the row
whatever its state, when the policy allows inactive rows to that actor.
The access policy receives it and decides: see **Inactive rows** in `flow://guide/entities-policy`.

For an imposed business error code, set `Reservation.hooks.beforeSave` to
`HttpBookingRule`. It adds the application's date-order refusal and reuses the
detailed recipe's locked overlap check. Its code reaches the Flow unchanged:

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
    throw { code: "BOOKING_WINDOW_CONFLICT", message: "End must follow start" }
  }
  flow.call({ flow: "BookingRule", input: input })
}
```

| Native error | Application example | Where to adapt |
|---|---|---|
| ENTITY_UNAUTHENTICATED | UNAUTHENTICATED | Prevent with the session guard **before** entity.*; do not require authenticatedContextRequired on the public facade, which would preempt your guard. |
| ENTITY_FORBIDDEN / ENTITY_SCOPE_VIOLATION | FORBIDDEN | Deny in app.entityAccess (server roles), or convert its refusal in catch. Never trust client roles. |
| ENTITY_NOT_FOUND (also outside Possédé) | FORBIDDEN (imposed here) | The same for an absent row and a hidden row; without an imposed code, keep the native 404 `ENTITY_NOT_FOUND`. |
| ENTITY_SCHEMA_MISSING | ENTITY_SCHEMA_MISSING | Preserve this setup error (a generic 500; its reason and plan are in the server log); fix database CREATE/ALTER grants or apply its plan as DBA. It is not an end-user role error. |
| ENTITY_VALIDATION | VALIDATION_FAILED | Validate inputs before save; convert remaining model validation in catch. |
| ENTITY_CONFLICT | REVISION_CONFLICT | Convert in catch; reload, do not blindly retry. |
| Your hook's code | BOOKING_WINDOW_CONFLICT | Throw in the hook; preserve that literal code in catch. Map BOOKING_OVERLAP separately if your contract calls it ROOM_ALREADY_BOOKED. |

`ENTITY_VALIDATION` names each refused field in `details.fields` (field: message)
and in `details.errors`: `{field, rule, message, expected}`, the rule one of
`required`, `type`, `maxLength`, `enum`, `notFuture`, `unknown`, `identity`,
`readOnly`, `serverManaged`, `owner`, `relation` or `unique`, `expected` the form
the model accepts; never the value received. A duplicate of a unique field
outside the actor's list answers the model ACL refusal instead (**Unique
fields** in `flow://guide/entities-model/unique`). A `try` keeps only `code`, `message`, `status`
and `hint` of the error: validate the fields your contract names before
`entity.save`. `entity.save` creates a row only when the database generates its
identity: on an entity identified by a natural key (an email, a code), a create
answers `ENTITY_NATURAL_KEY_CREATE_UNSUPPORTED` with how to do it today
(**Natural key** in `flow://guide/entities-model/format`).

A throw code is literal text: add one catch branch per expected business code,
not `code: local.failure.code`. Unexpected failures become BOOKING_FAILED
at this public boundary, without exposing internal errors; never report success.
A thrown error interrupts the Flow: the requester answers with HTTP 200 and
the JSON envelope contains `error.code` and `error.message`, with no success result. Use
`return { ... }` for exact success keys, not `{error:...}` as a successful result.
Entity refusals (`ENTITY_UNAUTHENTICATED`, `ENTITY_FORBIDDEN`, `ENTITY_SCOPE_VIOLATION`) answer
the same way, with `Cache-Control: no-store` and one server log line. A client tests `ok`
(or the `error` envelope) before reading data: `ok: false` with HTTP 200 is a refusal or a
failure, never empty data to show as a success.
For demo login and `me`, use the project actor in **Authentication** of `flow://guide/entities-auth` and
**Demo login** in `flow://guide/multipage-entities-access`; the switch stays off by
default. Login/session shape is independent of the choice of entities.

Read `flow://guide/multipage-entities` for the ordered application recipe.
Client-supplied roles never establish rights. Read each needed block contract
with `flow-block-get` before use.
