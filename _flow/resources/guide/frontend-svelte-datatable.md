# Flow Svelte DataTable

DataTable row cards, selection and date formats, then server pagination, filter and sort with a complete Page.

Sub-guide of `flow://guide/frontend-svelte`: read that entry guide first for the authoring loop.

## DataTable Selection And Layout

A `DataTable` keeps its row actions on the right of a wide table and, with
`layout="auto"` (the default), shows one card per row once it is narrower
than 640px; `layout="table"` keeps the table. `selectable={true}` adds row
checkboxes and a Select all checkbox; bind `selected="@page.picked"`: the
State holds the keys (`rowKey`) of the selected rows, for a bulk action
Button, and `OnSelectionChange` gives the same keys as `@event.value`
(`@event.source` row, all or none). Select all takes the filtered rows, or
the loaded page with `serverSide={true}`. A column `format` may be a date
pattern: `dd/MM/yyyy`, `EEEE d MMMM yyyy`, `dd/MM/yyyy HH:mm`.

## Server pagination with DataTable

With `serverSide={true}`, `source` is one server page, `total` is the total
number of matching rows, `offset` is its zero-based first row index, and
`pageSize` is the requested page size. The table never slices, filters or sorts
the supplied page locally. Its **OnChange** requests a new page with
`@event.value = { offset, pageSize, query, sortKey, sortDirection }`;
`sortDirection` is `asc`, `desc` or `none`. `@event.source` is `page`,
`filter`, `clear-filter` or `sort`. A filter or sort change requests offset 0.
Capture these values before calling the Flow; there is no separate OnPage
event. `OnSelectionChange` is a different event, for the selected row keys.

This complete Page expects `.ListBookings` to return `{ items, total }` and
accept `offset`, `limit`, `query`, `sortKey` and `sortDirection`. The Flow checks
the session and allowed sort keys, and applies the filter, sort and bounded
pagination on the server. The page size must fit its declared limit.

```svelte
<script module>export const _flow = { sourceVersion: 2, page: { id: "bookings" } };</script>
<FlowComponent $$id="serverBookings">
  <Variables>
    <State $$id="listing" type="object" value={{ items: [], total: 0 }} />
    <State $$id="offset" type="number" value={0} />
    <State $$id="pageSize" type="number" value={10} />
    <State $$id="query" type="string" value="" />
    <State $$id="sortKey" type="string" value="" />
    <State $$id="sortDirection" type="string" value="none" />
  </Variables>
  <Events><OnMount $$id="initialLoad"><Actions>
    <CallSequence $$id="loadInitial" requestable=".ListBookings" $$out="page.listing"><Variables>
      <Variable name="offset" value="@page.offset" /><Variable name="limit" value="@page.pageSize" />
      <Variable name="query" value="@page.query" /><Variable name="sortKey" value="@page.sortKey" />
      <Variable name="sortDirection" value="@page.sortDirection" />
    </Variables></CallSequence>
  </Actions></OnMount></Events>
  <Structure>
    <DataTable $$id="bookings" caption="Bookings" serverSide={true}
      source="@page.listing.items" total="@page.listing.total"
      offset="@page.offset" pageSize="@page.pageSize"
      columns={[{ key: "room", path: "room", label: "Room" }]}>
      <Events><OnChange $$id="pageRequest"><Actions>
        <SetValue $$id="keepOffset" target="page.offset" value="@event.value.offset" />
        <SetValue $$id="keepPageSize" target="page.pageSize" value="@event.value.pageSize" />
        <SetValue $$id="keepQuery" target="page.query" value="@event.value.query" />
        <SetValue $$id="keepSortKey" target="page.sortKey" value="@event.value.sortKey" />
        <SetValue $$id="keepSortDirection" target="page.sortDirection" value="@event.value.sortDirection" />
        <CallSequence $$id="loadPage" requestable=".ListBookings" $$out="page.listing"><Variables>
          <Variable name="offset" value="@page.offset" /><Variable name="limit" value="@page.pageSize" />
          <Variable name="query" value="@page.query" /><Variable name="sortKey" value="@page.sortKey" />
          <Variable name="sortDirection" value="@page.sortDirection" />
        </Variables></CallSequence>
      </Actions></OnChange></Events>
    </DataTable>
  </Structure>
</FlowComponent>
```
