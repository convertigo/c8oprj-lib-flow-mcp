# EntityStat and EntityBreakdown

Read for dashboard counts, sums and grouped breakdowns.

## Counters for dashboards

`EntityStat` shows in a StatCard the number of rows the session sees, with one
`count` request through the gateway (policy, scope and filter as EntityTable),
without listing rows or writing a Flow. Search the palette for **compteur**.
`sum="amount"` (or `avg`) totals an `int64` or `decimal` amount field
instead, in one `aggregate` request. List the field in `gateway.aggregate`;
the gateway accepts these numeric measure fields. In a Flow,
`entity.aggregate({entity, checkAccess: true, sum: "amount", options})` gives
`{count, sum}`; `currency="USD"` shows an amount, as a model field `currency` does.

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

## Combined filters and calendar periods

Both widgets accept `period` on a **date** field, combined with `filter` by
AND. `filter` may combine several fields or nested `and`/`or` groups. The
widget produces an ordinary `between` predicate: the gateway and business
Flows receive `options.filter`, and apply their usual read policy. Every
filter, group and measure field must be visible; a hidden input cannot be
inferred with a count or a difference between periods. `gateway.aggregate`
enables a field but never makes it visible.

- `{field:"bookedOn", from:"2026-11-01", to:"2026-11-15"}` includes both days.
- `{field:"bookedOn", mode:"month", timeZone:"Europe/Paris"}` covers the whole
  current calendar month, including future dated rows.
- `{field:"bookedOn", mode:"rolling", days:30, timeZone:"Europe/Paris"}` covers
  30 calendar days including today. UTC is the default zone; 1–3660 days.

For timestamp fields, supply explicit timestamp bounds in `filter` instead;
`period` is a calendar-date convenience, not an end-of-day timestamp converter.
Periods are recomputed on refresh, not by a midnight timer.

`EntityStat compare={true}` requires `period`. It makes two requests with the
same base filters: previous calendar month for `month`, otherwise the adjacent
preceding range with the same number of days. The hint shows the previous
value; `OnLoaded` includes `previous` and `period: {current, previous}` bounds.
Either refusal clears both figures. The two reads do not share a database
snapshot. Amounts and averages stay decimal strings, including in events;
averages are rounded by SQL to six fractional places. Avoid `Number(amount)`
and client-side arithmetic on money. Currency display uses currency rounding.

`EntityBreakdown sum="amount"` or `avg="amount"` displays the measured value
per group; enable both `groupBy` and the measured field in `gateway.aggregate`.
Use `orderBy="value"`, optionally `direction="asc"`. Cards use `currency`;
table mode shows exact text without bars for measures. `OnLoaded.groups`
retains decimal strings; `series` continues to contain row counts for charts.

This example assumes a `Deal` with public `bookedOn` (date), `stage` (enum),
`site` and `amount` (decimal), and `gateway: {aggregate: [stage, amount]}`.
The application's policy decides the allowed sites and roles independently.
Increment the shared refresh state on **both** saved and deleted events and
on session changes; widgets clear old values and ignore obsolete responses.

```svelte
<script module>export const _flow = { sourceVersion: 2, page: { id: "kpiDashboard" } };</script>
<FlowComponent $$id="kpiDashboard"><Variables><State $$id="refresh" type="number" value={0} /></Variables><Structure>
  <EntityStat $$id="pipeline" entity="Deal" label="Montant ouvert" sum="amount" currency="EUR" filter={{stage:["OPEN","LATE"],site:"A"}} period={{field:"bookedOn",mode:"month",timeZone:"Europe/Paris"}} compare={true} refreshKey="@page.refresh" />
  <EntityBreakdown $$id="byStage" entity="Deal" groupBy="stage" sum="amount" currency="EUR" orderBy="value" filter={{site:"A"}} period={{field:"bookedOn",mode:"rolling",days:30,timeZone:"Europe/Paris"}} refreshKey="@page.refresh" />
  <EntityForm $$id="dealEditor" entity="Deal" fields={["bookedOn","stage","site","amount"]}><Events>
    <OnSaved><Actions><UpdateNumber $$id="refreshSaved" target="page.refresh" operation="increment" step={1} /></Actions></OnSaved>
    <OnDeleted><Actions><UpdateNumber $$id="refreshDeleted" target="page.refresh" operation="increment" step={1} /></Actions></OnDeleted>
  </Events></EntityForm>
</Structure></FlowComponent>
```
