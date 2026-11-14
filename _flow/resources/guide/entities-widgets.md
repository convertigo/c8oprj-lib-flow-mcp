# Flow Entities: Reusable Widgets And Snippets

Schema-driven CRUD: EntityTable, EntityForm, EntityView, EntityStat counters, column slots and inverse lists.

Sub-guide of `flow://guide/entities`: read that guide first.

## Reusable widgets and named snippets

Find `EntityTable`, `EntityForm` and `EntityView` with `authoring-palette` under the qualified
Structure parent returned by `authoring-tree`. Execute `items[].apply` unchanged.
These library widgets stay model driven: a page supplies the entity name and the
selection/event bindings of the installed widget contract. Omit `targetProject` to call the `EntityGateway` of the project serving
this frontend, created by `flow-entity-model-set` with `gateway: true` (hidden,
signed-in sessions). Set it only for an intentional cross-project screen: it
then selects that project's local gateway. There is no library gateway fallback.
The transport sends only `entity`, `operation`, `payload`; identity, roles,
`checkAccess` and the policy scope always stay on the server. Do not copy their
implementations into a page. Declare the application locale once in the root
source, for example `_flow.app.locale:"fr-FR"`; the
frontbuilder passes it to the widgets. Their default spacing and controls use
the shared Flow theme tokens, without application CSS.

`EntityTable` exposes `select`; `EntityForm` exposes `saved`, `deleted` and `cancel`.
Handle them with ordinary `Events` / `OnSelect`, `OnSaved`, `OnDeleted` actions:
`@event.value` is the selected row, saved row or deletion result. Keep the row
in page state and bind it to `EntityForm.row`. After save or deletion, clear the
selection, close the editor, and increment the table's `refreshKey` state with `UpdateNumber`
(`operation:"increment"`, `step:1`) to reload its current page. A New command
clears the row and opens the creation form. Put it in the table
`Toolbar` and show it only when `context.permissions.create` is true.
On `OnCancel`, close the editor and clear its row.
Use the conflict reload command before retrying a stale revision; do not blindly
resubmit the stale row. Effective `describe` capabilities hide denied save/delete actions,
immutable-row updates included. The form sends `create` without a key and `update` with
an existing key; it never performs an upsert. A refusal answers 200 with `ok: false`: `ENTITY_UNAUTHENTICATED` invites sign-in,
`ENTITY_FORBIDDEN` or `ENTITY_SCOPE_VIOLATION` reports a forbidden action, 409 offers Reload, and 400 maps field diagnostics when
available (model validation can also use 422).

The table's optional `ownershipFilter="mine"` is only an additional display
filter. It replaces the ambiguous widget prop name `scope`; the policy's typed
`scope` is an independent server constraint, always ANDed with client filters.

```svelte
<script module>export const _flow = { sourceVersion: 2 };</script>
<FlowComponent $$id="selectionExample">
  <Variables><State $$id="row" type="object" value={null} /></Variables>
  <Structure>
    <EntityTable $$id="books" entity="Book">
      <Events><OnSelect $$id="selected"><Actions>
        <SetValue $$id="keepRow" target="page.row" value="@event.value" />
      </Actions></OnSelect></Events>
    </EntityTable>
    <EntityForm $$id="edit" entity="Book" row="@page.row" />
  </Structure>
</FlowComponent>
```

Named snippet parameters are lexical sources, with the schema declared in the
component descriptor; they appear in pickers and are preserved by source edits:

| Widget slot | Parameters in order |
| --- | --- |
| table `cell` | `row`, `field` |
| table `actions` | `row`, `context` |
| table `toolbar` | `context` |
| table `empty` | none |
| form `field` | `field`, `value`, `set`, `error` |
| form `actions` | `context` |

Use `<Cell><Text text="@row.values.libelle" /></Cell>` for a row field and
`@field.label` for the declared field's label. A generic cell override should
use the current field, rather than rendering the same field in every column.
The `set` argument is a callback value for a native input component's declared
setter property; it is not a FlowScript function call. Pass it unchanged as
`@set` to a compatible component and keep `@value` and `@error` alongside it.
Do not introduce an inline browser script to run it. Read the installed input
component contract before replacing the default field renderer.

For a single DSL column set `columns={[{path:"libelle",cellSlot:"cell2"},{path:"statut"}]}`
and use `<Cell2><Text text="@row.values.libelle" /></Cell2>` (with ordinary
`$$id` values). Other columns keep their renderer; `Cell3`/`Cell4` are also
static slots. The generic `Cell` remains a global override for compatibility.

Native Svelte callers can also pass `cell_<field>` / `field_<field>` overrides,
for example `cell_libelle` and `field_noteInterne`. These are concrete names,
not angle-bracket wildcard slots. Preserve all other slots during an edit.

With checkAccess:true, the server removes hidden fields and enforces scope, optional ACLs and
revision checks. Hiding an action or a management link is only presentation.
Test anonymous, ordinary-user and administrator sessions over HTTP, then test
the pages. A page loading or a successful model write is not that proof.


## Tables for business screens

Columns default to visible `describe` fields; override with ordered `columns`
entries `{path,label,format,labels,tones,order,cellSlot}`. Fields removed by the
server cannot be restored. An explicit column may include `table:false`
computed fields, for example `dateEcheance` from the `Échéance` trait.
Enum values in the model may be strings or `{value,label,tone}`. Stored values
stay strings; `describe` adds label/tone maps and `timeZone`. Dates use
`dd/MM/yyyy`; table and record view share formatting. A timestamp without an
offset is already local time in the model's zone.

Use `filters={[{field:"statut"},{field:"rpcaId"},{field:"actif"}]}` for enum,
searchable relation and boolean controls; dates and text also work. An optional
base `filter` is ANDed with all controls on the server. Admin lists offering
inactive rows set `active="all"`; neither control grants that access. Search,
sort and pagination are server operations, and ordinary page/sort changes keep
the previous page visible while controls are disabled. `refreshKey` clears old
identity data: change it after a session change as well as after a write.
`caption` names the table (its accessible name and title; the entity label by
default): a heading above the table does not name it.

Default View/Edit actions raise `OnView`/`OnEdit`, plus compatible `OnSelect`.
Wire them to an editor/record view, or set `viewPage`/`editPage` to the logical
page id. Dynamic route parameters come from `row.key`; `[id]` also aliases the single
identity field when its model name differs. There, `EntityForm` and `EntityView`
take `routeId="@route.params.id"`. Activation sends only
key, revision and the active-field change through the gateway. Its rule must
live in a model hook, not only in a calling Flow. An `Actions` slot replaces
defaults, including in read-only sessions where it may offer View.

`selectable` plus `bulkActions={[{id:"declare",label:"Déclarer"}]}` raises
`OnBulkAction` with `{action,keys}`; `OnSelectionChange` and bindable `selected`
expose the array of exact object keys. Keep it as an array in page state when
opening a local form. Typed URL arrays belong to the separate route change;
never count the characters of a serialized query parameter. Every business
command must authorize every key on the server. `exportable` downloads the
formatted current page only; complete exports use a checked server command
from Toolbar, as in `flow://guide/multipage-entities-pages`.

## Forms for business screens

`EntityForm` edits by field type: `text` is a multi-line area, `int64` and
`decimal` numeric inputs, an `enum` a list of its model labels with an empty
choice, a relation a list searched on the server when one page of options is
not enough (the current choice keeps its label). `fields` orders and selects
the shown fields (names or `{name, label, visibleWhen}`), and only they are
sent; `sections` groups them as `[{label, fields}]`. `visibleWhen:
{field, equals | in | notEmpty}` shows a field only for that value, and a
hidden field is not sent. `readOnly` forces consultation; it is presentation,
not authorization. Deletion asks a confirmation click (`confirmDelete:
false` removes it). Commands follow `locale` (`labels` overrides them).
`defaults={{status: "AVAILABLE"}}` gives the initial values of a creation.
Never add a model `default` to an existing field for that: the model write refuses it.
Business rules stay in the model hooks: a hidden or absent field is never a
server check.

## Business Flows as the source

When writes carry business rules, give the widgets `flows` instead of the gateway:
`{describe, list, read, count, aggregate, create, update, delete}` name project
Flows called with the payload of that gateway operation (`{options}`, `{key,
options}`, `{values}`, `{key, revision, values}`, `{key, revision}`) and answering
as it does. An operation without a Flow is unavailable: a widget never falls back
on the gateway, and an inverse list of EntityView needs its own `flows`. Each Flow
is `hidden`, checks the session, and only passes the options on:
`return entity.list({entity: "Poste", checkAccess: true, options: input.options})`
(`entity.save` with `key`, `revision`, `values`; never an actor or an owner from
the input). In the same change, close the gateway for these writes with
`"gateway": {"writes": false}` on the entity; `code-check` says
`ENTITY_GATEWAY_WRITES_OPEN` otherwise. Not calling the gateway never closes it:
any client can still call it. So a read restriction lives in the access policy
(or `visibleTo`), never only in a list Flow, which formats and does not narrow.

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

## A record by route, sections and inverse history

Create the route `postes/[id]` and bind its parameter directly:

```svelte
<script module>export const _flow = { sourceVersion: 2, page: { id: "postView" } };</script>
<FlowComponent $$id="postView"><Structure>
  <EntityView $$id="post" entity="Poste" routeId="@route.params.id"
    sections={[{label:"Identification",fields:["libelle","rpcaId"]},{label:"Suivi",fields:["dateEcheance","statut"]}]}
    related={[{entity:"Declaration",field:"posteId",label:"Historique",columns:[{path:"date",format:"dd/MM/yyyy"},{path:"commentaire"}]}]} />
</Structure></FlowComponent>
```

A selected `row` or an exact `recordKey` also works. Composite identities need
`recordKey`. The widget always re-reads the record; parent row values are never
authorization evidence. `active` defaults to active rows; admin histories may
request all when the server policy permits it. `OnEdit` should open EntityForm;
`OnChanged` reports activation. `Actions(row,context)` replaces its defaults.
A section field can use `cellSlot:"field2"` with `Field2(row,field)`; Field3 and
Field4 also exist. `Field` is the compatible global override.

Each `related` declaration adds the parent's key to the child's server filter,
then ANDs an optional extra `filter`. A missing parent value never starts an
unfiltered list. `sourceField` can name another visible parent field. Each
inverse entity applies its own policy. Options include `columns`, `filters`,
`pageSize`, `active`, `viewPage`, `editPage`, and `slot` selecting Related or
Related2 for a custom list. Wire page actions for linked records as needed.

The six verified integration page sources are shipped by lib_flow_entity at
`_flow/resources/examples/entity-front`. They cover posts, RPCA, history,
notifications and a bulk declaration form. Authoritative counters and the
DeclarePosts command remain application services; displaying a returned count
does not compute or validate it. This kit does not implement E5 listFlow/saveFlow,
and never falls back to a different source after failure.

Compatibility: the hard-coded deadline status control becomes explicit
`filters={[{field:"statut"}]}`. Private table CSS selectors change to DataTable. Native deadline label aliases
`labels.current`/`labels.overdue` move to the status column labels
(`aJour`/`aRelancer`).
Existing EntityTable props, OnSelect and the generic Cell/Actions slots, and
EntityForm save/delete/cancel events, remain supported.
