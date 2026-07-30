# Flow FullSync

Use FullSync in two explicit layers: server provisioning and client-local
actions. Do not hide either layer in YAML, raw CouchDB calls or handwritten SDK
code.

## Provision server DBOs

Call `flow-project-bootstrap({ project, ui:true })` for a blank target. Then
call `flow-fullsync-scaffold` with a structured connector, design-document and
transaction specification. Always inspect `dryRun:true` first and apply the
identical request with `dryRun:false`.

The scaffold is generic. It creates only the names, views, functions,
transactions and variables supplied by the request. It does not seed data,
replicate external databases or infer domain design documents. Applying an
unchanged request is idempotent.

After apply, continue only when both `saved:true` and `readiness.ready:true`.
When readiness fails, execute the returned `repair` call unchanged before
seeding data or starting client replication.

Treat every scaffold `warnings` entry as blocking during authoring. In
particular, never coerce a potentially multi-valued relation with
`String(doc.field)` as a view key: that creates one comma-joined key. Emit one
row per relation value so a document remains visible from every parent. Use a
native scalar key when the relation is scalar.

Keep seed initialization in ordinary Flow composition. Safe read transactions
can learn their output contract with:

```json
{
  "project": "MyProject",
  "requestable": ".mydb.ReadItem",
  "learn": true
}
```

Never use `learn:true` for a destructive transaction.

## Client FullSync blocks

The Svelte palette exposes operation-aware action blocks under an event:

```svelte
<FullSyncView
  id="readItems"
  database="mydb"
  ddoc="catalog"
  view="items"
  schemaRequestable=".mydb.ReadItems"
>
  <Variables>
    <Variable name="include_docs" value={true} />
  </Variables>
</FullSyncView>
```

- `FullSyncGet`: local document read; `docid` is a `FlowValueBinding`.
- `FullSyncView`: local design-document view; query options are Variable child
  blocks whose values are `FlowValueBinding` values.
- `FullSyncSync`: `mode` is `sync`, `pull` or `push`; progress is retained in
  runtime state under the action id.
- `FullSyncReset`: resets the local database. Set a stable migration `marker`
  so the reset runs once per browser and marker value; changing the marker
  explicitly schedules a new one-time reset.

The `database` property selects the project FullSync connector. `marker` is an
optional stable SDK marker. `schemaRequestable` records the safe server read
transaction used as schema provenance. When `flow-app-progress` reports
`schemaPending`, execute its `frontend-svelte-fullsync-schema` request unchanged
after confirming that the read is safe. The tool calls
`flow-requestable-schema`, attaches the returned schema to `outputSchema`, and
does not require the agent to copy paths or schema JSON. The picker reads this
embedded contract without repeating the expensive XSD catalog walk. Both
properties are metadata only and are never sent by the client action.
For a dynamic `FullSyncGet`, the repair reports one missing `sampleDocId`.
Supply a representative safe id and execute the repair; the tool maps it to the
server transaction input without storing it in the client action.

Do not handwrite `fs://` request strings. The frontbuilder derives the SDK
request from the operation-aware block.

## Bind FullSync results

FullSync results use the same intuitive source syntax as requestables:

```svelte
<ForEach id="rows" source="@readItems.rows" context="row">
  <Children><Text id="title" text="@row.doc.title" /></Children>
</ForEach>
```

When the schema path is unknown, use the binding/mutation returned by the
palette or `flow-app-progress` unchanged. Do not construct its internal
descriptor manually. The picker starts with a
generic CouchDB envelope and replaces/refines domain paths from the explicit
learned `outputSchema`. `flow-app-progress` reports an executable
`schemaPending` action when `schemaRequestable` is present but `outputSchema`
has not been attached.

Keep the three data shapes distinct:

| Producer | Binding root |
| --- | --- |
| Convertigo CouchDB transaction | transaction response envelope, commonly `couchdb_output` |
| Client `FullSyncView` | local result with `rows[]` |
| Client `FullSyncGet` | document fields at the result root |

Use the learned schema for exact domain paths; do not copy a server envelope
path into a client FullSync binding.

Action parameter bindings can reference requestable results, prior FullSync
results or the lexical item/index of an enclosing `ForEach`. The generated
button invocation carries the lexical iteration scope; no string interpolation
is needed.

## Read-only application order

For a read-only offline application, keep this order visible:

1. idempotently initialize or verify server data;
2. when a server migration invalidates local checkpoints or document shape,
   run `FullSyncReset` with a new marker;
3. run `FullSyncSync` in pull or sync mode and show progress/errors;
4. query local lists through `FullSyncView`;
5. read selected local documents through `FullSyncGet`;
6. validate the same view/get after browser network is disabled when safe
   offline control is exposed; otherwise report offline acceptance as
   unverified.

Server initialization must use a cheap fixed marker or manifest read as a real
short circuit. When it is valid, return before reading XML assets, parsing them
or writing documents. Do not replace that contract with unconditional bulk
upserts.

Offline reload of the whole application shell is a separate service-worker or
browser-cache concern. Local FullSync data availability alone does not imply
that the HTML/JavaScript shell is available after a cold offline reload.
