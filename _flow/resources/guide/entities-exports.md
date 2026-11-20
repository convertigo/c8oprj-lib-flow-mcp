# Flow Entities: Exports

Complete filtered CSV from an EntityTable, under the list policy and fixed server limits.

Use `entity.exportCsv` in an application Flow. It authorizes **each server page as
`list`** with `checkAccess:true`; session identity, model read roles, policy scope,
active state and field visibility apply. Neither `checkAccess` nor an actor is an
export input. A secret or inaccessible field cannot appear in the header or data;
asking for one answers the same generic refusal as an unknown field. As with the
list, `visibleTo` permits only the declared roles. Computed outputs keep the
model's visibility rules; Échéance reference dates must be public.

## Server Flow

The entity and ceilings are fixed in source. Forward only the query and requested
field names, never the whole HTTP input as the block properties. If a business
list Flow or an EntityGateway authorize slot adds restrictions beyond
`app.entityAccess` and model rules, apply those same restrictions here too;
the export does not run a different Flow's checks automatically.

<!-- example: entity-export-bookings -->
```javascript
const _flow = {
  sourceVersion: 3,
  accessibility: "hidden",
  authenticatedContextRequired: true,
  inputs: { options: { type: "object", default: {} }, fields: { type: "array", default: [] } },
}

function ExportBookings({ input, config, result }) {
  result.file = entity.exportCsv({
    entity: "Reservation",
    options: input.options,
    fields: input.fields,
    filename: "bookings.csv",
    maxRows: 5000,
    maxBytes: 1048576,
  })
}
```

`options` retains the list's `filter` (including AND/OR), `search`, `searchField`,
`active`, `scope`, `orderBy` and `direction`. Export starts at zero, ignoring the
screen's offset/limit and related `counts`. Pages contain at most 200 rows.
`fields` orders visible model fields; an empty array chooses all visible fields.
Values are stable scalars: relation keys, enum codes, ISO dates/timestamps and
exact int64/decimal text. Custom cell markup and related counts are not exported.

The result has `{content, filename, mimeType, rowCount, byteCount, bom, complete}`.
CSV uses semicolons, UTF-8 BOM, CRLF records and doubled quotes. Headers and cells
starting with `=`, `+`, `-`, `@` (including after whitespace), tab, CR or LF receive
an apostrophe. Numeric text is preserved exactly, including very large IDs.
Defaults: 5000 rows and 1 MiB; hard ceilings: 10000 rows and 5 MiB UTF-8, including
quoting and BOM. On overflow, `ENTITY_EXPORT_LIMIT` returns no file: narrow the
filters. The server buffers only the bounded output; this is not a background
streaming export. Paging does not guarantee a database snapshot during concurrent
writes; use a project-specific snapshot read if that guarantee is required.

## Page and download

<!-- example: entity-export-page -->
```svelte
<script module>export const _flow = { sourceVersion: 2, page: { id: "bookings" } };</script>
<FlowComponent $$id="bookings"><Structure>
  <EntityTable $$id="bookingsTable" entity="Reservation" exportFlow=".ExportBookings"
    columns={[{path:"id"},{path:"title"},{path:"starts"},{path:"ends"}]}
    filters={[{field:"starts",value:"2026-11-15"}]} />
</Structure></FlowComponent>
```

`exportFlow` shows **Export results (CSV)**. It sends `{options,fields}` using
the same combined base/control filters, search, active state and sort as the
table; pagination and selection do not narrow this export. The Flow above returns
`{file}`; the widget creates a Blob download only after success, with the server's
filename and MIME type. Errors and stale responses produce no download.
`targetProject` selects the application containing that Flow, as for other widgets.

Existing `exportable:true` remains **Export this page**, a formatted CSV of the
received page; it may coexist with `exportFlow`. A complete export needs the
server Flow above, including when the table uses custom `flows.list`.
There is no XLSX dependency in these libraries: no Excel writer or dependency is
added by this recipe. CSV opens in spreadsheets; it is not an `.xlsx` file.
