# Entity widget business Flows

Read when entity widgets call custom operation Flows.

## Business Flows as the source

When writes carry business rules, give the widgets `flows` instead of the gateway:
`{describe, list, read, count, aggregate, create, update, delete}` name project
Flows called with the payload of that gateway operation (`{options}`, `{key,
options}`, `{values}`, `{key, revision, values}`, `{key, revision}`) and answering
as it does. An operation without a Flow is unavailable: a widget never falls back
on the gateway, and an inverse list of EntityView needs its own `flows`. Each Flow
is `hidden`, checks the session, and only passes the options on:
`return entity.list({entity: "Dossier", checkAccess: true, options: input.options})`
(`entity.save` with `key`, `revision`, `values`; never an actor or an owner from
the input). In the same change, close the gateway for these writes with
`"gateway": {"writes": false}` on the entity; `code-check` says
`ENTITY_GATEWAY_WRITES_OPEN` otherwise. Not calling the gateway never closes it:
any client can still call it. So a read restriction lives in the access policy
(or `visibleTo`), never only in a list Flow, which formats and does not narrow.
