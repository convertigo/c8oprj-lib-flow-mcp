# Direct SQL application pages

Read to build distinct pages and export the same scoped list.

## 4. Build distinct pages

Create the target pages before the links: home/sign-in, my bookings,
management and journal. The root Layout is an `AppShell`: its `Navigation`
holds a `LinkButton` per page, its `Tools` the user and the logout, its
content `PageContent`. Each page starts with a `PageHeader`, checks the
session before loading its data and lists its records in a `DataTable` (or
the DataGrid below), statuses as badges. Management links are visible to the
manager only; the server always applies the same check.

Show the loading, empty and error states with the standard components and
`Status` (a toast for a success, no message for a load). After `CallSequence`, use the declared results and palette actions; a
user chain must continue even if its panel disappears. Refresh the session of
the Layout after a navigation: a Layout stays mounted across child pages, so
`OnMount` does not rerun after sign-in. In `src/routes/+layout.flow.svelte`:

```svelte
<script module>export const _flow = { sourceVersion: 2 };</script>
<FlowComponent $$id="sessionLayout">
  <Variables><State $$id="session" type="object" value={{ authenticated: false, user: null }} /></Variables>
  <Events><OnAfterNavigate $$id="refreshSession"><Actions>
    <CallSequence $$id="loadSession" requestable=".CurrentUser" $$out="layout.session" />
  </Actions></OnAfterNavigate></Events>
  <Structure>
    <AppShell $$id="shell" title="Bookings" userName={layout.session.user?.firstName ?? ""}>
      <Children><PageContent $$id="content" /></Children>
    </AppShell>
  </Structure>
</FlowComponent>
```

The public `.CurrentUser` answers `{ authenticated: false, user: null }` for
an anonymous session and `{ authenticated: true, user: { firstName, role } }`
for an active account. Show manager links with
`test={layout.session.user?.role === "MANAGER"}`. Keep redirects to login out
of this `OnAfterNavigate`: navigate in the successful sign-in/sign-out chain
or guard the protected page separately, otherwise each navigation may send
the user back to login. A group shell in `(app)/+layout.flow.svelte` applies
only to `(app)` pages; keep the login page outside the group if it needs no
shell. `flow://guide/frontend-svelte/datatable` also gives the DataTable server paging
chain (`OnChange`, `@event.value.offset`, then `CallSequence`).

Do not take an HTTP 200 of the route as proof
that the grid is filled.

Adapt a Resource/Page response with `dataUi.gridPage`, then bind its columns and
rows to the DataGrid. A client dataset must be explicitly complete and bounded;
beyond that, return a limit error rather than a truncated list presented as
complete. The `filterOps` and `sortable` metadata must reflect only the filters
and sorts that the server accepts.

### Role labels and row actions

Compare roles explicitly: `role === "LIBRARIAN"`. Testing `@page.role`
alone accepts any non-empty role, including `"MEMBER"`.

For a loan page, let the protected `.LibraryPage` Flow read the current
account into `local.user` and the permitted books and loans into
`local.catalog`. The server filters loans by that account; the browser supplies
neither role nor owner. Finish the Flow with this FlowScript v3 projection:

```javascript
const books = list.map({
  items: local.catalog.books,
  select: {
    id: current.id,
    title: current.title,
    available: current.available,
    canBorrow: current.available && local.user.role === "MEMBER",
  },
})
return { role: local.user.role, books, loans: local.catalog.loans }
```

`available` is a boolean. `DataTable.rowActions[].when` reads a path in
each row, not a role expression. Return `canBorrow` with each book;
`when:"available"` would expose borrowing to a librarian. Bind the result:

```svelte
<script module>export const _flow = { sourceVersion: 2 };</script>
<FlowComponent $$id="libraryPage">
  <Variables><State $$id="library" type="object" value={{ role: "", books: [], loans: [] }} /></Variables>
  <Events><OnMount $$id="init"><Actions>
    <CallSequence $$id="loadLibrary" requestable=".LibraryPage" $$out="page.library" />
  </Actions></OnMount></Events>
  <Structure>
    <PageHeader $$id="header" title="Prêts" />
    <DataTable $$id="loans" source="@page.library.loans"
      caption={page.library.role === "LIBRARIAN" ? "Tous les prêts" : "Mes prêts"}
      columns={[{ path: "title", label: "Livre" }]} />
    <DataTable $$id="books" caption="Catalogue" source="@page.library.books"
      columns={[{ path: "title", label: "Livre" }]}
      rowActions={[{ id: "borrow", label: "Emprunter", when: "canBorrow" }]}>
      <Events><OnClick $$id="borrowClick"><Actions>
        <CallSequence $$id="borrow" requestable=".BorrowBook">
          <Variables><Variable name="bookId" value="@event.value.row.id" /></Variables>
        </CallSequence>
        <CallSequence $$id="reloadLibrary" requestable=".LibraryPage" $$out="page.library" />
      </Actions></OnClick></Events>
    </DataTable>
    <Status $$id="borrowStatus" actionId="borrow" />
  </Structure>
</FlowComponent>
```

The caption compares the role. The action sends only the selected book id;
`.BorrowBook` reads the session and checks role, availability and loan limit
again before writing. A hidden button is not authorization. A refusal stops
the chain and appears in `Status`; success reloads the rows. Prove both roles
with available and unavailable books, then a member at the loan limit with an
available book: show the refusal and confirm that loans remain unchanged.

## 5. Export the same list

Also read `flow://lib/lib_flow_frontend_data_svelte/csv`. The DataGrid in
server export mode produces a snapshot of its filters, sort and columns. Chain
`DataUiGridExportRequest`, `CallSequence` and `FileDownload`; from a plain
button, `CallSequence` then `FileDownload` (`flow://guide/crud`, CSV export). Use the
`filterJson` and `columnsJson` variants at HTTP boundaries when needed; parse
then validate them on the server.

The export facade reuses the access check and the filtered read; the paging of
the screen does not reduce the export. Use `data.exportCsv` for a data source:
it reads every page with the same filter and sort. Use `data.csv` for rows that
are already complete: rows computed by the Flow as flat objects with typed
`columns` (`{ field, header, type }`; type `string` by default, `integer`,
`decimal`, `boolean`, `date` or `date-time`) and no `resource`, or the
`{ key, values }` rows of `data.read` with their `resource`. Do not write a CSV
encoder by hand; `flow-block-get` for `data.csv` gives its contract. Set a
bound on rows and bytes.
A French CSV uses `;`, UTF-8 with a BOM and `dd/MM/yyyy`, with formula
neutralization. A `.bin` facade uses `file.respond` for `Content-Type` and
`Content-Disposition`. Also test its errors and its anonymous refusal.
