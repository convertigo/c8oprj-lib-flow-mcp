# Entity lists and paging

Read when filtering, sorting or paging entity results.

## Lists: filters and pages

`entity.list` returns **one page**: `rows`, `total`, `hasMore`, `nextOffset`
(`limit` 25 by default, 200 at most). `options.filter` is ANDed with the policy
scope and takes the same short form, `{field: value}` (equalities, relations
included; an array means one of, `null` an empty value, an absent value is
`ENTITY_FILTER_INVALID`), or `{field, op, value}` with `eq`, `in`,
`contains`, `between` (`[from, to]`, bounds included), or one bound with `gt`,
`gte`, `lt`, `lte` (`null` leaves it open), grouped by `{and:[...]}` /
`{or:[...]}`. Do not use `rows`
as the whole list without checking `hasMore`: `code-set` warns
`ENTITY_LIST_PAGE_UNCHECKED`, and a run that gets a partial page without an
offset warns `ENTITY_LIST_INCOMPLETE`. The first is a heuristic on the source text:
it can miss a case (false negatives) and never proves that a list is complete.

```javascript
const page = entity.list({
  entity: "Ticket",
  checkAccess: true,
  options: { limit: 200, filter: { equipmentId: input.equipmentId } },
})
if (page.hasMore) {
  throw { code: "TOO_MANY_ROWS", message: "Narrow the filter" }
}
result.tickets = page.rows
```

An empty group is the neutral element of its operator: `{and: []}` adds no
condition and `{or: []}` matches no row (as `{field: []}` does), so a filter
built piece by piece may start from either. Both stay ANDed with the policy
scope: an empty group never reaches a row outside it. A group holds at most 12
members, 5 levels deep. For `options.active` of an `Activable` entity, see
**Inactive rows** in `flow://guide/entities/policy`.

For no filter, leave `filter` out or pass `null`. An empty object `{}` is
`ENTITY_FILTER_INVALID` (a short filter whose values were all absent becomes
`{}` once serialized), and `code-set` warns `ENTITY_FILTER_EMPTY` on a `filter`
written with `{}`: write `filter: input.status ? {status: input.status} : null`.

To page instead, pass `offset: input.offset || 0` and return `page.nextOffset`
(`null` on the last page) with the rows.
