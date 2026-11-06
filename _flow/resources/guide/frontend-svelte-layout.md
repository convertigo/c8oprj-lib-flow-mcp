# Flow Svelte Pages, Layout And Navigation

Layout containers, application blocks (AppShell, PageHeader, StatCard, DataTable, Form), navigation between Pages by id, and image assets.

Sub-guide of `flow://guide/frontend-svelte`: read that entry guide first for the authoring loop.

## Layout containers in a small page

| Widget | Purpose and useful properties |
| --- | --- |
| `PageShell` | Page frame with `maxWidth` and `padding`; owns the page's visible children. |
| `PageHeader` | One title and optional description at the top of the page. |
| `ColumnLayout` | Vertical sequence; `gap` separates children, `align` aligns them horizontally. |
| `RowLayout` | Horizontal sequence; `justify` distributes width, `align` aligns vertically, `wrap` allows another line. Use `space-between`, not `between`. |
| `GridLayout` | Repeated cards; `minColumnWidth` lets the grid choose how many columns fit. |
| `Card` | A grouped surface; put its content in `Children`. |
| `AppShell` / `PageContent` | Shared layout and page outlet; see the tested session Layout in `flow://guide/frontend-svelte-actions`. |

`Children` is a slot wrapper, not another visible container. Properties belong
to the container itself. Keep gaps in CSS lengths (`"16px"`), and get enum
values from `authoringContract`; inventing a `variant` or a CSS property name
on a widget does not create that behavior.

```svelte
<script module>export const _flow = {sourceVersion: 2};</script>
<FlowComponent $$id="layoutBasics">
  <Structure>
    <PageShell $$id="frame" maxWidth="960px" padding="24px"><Children>
      <ColumnLayout $$id="column" gap="16px"><Children>
        <PageHeader $$id="heading" title="Library" description="Available resources" />
        <RowLayout $$id="toolbar" justify="space-between" align="center"><Children>
          <Text $$id="total" text="2 resources" />
          <Button $$id="refresh" label="Refresh" variant="secondary" />
        </Children></RowLayout>
        <GridLayout $$id="cards" minColumnWidth="220px"><Children>
          <Card $$id="first"><Children><Text $$id="firstTitle" text="Guide" /></Children></Card>
          <Card $$id="second"><Children><Text $$id="secondTitle" text="Examples" /></Children></Card>
        </Children></GridLayout>
      </Children></ColumnLayout>
    </Children></PageShell>
  </Structure>
</FlowComponent>
```

## Application Structure

Give a business application its structure with the application blocks rather
than `Text`, `Card` and classes:

| Need | Block |
| --- | --- |
| Frame, in the root Layout | `AppShell`: `Navigation` (one `LinkButton page=` per Page, the current one highlighted), `Tools` (logout `Button variant="ghost" size="sm"`, `DisplayModeControl`), `Children` > `PageContent` |
| Top of a Page | `PageHeader` `title`, `description`, `eyebrow`, its commands in `Tools` |
| Title of a Page alone | `Heading level="1"` (one `<h1>`; `Heading` is level 2 by default, `Text variant="title"` is a paragraph) |
| Key figures | `GridLayout minColumnWidth="200px"` > `StatCard` `label`, `value`, `tone`, `hint`, `page` |
| Records | `DataTable`: `caption`, `columns` (`format` date, number, badge with `labels` and `tones`; `template` "{first} {last}"; `emphasis`), `rowActions`, `pageSize`, `locale`, an `emptyText` |
| Simple rows | `Table`: `caption` (its accessible name), `columns` `[{ label, path }]` or `<Columns><Column label path /></Columns>`; `header`/`field` are accepted synonyms with a `FRONTEND_PROPERTY_ALIAS` warning: write `label`/`path` |
| A status | `StatusBadge` `value` and `options` `[{ value, label, tone }]` |
| Nothing to show | `EmptyState` in the `Else` of a `ForEach` |
| Form | `Form` > `FormSection` `title`, `columns` > fields; a `RowLayout justify="flex-end"` of buttons |
| Commands | `Button` `variant`: one `primary` per area, `secondary`, `ghost`, `danger` |
| Result of a command | `Status actionId successText="Saved."` |

A Page inside an `AppShell` needs no `PageShell`: the shell owns the width
and the gutter. A `DataTable` row action with `page` and `query` (parameter to
row path) is a link; without `page` it raises `OnClick` with
`@event.value.action` and `@event.value.row`; `when` / `unless` name a row
path that shows or hides it. The table texts follow its `locale` (en, fr).

```svelte
<AppShell $$id="shell" title="Bookings" userName={layout.session.user?.firstName ?? ""}>
  <Navigation>
    <LinkButton $$id="navMine" label="My bookings" page="mine" />
    <If $$id="whenManager" test={layout.session.user?.role === "MANAGER"}><Then>
      <LinkButton $$id="navAll" label="All bookings" page="all" />
    </Then></If>
  </Navigation>
  <Tools><Button $$id="logout" label="Log out" variant="ghost" size="sm" /></Tools>
  <Children><PageContent $$id="content" /></Children>
</AppShell>
```

Load `layout.session` with the root Layout's `OnAfterNavigate` example of `flow://guide/frontend-svelte-actions`.
The optional user fields keep the anonymous first display safe.

```svelte
<PageHeader $$id="header" title="My bookings" description="Rooms you booked and their status." />
<GridLayout $$id="kpis" minColumnWidth="200px"><Children>
  <StatCard $$id="upcoming" label="Upcoming" value="@.MyBookings.upcoming" tone="primary" />
  <StatCard $$id="pending" label="To confirm" value="@.MyBookings.pending" tone="warning" />
</Children></GridLayout>
<DataTable $$id="bookings" caption="Bookings" source="@.MyBookings.items" pageSize={10}
  emptyText="No booking yet." columns={[{ path: "room", label: "Room", emphasis: true },
  { path: "day", label: "Day", format: "date" }, { path: "status", label: "Status", format: "badge",
  labels: { OK: "Confirmed", WAIT: "To confirm" }, tones: { OK: "success", WAIT: "warning" } }]}
  rowActions={[{ id: "open", label: "Open", page: "booking", query: { id: "id" } }]} />
```

## Pages And Navigation

Give each Page a stable logical id in `_flow.page.id` and navigate by that id,
never by constructing a URL:

```svelte
<Navigate $$id="openProduct" page="product">
  <Query>
    <Variable name="id" value="@item.id" />
    <Variable name="tab" value="details" />
  </Query>
</Navigate>
```

The generator resolves the Page path, checks required parameters and encodes
segments and query. `Params` fills route parameters of a `[param]` Page
(`flow://guide/frontend-svelte-routing`). The target Page reads
`@route.query.<name>` (and `@route.params.<name>`):

```svelte
<FullSyncGet $$id="readProduct" database="retailstore" docid="@route.query.id" />
```

`authoringContract.pages` from `code-get` is authoritative for ids, paths and
parameters. `Navigate.to` is an expert escape hatch for an external route.
Use a visible Button with `GoBack` and a fallback for direct entry. Static
links use `<LinkButton $$id="toProduct" label="Product" page="product" />`;
the fallback syntax `~/help` is rooted at the deployed application base,
`/help` at the web origin. When navigation follows `SetValue`,
`FullSyncGet`, `FullSyncView`, `FullSyncSync` or `CallSequence`, place
`Navigate` after that action in the same `Actions` slot.

## Assets

Import each image once with `frontend-svelte-asset-import({ project,
sourceFile, assetPath:"resources/<name>" })`. It writes inside the project's
`resources/` directory and returns the canonical `resources/...` URL; use it
unchanged in an Image property or in `app.flow.css`. Do not shell-copy files,
duplicate them under `_flow`, or edit `_private/svelte/static`. `code-check`
reports `FRONTEND_ASSET_MISSING` for an absent image; the final browser pass
must still catch 404s.

For repeated UI patterns, validate one pilot, propagate with small
revisioned patches, then check each changed source once. Do not assemble an
application with hundreds of tree mutations, and do not guess Ionic, NGX,
CSS or HTML property names.
