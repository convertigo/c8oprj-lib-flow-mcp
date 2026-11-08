# Flow Authoring: Lists, Maps, Config And Schemas

Lists, maps and config in FlowScript, output schemas, native inputs and backend primitives.

Sub-guide of `flow://guide/authoring`: read that guide first.

## Lists, maps and config

```javascript
local.rows = list.map({ items: input.items, select: { label: current.label } })
result.rows = local.rows
local.rates = json.object({
  $$fields: function () {
    json.field({ key: "EUR", value: 1 })
    json.field({ key: "USD", value: 1.1 })
  },
})
local.codes = object.keys({ source: local.rates })
local.usd = object.get({ source: local.rates, key: "USD" })
result.codes = local.codes
result.usd = local.usd
```

Filter each item with an unquoted expression: `local.tagged = list.filter({ items: input.rows, where: current.doc.tag == local.tag })`.
Read a field of the current item as `current.new`, for example `local.names = list.map({ items: local.tagged, select: current.new })`; bare `new` is out of scope.

- Never hard-code `items[0]`, `items[1]` for a dynamic list. `list.map`
  `select` takes an expression, object literal or named block call evaluated
  for each item. A block nested there can use `$$id` for an explicit name.
- For physical line numbers, split before skipping blanks:
  `local.lines = text.split({ text: input.csv, separator: "\\r?\\n", regex: true, trim: false, removeEmpty: false })`.
  Iterate `local.lines` with `while` and a zero-based `local.index`; report
  `local.index + 1` as top-level `throw.line`, and filter only after numbering.
  `text.split` and `text.lines` otherwise drop empty items by default, shifting
  later line numbers; `list.map` and `forEach` do not expose an index.
- `object.firstEntry({ source })` returns one `{ key, value }`.
- For repeated external work, model one item and iterate: store rows in
  `config.*` or a small data block and call one per-item FlowScript block.
- Temporary configuration for a subtree:

```javascript
config.use({
  overrides: { http: { timeout: 30000 } },
  $$then: function () {
    result.timeout = config.http.timeout
  },
})
```

Root keys (or one `overrides` object) are config branches, deep-merged only
while `$$then` runs.

Configuration is inherited and merged value by value (objects merge, any other
value replaces), weakest first:

1. `_flow.config` of the Flow;
2. the `config` of `_flow/engine.yaml` of lib_flow_engine, then of each
   referenced Flow project, in the order of the project references (a
   referenced project comes after its own references; the last one wins);
3. the project `_flow/engine.yaml`: `default`, then the named configurations of
   the Flow's tags, the last tag winning (`flow://guide/tags`);
4. the project the HTTP request targets, when it is another project: its own
   values win, so a library takes the settings of each application using it;
5. the call config.

A library ships every setting with a working default under its own prefix
(`email.smtp.*`, `oauth.*`, `sql.*`); a project overrides only the values it
needs, in its own `config`, without symbols unless the value depends on the
server. When two references declare the same branch, `configParents` picks one:

```yaml
configParents:
  email.smtp: lib_flow_engine
config:
  email:
    smtp:
      port: 2525
```

Put structural constants (API roots, timeouts) in project or Flow `config.*`;
reuse inherited or project config instead of duplicating it in `_flow.config`.

Emails: `email.send({ to, subject, html })` uses the SMTP server of the platform
(`config.email.smtp`, inherited from lib_flow_engine and set by the symbols
`lib_flow_engine.smtp.*`). Render the HTML with `template.freemarker({ file:
"_flow/resources/emails/welcome.ftlh", locale: input.lang, values: { ... } })`:
a `.ftlh` template escapes the values for HTML, `welcome_fr.ftlh` is picked for
the `fr` locale. A FreeMarker template is a resource file of the project (or a
plain string in the Expert `template` property); its `${...}` belong to
FreeMarker, so never write it as a JavaScript template literal.

Secrets never appear in a configuration: reference a Convertigo global symbol
ending with `.secret`, always with a default, so that the project declares it
(empty or a dummy value):

```yaml
configs:
  production:
    sql:
      connections:
        orders:
          url: "jdbc:postgresql://db:5432/orders"
          user: "${orders.db.user=orders_reader}"
          password: "${orders.db.password.secret=}"
```

The server replaces `${name}` / `${name=default}` for the running Flow only;
the value is stored encrypted and set by an administrator in the Global
symbols page. The effective configuration shown in the Studio, the traces and
the schemas keep the reference. A symbol without default that is not declared
becomes empty and marks the project.

## Output schemas

- `flow-output-schema({ project, qname })` combines the explicit contract,
  static analysis of `result.*` writes and optional learned samples; add
  `detail:"full"` to compare declared/static/learned/effective sources and
  warnings. Ordinary `code-run` does not learn the Flow result.
- `_flow.outputs` is optional. After a verified run, `action:"adopt"` with
  `source:"static"|"learned"` writes it, `action:"remove"` deletes it,
  `action:"reset"` deletes stale learned samples only.
- `flow-node-output-schema({ project, qname, nodeId, detail:"full" })`
  inspects one producer (HTTP, exec, parser); pass the JSON Pointer `path`
  from `flow-search` as `nodePointer` when `nodeId` is ambiguous. Use
  `action:"adopt"` to keep a verified schema, `action:"remove"` to resume
  inference.
- Learned fields no longer produced, or `unknown` items from old samples, are
  stale. Prefer `flow-node-output-schema action:"remove"` for one producer;
  `flow-schema-reset({ project, flowName })` only for broader stale learned
  schemas.

## Native inputs and backend primitives

`_flow.authenticatedContextRequired` is a native boolean. Input `visibility`
(-1 masks all, 0 visible, or bitmask 1/2/4/8) and `isFileUpload:true` are
synchronized to the generated Convertigo variables, persisted on promotion,
and retained on reload. An omitted property preserves its native value; an
explicit false/zero resets it. `flow-sync-inputs({project,name})` also accepts
`qname` instead of name. It requires a target Flow, not just a project.
An input marked `required` is rejected by the engine with `FLOW_INPUT_REQUIRED`
before the Flow runs. When the API needs its own error code, keep the
input optional and validate it in the Flow with `throw { code, message }`.
On the requester (.json, SDK, frontbuilder), an application error answers with
200 and the `error` envelope; do not set `status` by habit, only when a client
outside the SDK requires one (standard REST codes: URL mapper operations).

Rare, explicit choices for a client outside the SDK; by default write
`throw { code, message }` and the SDK receives 200 with the error envelope.
- `response.error({code,message,details})` writes that structure at
  `result.error` (or `path`) beside the rest of the result, without stopping
  the Flow or setting a status.
- `response.status({code})` (100 to 599) sets the response status, also from a
  called Flow; without HTTP request (schedule, FullSync) it has no effect.
- `response.header({name,value})` sets one header the same way; CR/LF and
  engine-owned headers (`Set-Cookie`, `Content-Length`, CORS, security) are refused.

Use `csv.parse({path:input.file,rowSchema:local.rowSchema,separator:";",
maxRows:10000})` for uploaded UTF-8 CSV, or pass `text` instead of path. The
result contains typed `rows`, `rowCount`, `columns`, `rowSchema`, `byteLength`.
It supports BOM/quotes/multiline cells and refuses overflow or invalid cells
without a partial result. It reads data; writes remain explicit transactions.

Use `flow.poll({until:local.job.body.status == "finished",intervalMs:1000,
timeoutMs:30000,maxAttempts:30,$$nodes:function(){...}})` to wait for an async
job: one attempt, then the condition, then a sleeping interval. Bound the
child HTTP timeout too. `flow.wait({delayMs:250})` yields without a busy loop
and has a hard 60-second cap. Exhausted polling raises `POLL_TIMEOUT` (504).
`project.cacheRemove({key:"table_id_cache"})` invalidates the exact key in the
current project's native application cache (including legacy caches),
returning `{key,removed}`; it does not clear runtime descriptor caches.

Contracts, limits, error codes and complete examples:
`flow://lib/lib_flow_engine/backend-io`. Never add a Rhino CSV parser, sleep
or project-cache bridge in an application.
