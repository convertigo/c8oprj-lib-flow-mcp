# Entity widget business Flows

Read when entity widgets call custom operation Flows.

## Business Flows as the source

When writes carry business rules, give the widgets `flows` instead of the gateway:
`{describe, list, read, count, aggregate, create, update, delete}` name project
Flows called with the payload of that gateway operation (`{options}`, `{key,
options}`, `{values}`, `{key, revision, values}`, `{key, revision}`) and answering
as it does. An operation without a Flow is unavailable: a widget never falls back
on the gateway, and an inverse list of EntityView needs its own `flows`.

The widget calls each Flow over HTTP from the browser, as it calls the gateway:
`POST /projects/<project>/.json?__sequence=<Flow>` with the session cookie, each
payload key (`options`, `key`, `values`, `revision`) a form parameter. So each
Flow is `hidden` (callable over HTTP, not listed) or `public`, never `private`:
a `private` Flow, the default without `accessibility`, answers that call from a
non-administrator session as an unknown requestable. It requires the session, declares the payload keys it
reads as inputs, `object` for `options`, `key` and `values` (an HTTP parameter
is text, converted to the declared type), and only passes them on
(`entity.save` with `key`, `revision`, `values`; never an actor or an owner
from the input):

```javascript
const _flow = {
  sourceVersion: 3,
  accessibility: "hidden",
  authenticatedContextRequired: true,
  inputs: { options: { type: "object", default: {} } },
}

function ListDossiers({ input, config, result }) {
  return entity.list({ entity: "Dossier", checkAccess: true, options: input.options })
}
```

`code-run` and `requestable-execute` also run `private` Flows: prove the call
from the page with the widget user's session.

In the same change, close the gateway for these writes with
`"gateway": {"writes": false}` on the entity; `code-check` says
`ENTITY_GATEWAY_WRITES_OPEN` otherwise. Not calling the gateway never closes it:
any client can still call it. So a read restriction lives in the access policy
(or `visibleTo`), never only in a list Flow, which formats and does not narrow.
