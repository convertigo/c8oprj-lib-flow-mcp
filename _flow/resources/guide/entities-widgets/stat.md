# EntityStat and EntityBreakdown

Read for dashboard counts, sums and grouped breakdowns.

## Counters for dashboards

`EntityStat` shows in a StatCard the number of rows the session sees, with one
`count` request through the gateway (policy, scope and filter as EntityTable),
without listing rows or writing a Flow. Search the palette for **compteur**.
`sum="amount"` (or `avg`) totals an int64 or decimal field instead, in one
`aggregate` request (field listed in `gateway.aggregate`; in a Flow,
`entity.aggregate({entity, checkAccess: true, sum: "amount", options})` gives
`{count, sum}`); `currency="USD"` shows an amount, as a model field `currency` does.

```svelte
<script module>export const _flow = { sourceVersion: 2, page: { id: "myPosts" } };</script>
<FlowComponent $$id="myPosts"><Variables><State $$id="refresh" type="number" value={0} /></Variables><Structure>
  <GridLayout $$id="kpis" minColumnWidth="180px"><Children>
    <EntityStat $$id="assigned" entity="Poste" label="Postes affectés" tone="primary" refreshKey="@page.refresh" />
    <EntityStat $$id="due" entity="Poste" label="À relancer" tone="warning" filter={{statut:"aRelancer"}} refreshKey="@page.refresh" />
  </Children></GridLayout>
</Structure></FlowComponent>
```

`filter`, `active` and `search` take the list forms; `page` links the card to
the page of the counted list. The figure is the count of rows **this session
sees**, not an absolute total. A refused count shows `—` with the refusal; change
`refreshKey` after writes and session changes. Counting needs the gateway
(`gateway: true` in the model) and read access in `app.entityAccess`.

Counts per value (a breakdown) come in one query: `entity.aggregate({entity,
checkAccess: true, groupBy, options: {filter, active}, limit})` answers
`{groups: [{key, label, count}], hasMore}` over the rows `count` would count,
grouped by an enum, a boolean or a relation (most first; at most 200 groups,
and `hasMore` may be true at exactly 200).
A relation label is read under the target's own policy. Through the gateway a
grouped count is enabled per entity and field by the model:
`"gateway": {"aggregate": ["statut", "rpcaId"]}` (none by default).

A column "how many related rows" (the active postes of each RPCA) is an
EntityTable `counts` entry, `[{as, label, entity, via, filter, active}]`: the
server counts, for the rows of the page it read, the rows of `entity` whose
`via` holds their key, in one query under that entity's policy (the rows this
session sees). A refused count has no column, never zeros. Through the gateway,
`entity` must list `via` in its `gateway.aggregate`, and the gateway slot
`$$authorize` applies to the counted entity too. In a Flow, an unknown counted
entity is an error. `entity.list` takes the same
`options.counts` (at most 4) and answers `row.counts`.

A breakdown (counts per value: postes per RPCA, rows per status) is an
`EntityBreakdown` (search **répartition**): `entity`, `groupBy`, `filter`,
`display="cards"` or `"table"` (proportional bars), `limit` up to 50, `tones`
per key. It sends one `aggregate` request, never a list. For a bar or donut
chart, handle its `OnLoaded` and pass `@event.value.categories` and
`@event.value.series` to a `Chart` of `lib_flow_frontend_charts_svelte`.

Other figures of a dashboard: a status computed by a trait (`Échéance`) is
counted and filtered in SQL; "the oldest due first" is an EntityTable with a
`filter`, sorted on `dateEcheance` with a small `pageSize`; "the last run" is
one row ordered by date, descending. Store an immutable fact when it is
written (the number of items of a sent notice), and a job summary in its own
entity, rather than recounting them on each display.
