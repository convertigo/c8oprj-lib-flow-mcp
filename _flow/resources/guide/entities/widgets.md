# Flow Entities: Widgets

Choose the entity widget before writing an entity-backed page.

For a model entity served through the application's `EntityGateway` (`gateway: true`), use `EntityTable` for a list, `EntityForm` for create/edit, `EntityView` for one record, `EntityStat` for a policy-aware count, sum or average, and `EntityBreakdown` for counts or measures grouped by a field. Both accept combined filters and calendar periods. Use `DataTable`, `Form` or `StatCard` for data that is not a Flow entity or when an entity widget cannot meet the page contract. Do not rebuild gateway access policy, paging or validation in a page. Read the exact widget drawer before configuring it.

For a dashboard **répartition par statut**, use `EntityBreakdown allValues={true}` to show every declared enum value, labelled and including zeros; read `flow://guide/entities/widgets/stat`.

For a complete filtered CSV download, read `flow://guide/entities/exports`.

Smallest entity list page (a `Book` entity exists):

```svelte
<script module>export const _flow = { sourceVersion: 2, page: { id: "books" } };</script>
<FlowComponent $$id="books"><Structure>
  <EntityTable $$id="bookList" entity="Book" />
</Structure></FlowComponent>
```

Smallest creation page (policy permits `create`):

```svelte
<script module>export const _flow = { sourceVersion: 2, page: { id: "newBook" } };</script>
<FlowComponent $$id="newBook"><Structure>
  <EntityForm $$id="bookForm" entity="Book" />
</Structure></FlowComponent>
```

The server policy decides visible rows and allowed writes. A hidden or absent field is never a server validation check. For custom operation Flows, close gateway writes in the model; a widget does not fall back to the gateway when an operation Flow is missing.

Dashboard and list: `flow://guide/entities/widgets/table` covers sidebar icons, metric icons, automatic enum tones, two-line cells, related sums and recent compact lists.
