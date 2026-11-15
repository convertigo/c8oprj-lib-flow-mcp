# Flow Entities: Widgets

Choose the entity widget before writing an entity-backed page.

For a model entity served through the application's `EntityGateway` (`gateway: true`), use `EntityTable` for a list, `EntityForm` for create/edit, `EntityView` for one record, `EntityStat` for a policy-aware count, sum or average, and `EntityBreakdown` for counts or measures grouped by a field. Both accept combined filters and calendar periods. Use `DataTable`, `Form` or `StatCard` for data that is not a Flow entity or when an entity widget cannot meet the page contract. Do not rebuild gateway access policy, paging or validation in a page. Read the exact widget drawer before configuring it.

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

## Drawers

- `flow://guide/entities-widgets/table` — open for EntityTable lists, columns, toolbar actions and paging.
- `flow://guide/entities-widgets/form` — open for EntityForm fields, create/edit and validation.
- `flow://guide/entities-widgets/view` — open for EntityView record routes and inverse history.
- `flow://guide/entities-widgets/stat` — open for EntityStat and EntityBreakdown dashboards.
- `flow://guide/entities-widgets/flows` — open when widgets use business operation Flows.
- `flow://guide/entities-widgets/snippets` — open for named slots and widget customization.
