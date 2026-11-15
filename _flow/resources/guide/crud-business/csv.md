# Generated CRUD: CSV

Read when exporting generated CRUD data as CSV through business Flows.

### CSV export

Export what the user may see by calling the generated list with
`includeResource: true` (a list answers only `page` otherwise), then `data.csv`
with its `resource` and rows (`flow-block-get` gives the `data.csv` contract):

```javascript
local.list = requestable.call({
  requestable: ".desk_tickets_list",
  input: { offset: 0, limit: 200, includeResource: true },
})
local.file = data.csv({ resource: local.list.resource, rows: local.list.page.rows, filename: "tickets.csv" })
result.file = local.file
```

A button of a page saves that file in two actions: the `CallSequence` of the
export Flow, then `FileDownload` (the `file.download` block) on its answer. A
`CallSequence` alone only receives the CSV text: nothing is saved.

```svelte
<Button $$id="exportCsv" label="Export CSV"><Events><OnClick><Actions>
  <CallSequence $$id="export" requestable=".desk_tickets_export"><Variables><Variable name="status" value="@page.status" /></Variables></CallSequence>
  <FileDownload $$id="saveCsv" content="@.desk_tickets_export.file.content" filename="@.desk_tickets_export.file.filename" mimeType="@.desk_tickets_export.file.mimeType" />
</Actions></OnClick></Events></Button>
```

In the Studio viewer, Playwright receives no `download` event for that
file (`page.waitForEvent('download')` never fires there): click, then read
the file the viewer saved in `.playwright-mcp/downloads/` of the working
directory.

A list returns at most 200 rows: call it again with the next `offset` until
`page.total`, or export a named read of your own. If `data.csv` answers
`DATA_CSV_SCHEMA_INVALID` on a `timestamp` field, your `lib_flow_crud_data`
predates timestamp export: pass flat rows (`list.map` over `page.rows`) with
typed `columns`. Serve the file from a `.bin` facade with `file.respond`
(`flow://guide/start`).
