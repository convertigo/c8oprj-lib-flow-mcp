# Flow Multi-Page Application with Roles

Ordered recipe for a multi-page Flow application with a session, roles, a server-side data perimeter, a CSV export, a scheduled job and an audit journal.

This recipe builds a small room-booking application: a user sees their own
bookings; a manager sees every booking and the journal. Its demonstration
sign-in is disabled by default.

## 1. Prepare the contracts

Read `flow://guide/start`, `flow://guide/authoring` and
`flow://guide/frontend-svelte`. Add the references that `flow-catalog`
proposes: `lib_flow_sql`, `lib_flow_crud_data`, `lib_flow_frontend_data_svelte`
and the Svelte frontbuilder. Read `flow://lib/lib_flow_sql/sql` for the
configuration and `flow://lib/lib_flow_crud_data/csv` for the export. Inspect
the real contracts before writing the calls; an available catalog does not
prove that a connection is configured.

Create the schema, the demonstration data and the server Flows first, then the
pages. Declare typed parameters; `int64` identifiers stay strings. Declare
`items: {type:"object"}` for an array of objects. Platform symbols belong to
the configuration, with demonstration values disabled by default; no secret in
the source, the outputs or the logs.

## 2. Set up the data and the session

Configure `config.sql.connections`, the separate schema and data, then call
`sql.initialize`. HSQLDB is a development database: its path is relative to
the project, under `_flow/resources/sql/`, outside `_private`, protected by
`.httpignore`. A CAR replaces this database; use an external DBMS in
production. Ignore in Git the database files that tests create. A replayed
initialization must keep the user's writes; a reset stays explicit and
reserved for the demonstration.

In production, call a real authentication provider, for example the Flows of
`lib_UserManager`. `session.authenticate` establishes an identity; it does not
check a password. An Alice/Bob/Manager picker is acceptable only behind a
demonstration configuration, never as a production sign-in screen.

Create a `CurrentUser` Flow that reads `session.authenticatedUser`, looks the
account up on the server, checks that it is active and returns its role. Take
neither the identity nor the role from the page. Refuse a missing session
(`UNAUTHENTICATED`, 401) or a disabled or unauthorized account (`FORBIDDEN`,
403). A public session-check Flow may answer `{authenticated:false}` normally
for the anonymous home page. To sign out, call `session.authenticate({user:""})`,
clear the displayed state and disable the automatic replay of credentials; the
cookie must no longer authorize a protected read. In its `CallSequence`, pass a
`Variable` named `__disableAutologin` with `value={true}`: otherwise the SDK
may replay the sign-in instead of completing the sign-out.

## 3. Enforce the perimeter on the server

Declare the facades that pages call with `_flow.accessibility:"hidden"` and
`authenticatedContextRequired:true`. `hidden` hides discovery but does not
forbid HTTP; `private` is for internal calls. Write these names in lowercase in
FlowScript. Keep the initializations and the scheduled job private.

For each read or write, call `CurrentUser` again. The server chooses `ownerId`
and the rights. In a named read, join the mandatory perimeter to the optional
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

## 4. Build distinct pages

Create the target pages before the links: home/sign-in, my bookings,
management and journal. A Layout carries the navigation and `PageContent`. Each
page checks the session before loading its data. Management links are visible
to the manager only; the server always applies the same check.

Show the loading, empty and error states with the standard components and
`Status`. After `CallSequence`, use the declared results and palette actions; a
user chain must continue even if its panel disappears. Refresh the session of
the Layout after a navigation. Do not take an HTTP 200 of the route as proof
that the grid is filled.

Adapt a Resource/Page response with `dataUi.gridPage`, then bind its columns and
rows to the DataGrid. A client dataset must be explicitly complete and bounded;
beyond that, return a limit error rather than a truncated list presented as
complete. The `filterOps` and `sortable` metadata must reflect only the filters
and sorts that the server accepts.

## 5. Export the same list

Also read `flow://lib/lib_flow_frontend_data_svelte/csv`. The DataGrid in
server export mode produces a snapshot of its filters, sort and columns. Chain
`DataUiGridExportRequest`, `CallSequence` and `FileDownload`. Use the
`filterJson` and `columnsJson` variants at HTTP boundaries when needed; parse
then validate them on the server.

The export facade reuses the access check and the filtered read; the paging of
the screen does not reduce the export. Use `data.csv` for rows that are already
complete, or `data.exportCsv` for a data source. Set a bound on rows and bytes.
A French CSV uses `;`, UTF-8 with a BOM and `dd/MM/yyyy`, with formula
neutralization. A `.bin` facade uses `file.respond` for `Content-Type` and
`Content-Disposition`. Also test its errors and its anonymous refusal.

## 6. Schedule and trace

A standalone job does not depend on a browser cookie. It calls a dedicated,
bounded private Flow that checks its configuration, uses
`date.today`/`date.add` in the chosen time zone and returns a countable result.
Inspect `scheduler-list`, then create the job with the relayed
`scheduler-apply`; keep a name specific to the project. Test a real run and its
idempotence before enabling a regular schedule.

In a demonstration, record a `SIMULATED` notification and a journal entry in
the same `sql.transaction`, with a unique replay key. Do not claim that a
message was sent. For a real sending, use `email.send` and the platform SMTP;
start with a capture server. Never log a password, a token or a sensitive body.
The persistent journal holds the actor, the operation, the object and the date;
its access is checked on the server. A journal entry written after a mutation is
not atomic with it: use a transaction when that guarantee is needed.

## 7. Prove the path

Test the dates and the contracts in private test Flows. For HTTP, open a
session and keep its cookie in a separate jar for Alice, Bob and the manager; a
sign-in through `code-run` does not prove the session of the next HTTP call.
Check: anonymous access refused, data partitioned, forged identity ignored,
another user's mutation refused, revoked role read again, stale revision,
invalid filter or sort, CSV identical to the filtered list, job replayed without
duplicates, journal, and sign-out with the old cookie unusable.

Finally open the viewer, navigate with each role, and check the visible rows,
the network calls and the downloaded file. After each MCP tool, read
`result.error`, its code and its message before retrying. `FLOW_INPUT_REQUIRED`
and `FLOW_INPUT_TYPE_INVALID` point to an input contract;
`FLOW_CODE_UNSAVED_WORKING_COPY` asks to resume from the given revision. Keep
tests and sources in Git, without runtime data or secrets.
