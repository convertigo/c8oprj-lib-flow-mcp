# Flow Authoring: Lists, Maps, Config And Schemas

Lists, maps and config in FlowScript, output schemas, native inputs and backend primitives.

Run a block as a statement, then test its result: `const m = text.match({ text: input.id, pattern: "^[0-9]+$" })`, then `if (m.matched) { ... }`.
A list grows when it is typed: `const errors = json.array({ itemType: { type: "string" } })`, then `errors.push("Invalid ID")`.
`JSON.parse(input.itemsJson)` raises an error on invalid text: catch it with `try { … } catch (e) { … }`, or use `json.safeParse({ text: input.itemsJson })` and check its `ok` and `value`; iterate with `for (const item of items) { … }`.
List methods are blocks written as JavaScript: `input.items.filter(item => item.valid)`, `input.items.map(item => item.id)`; check `.matched` of `text.match({ text: input.code, pattern: "^[0-9]+$" })` instead of a regex literal.

JSON and object functions are blocks written as JavaScript, in a declaration, an assignment or a `return`:

<!-- generated:v3-fragment id=globals -->
| JavaScript | Block |
|---|---|
| `Object.keys(o)`, `Object.values(o)` | `object.keys({ source: o })`, `object.values({ source: o })` |
| `JSON.parse(t)` | `json.parse({ text: t })` |
| `JSON.stringify(v)`, `JSON.stringify(v, null, 2)` | `json.stringify({ value: v })`, with `pretty: true` |
| `{ ...a, k: v, ...b }`, `Object.assign({}, a, { k: v })` | `object.merge({ target: a, source: { k: v } })`, one per part after the first, in hidden locals |

- Elsewhere, and with other arguments (replacer, reviver, other indent), they are refused (`FLOWSCRIPT_V3_GLOBAL_CALL`).
- `Object.entries` is refused: `for (const key of Object.keys(o)) { const value = o[key] … }`.
- `Date.now()` and `new Date()` are refused: use `date.now`, `date.format`… (time zone and format).
- `JSON.*` and `Object.*` remain refused inside other expressions, as in v2.
- An object spread or `Object.assign({}, …)` is also the whole value of a `push`, of `groups[k] = …` or of a branch of
  such a `?:`; elsewhere it is refused (`FLOWSCRIPT_V3_SPREAD`). A spread of a non-object adds no field;
  `Object.assign(o, …)` changes `o` (`FLOWSCRIPT_V3_GLOBAL_CALL`).
<!-- /generated -->

For an all-or-nothing batch, parse first, then validate every item in a `for…of`; push refusals and valid items to separate typed arrays. Do not write during validation.
Only when the refusal array is empty, make one `sql.transaction({ steps: [{ statement: "namedWrite", items: valid }] })` call; `statement` names a configured write and `items` repeats it within the same transaction.

## Lists, maps and config

```javascript
const rows = input.items.map(item => ({ label: item.label }))
const rates = { EUR: 1, USD: 1.1 }
const codes = Object.keys(rates)
return { rows, codes, usd: rates.USD }
```

Filter with an arrow: `const tagged = input.rows.filter(row => row.doc.tag == tag)`.
Read a field of each item through the arrow parameter, for example `const names = tagged.map(row => row.name)`; a bare field name such as `name` is not the field of the item.

- Never hard-code `items[0]`, `items[1]` for a dynamic list. The arrow of
  `map` or `filter` takes an expression without block call; to call a block for
  each item, write the call form `list.map({ items: rows, select: text.trim({ text: current.name }) })`,
  where `current` is the item. A block nested there can use `$$id` for an explicit name.
- For physical line numbers, split before skipping blanks:
  `const lines = text.split({ text: input.csv, separator: "\\r?\\n", regex: true, trim: false, removeEmpty: false })`.
  Iterate with `for (let index = 0; index < lines.length; index++)` (zero-based); report
  `index + 1` as top-level `throw.line`, and filter only after numbering.
  `text.split` and `text.lines` otherwise drop empty items by default, shifting
  later line numbers; `for…of` and `map` do not expose an index.
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
FreeMarker, so never write it as a JavaScript template literal. Never
concatenate values into `html`: a label typed by a user would become markup.

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

`session.get({ key })` gives back what `session.set` stored with its type
(object, list, number, boolean); a key set by another program is a text.

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
