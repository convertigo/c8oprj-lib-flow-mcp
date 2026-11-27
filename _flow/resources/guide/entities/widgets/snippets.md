# Entity widget snippets

Read for widget contracts, slots and named snippets.

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
Check the Flow results for anonymous, ordinary-user and administrator access. For each signed-in
call, run the app's login Flow in `before` on the relayed `requestable-execute`, or reuse the
`c8o call --as <name>` session opened by that login Flow. Then test the pages in the browser.
A page loading or a successful model write is not that proof.
