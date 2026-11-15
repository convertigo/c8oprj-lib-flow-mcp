# EntityTable business screens

Read before configuring an entity list, actions, paging or columns.

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

`orderBy="dateEcheance" direction="asc"` sets the initial server sort; headers
remain sortable. Identity refresh restores it; changing either property resets
paging and selection. For a due queue, counter and alert contract, read
`flow://guide/entities-widgets/deadlines`.

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
from Toolbar, as in `flow://guide/multipage-entities/operations`.
