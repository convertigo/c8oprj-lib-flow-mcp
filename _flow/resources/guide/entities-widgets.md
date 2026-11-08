# Flow Entities: Reusable Widgets And Snippets

Schema-driven entity widgets (EntityTable, EntityForm) and named snippets.

Sub-guide of `flow://guide/entities`: read that guide first.

## Reusable widgets and named snippets

Find `EntityTable` and `EntityForm` with `authoring-palette` under the qualified
Structure parent returned by `authoring-tree`. Execute `items[].apply` unchanged.
Both are library widgets. Their inputs remain model driven; a page supplies the
entity name and selection/event bindings supported by the installed widget
contract. Omit `targetProject` to call the public `EntityGateway` of the project
serving this frontend. Set it only for an intentional cross-project screen: it
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
Handle `OnCancel` by closing the editor and clearing its row as well.
Use the conflict reload command before retrying a stale revision; do not blindly
resubmit the stale row. Effective `describe` capabilities hide denied save/delete
actions, including
immutable-row updates. The form sends `create` without a key and `update` with
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
    <EntityTable $$id="equipment" entity="Equipement">
      <Events><OnSelect $$id="selected"><Actions>
        <SetValue $$id="keepRow" target="page.row" value="@event.value" />
      </Actions></OnSelect></Events>
    </EntityTable>
    <EntityForm $$id="edit" entity="Equipement" row="@page.row" />
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

Native Svelte callers can also pass `cell_<field>` / `field_<field>` overrides,
for example `cell_libelle` and `field_noteInterne`. These are concrete names,
not angle-bracket wildcard slots. Preserve all other slots during an edit.

With checkAccess:true, the server removes hidden fields and enforces scope, optional ACLs and
revision checks. Hiding an action or a management link is only presentation.
Test anonymous, ordinary-user and administrator sessions over HTTP, then test
the pages. A page loading or a successful model write is not that proof.
