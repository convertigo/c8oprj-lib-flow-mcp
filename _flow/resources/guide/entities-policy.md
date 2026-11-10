# Flow Entities: Access Policy

One access policy, local to the application: roles, scopes, public reads and write rules over entities.

Sub-guide of `flow://guide/entities`: read that guide first.

## One access policy, local to the application

`flow-entity-model-set` creates a private `app.entityAccess` **only if
missing**, and an `EntityGateway` only with `gateway: true`, for pages that use
EntityTable or EntityForm: hidden, for signed-in sessions
(`_flow.authenticatedContextRequired`; set it to false deliberately for
anonymous `publicRead` pages: false opens to anonymous callers every read the
policy allows through the gateway, for every entity, not only those pages). The gateway runs every operation this policy
allows, outside the rules of business Flows: open only the writes its pages
need. Its response lists created/preserved sources and the policy decisions still required. Neither is regenerated on
model edits. There is no shared library gateway, project selector, gateway
configuration flag or migration fallback. The widgets call this local gateway directly; omitting `targetProject` uses
the application serving the frontend.

`app.entityAccess` receives `input.request = {entity, operation, write, key,
payload, user, roles?}`. `user` is exclusively the authenticated server session;
`roles`, when requested, comes exclusively from the configured actor provider.
Client `user`, `roles`, `write`, `scope`, `project` and `checkAccess` have no
control over authorization. Normal termination allows; throw
`{code,message}` denies. Return `{scope:{field:value}}` to add **typed
stored-field equalities**. No predicate language: client filters/search are
ANDed with scope, also for count, options, relation validation and labels.
Creation imposes scope values over forged input. Updates, including hook writes,
must remain in scope or their transaction (audit included) rolls back.

The generated policy is the explicit default. Open anonymous reads simply by
editing `publicRead`; uncomment and adapt the role example to scope rows per role
(this also opens the matching writes):

<!-- example: default-access-policy -->
```javascript
const _meta = {sourceVersion:2,version:1,private:true,properties:{request:{type:"object",kind:"expression"}},outputs:{out:{type:"object"}}}

function block({ input, config, result }) {
  // The request of the operation is an object: anything else is refused.
  if (!input.request || typeof input.request !== "object") {
    throw { code: "ENTITY_FORBIDDEN", message: "Invalid access request." }
  }
  // Entities readable without sign-in: for example ["Room"], or ["*"].
  local.publicRead = []
  if (!input.request.write && (local.publicRead.includes("*") || local.publicRead.includes(input.request.entity))) {
    return {}
  }
  if (!input.request.user) {
    throw { code: "ENTITY_UNAUTHENTICATED", message: "Sign in to read entities." }
  }
  // Rows per role, for reads and writes: ADMIN every ticket, SUPPORT the tickets assigned
  // to it, anyone else the tickets they requested (creation imposes requesterId).
  // input.request.roles needs config.entities.actorProvider (flow://guide/entities).
  // Uncommented, it also opens delete and field rewrites (SUPPORT may rewrite requesterId, a requester choose assigneeId): restrict by input.request.operation or a model ACL.
  // if (input.request.entity === "Ticket") {
  //   if (input.request.roles.includes("ADMIN")) {
  //     return {}
  //   }
  //   if (input.request.roles.includes("SUPPORT")) {
  //     return { scope: { assigneeId: input.request.user } }
  //   }
  //   return { scope: { requesterId: input.request.user } }
  // }
  if (input.request.write) {
    throw { code: "ENTITY_FORBIDDEN", message: "Writes are disabled by the application policy." }
  }
  return {}
}
```

`input.request.roles` exists only when `config.entities.actorProvider` names your
actor block (**Authentication** in `flow://guide/entities-auth`); without it, `roles.includes(...)` is false
and everyone gets the narrowest scope. Scope fields can be relations, as above.
A relation's labels, options and validation read its target through this same
policy: keep a referenced directory readable when signed in (hide its other fields
with `visibleTo`). If the policy, a model ACL or a slot refuses the target (`ENTITY_UNAUTHENTICATED`
or `ENTITY_FORBIDDEN`, a throw without status included; a 404 still fails the read), labels are omitted with the run warning
`ENTITY_RELATION_LABELS_OMITTED`; options and validation return `ENTITY_FORBIDDEN`
"Relation non autorisée." naming only `details.field`. A create or update that neither sets nor changes such a relation does not read its target and succeeds; any write that sets or changes it, including to null, is refused. A create also sets it when a default, an auto rule, the policy scope or the Possédé owner fills it.

Without that block, the same default applies: nonempty
`getAuthenticatedUser()` for reads, all writes refused. A cookie alone is not
authentication. There is **no model ACL by default**. A declared `permissions`
ACL adds refusals after the policy; `["ADMIN"]` cannot open a policy-denied write.
`visibleTo` and `Possédé` access restrictions apply only on controlled calls.

The closed read operations are `list`, `read`, `count`, `options`, `describe`;
writes are `create`, `update`, `delete`. `save` is classified by its supplied
identity (update requires an existing row; never upsert), never by client
`write`. Unknown operations, `initialize` and `demoReset` return
`ENTITY_OPERATION_UNKNOWN`. Administrative primitives stay separate.
A refusal by a policy, model ACL or authorization slot, including on a relation target needed by options or validation, triggers no DDL (a refused target only omits labels); a refusal depending on data or a hook can occur after schema creation.
`describe.permissions` evaluates create/update/delete, including an additional
authorization slot, without hooks or mutation;
policies and slots must be safe to evaluate for a capability, with an empty
key/payload. Neither may recursively call a controlled entity operation.

The gateway delegates to `entity.applyGateway({entity,operation,payload})`.
An optional `$$authorize` slot runs after the policy and can only deny or add
scope equalities. Its `current.request` is the server request; return
`{scope:{...}}` for extra equalities. Replacing a previous equality is refused.
The scaffold has **no slot**, so it never authorizes twice. Direct public
facades use `checkAccess:true` instead; it is a source option, never copied
from HTTP input. Trusted defaults (`false`) remain for private application
composition and jobs. Do not expose an unguarded trusted primitive publicly.

## Inactive rows

An `Activable` entity lists and counts active rows only. `options.active` of
`entity.list`, `entity.count`, `entity.read` and of the gateway's list, count
and read asks for others: `"active"` (the default of a list or a count),
`"inactive"` or `"all"`; `null` reads as absent, any other value is
`ENTITY_ACTIVE_INVALID`. The option is subject to
this policy: `input.request.payload.options.active` carries it, and the policy
may refuse it (a throw), for instance for every role but ADMIN. A policy scope
that fixes the active field (`{scope: {actif: true}}`) still applies: inactive
rows stay out of reach, and a filter on that field is refused with
`ENTITY_FORBIDDEN`. A filter on the active field, such as `{actif: false}` or an
`or` naming it, reads as `options.active: "all"`: the policy receives the request
with that option, so a filter never reaches a row that the same request with
`options.active` would not. An explicit `options.active` wins over such a
filter; a top-level `{actif: true}` keeps the default.

A read by key (`entity.read`, the gateway's read) without `options.active`
returns the row whatever its state. On a controlled read this policy receives
it as `options.active: "all"`; when the policy, or the gateway's `$$authorize`
slot, refuses that, the read keeps to active rows: an actor kept from inactive
rows reads an inactive row as `ENTITY_NOT_FOUND`, exactly as a missing key, and
an explicit `"all"` or `"inactive"` gets the refusal whether the row exists or
not. To reactivate a row, an allowed actor reads it (`options: {active: "all"}`
or no option) and saves its key with the active field set to `true`. Writes by
key reach inactive rows: to keep a role that writes away from them, use the
scope that fixes the active field.
