# EntityView record pages

Read for a route record, sections and related history.

## A record by route, sections and inverse history

Create the route `dossiers/[id]` and bind its parameter directly:

```svelte
<script module>export const _flow = { sourceVersion: 2, page: { id: "dossierView" } };</script>
<FlowComponent $$id="dossierView"><Structure>
  <EntityView $$id="dossier" entity="Dossier" routeId="@route.params.id"
    sections={[{label:"Identification",fields:["libelle","responsableId"]},{label:"Suivi",fields:["dateEcheance","statut"]}]}
    related={[{entity:"Declaration",field:"dossierId",label:"Historique",columns:[{path:"date",format:"dd/MM/yyyy"},{path:"commentaire"}]}]} />
</Structure></FlowComponent>
```

A selected `row` or an exact `recordKey` also works. Composite identities need
`recordKey`. The widget always re-reads the record; parent row values are never
authorization evidence. `active` defaults to active rows; admin histories may
request all when the server policy permits it. `OnEdit` should open EntityForm;
the default Edit is shown only when `OnEdit` is bound. `OnChanged` reports
activation. `Actions(row,context)` replaces its defaults; an empty
`<Actions></Actions>` is dropped and keeps them.
A section field can use `cellSlot:"field2"` with `Field2(row,field)`; Field3 and
Field4 also exist. `Field` is the compatible global override.

Each `related` declaration adds the parent's key to the child's server filter,
then ANDs an optional extra `filter`. A missing parent value never starts an
unfiltered list. `sourceField` can name another visible parent field. Each
inverse entity applies its own policy. Options include `columns`, `filters`,
`pageSize`, `active`, `viewPage`, `editPage`, and `slot` selecting Related or
Related2 for a custom list. Wire page actions for linked records as needed.

The six verified integration page sources are shipped by lib_flow_entity at
`_flow/resources/examples/entity-front`. They cover dossiers, responsible users, history,
notifications and a bulk declaration form. Authoritative counters and the
DeclareDossiers command remain application services; displaying a returned count
does not compute or validate it. This kit does not implement E5 listFlow/saveFlow,
and never falls back to a different source after failure.

Compatibility: the hard-coded deadline status control becomes explicit
`filters={[{field:"statut"}]}`. Private table CSS selectors change to DataTable. Native deadline label aliases
`labels.current`/`labels.overdue` move to the status column labels
(`aJour`/`aRelancer`).
Existing EntityTable props, OnSelect and the generic Cell/Actions slots, and
EntityForm save/delete/cancel events, remain supported.
