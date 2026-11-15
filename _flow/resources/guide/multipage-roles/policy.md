# Direct SQL access perimeter

Read to enforce role and ownership scope on the server.

## 3. Enforce the perimeter on the server

Declare the facades that pages call with `_flow.accessibility:"hidden"` and
`authenticatedContextRequired:true`. `hidden` hides discovery but does not
forbid HTTP; `private` is for internal calls. Without a signed-in user,
`authenticatedContextRequired` refuses the call before the Flow runs, with
HTTP 200 and the engine error `{ code: "-1", message: "Authentication
required" }`: a `CallSequence` fails on it as on any error. If a client needs
an application-specific code, the Flow must check
the user itself and `throw({ code, message })`. Write these names in lowercase in
FlowScript. Keep the initializations and the scheduled job private. A server, and
a recent Studio, refuse them over HTTP to anyone but an administrator (an
older Studio still ran them for an anonymous call): prove a refusal with a
session that is not an administrator.

For each read or write, call `CurrentUser` again. The server chooses `ownerId`
and the rights. When the called Flow throws (UNAUTHENTICATED for an anonymous
user, FORBIDDEN for a refused role), `requestable.call` fails with that code and
message, and the calling Flow stops there: no extra check is needed. Catch it
with `try` to answer differently, or set `onError: "return"` to receive
`{ error }` as the value instead. In a named read, join the mandatory perimeter to the optional
filter, for example
`(:manage=TRUE OR OWNER_ID=:ownerId) AND (:status='' OR STATUS=:status)`.
`manage` and `ownerId` come from the server. Queries that a facade exposes do
not become public automatically: declare `readOnly:true`, keep `expose:false`
and use bound parameters. `SQL_QUERY_READONLY_REQUIRED` reports a missing
`readOnly:true`.

Prefer `sql.table` and `data.read`/`data.write` for CRUD. A named query suits a
bounded join. Validate filters, columns and sorts against allowlists; never
concatenate SQL supplied by the client. Refuse an unauthorized filter and an
unknown sort with application codes, for example `BOOKING_FILTER_INVALID` and
`BOOKING_ORDER_INVALID`. For an update, read the row again, check its owner or
the manager role, then pass its revision to the data contract. Do not accept an
arbitrary patch from the browser.
