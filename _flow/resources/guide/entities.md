# Interpreted Flow Entities

Declare business data once, validate and revision its model with MCP, then use entity blocks and schema-driven EntityTable and EntityForm widgets.

Read `flow://guide/multipage-entities` for the ordered application recipe.
The target project references `lib_flow_entity`, the SQL and CRUD data libraries,
and the Svelte frontbuilder. Authentication uses the Flow port of
`lib_UserManager`; account selectors and client-supplied roles do not establish
an identity. Read each available contract with `flow-block-get` before use.

## Model authoring without generated code

1. `flow-entity-model-get({project})` returns the model, its canonical path and
   revision. `revision:"missing"` means first creation.
2. `flow-entity-model-check({project,model})` runs validation without writing.
   Inspect `valid` and every diagnostic's `code`, `path`, `severity` and
   `message`. This verifies declarations, not a live database or user session.
3. `flow-entity-model-set({project,model,expectedRevision})` checks the same
   model and writes only with the revision just read. A stale revision is a
   conflict: read again, reconcile the change and check before retrying.
   An invalid declaration never replaces the stored model.

The model is JSON data, including literal strings containing braces. It is not
FlowScript. Entity operations interpret it; this tool creates neither CRUD
Flows nor pages. Keep project-specific validation and side effects as ordinary
Flow hooks. SQL initialization is explicit and preserves existing data.

```json
{"version":2,"modelVersion":1,"entities":{"Equipement":{"label":"Equipment","display":{"title":"libelle"},"permissions":{"read":["USER","ADMIN"],"create":["USER","ADMIN"],"update":["USER","ADMIN"],"delete":["ADMIN"]},"traits":["Activable","Horodaté","Révisé"],"fields":{"libelle":{"type":"string","maxLength":120},"dateDerniereVerification":{"type":"date","notFuture":true}}}}}
```

For ownership and responsible-person pickers, declare `imports: {userManager:
"lib_UserManager"}` and a local read-only `Utilisateur` entity with
`extends:"userManager.User"`, rather than copying its SQL table. Read the installed entity and user
manager contracts for the exact identity type, directory adapter and allowed
roles. Never store a password, reset token or authentication secret in the
business model, frontend source, journal or tool output.

## Reusable widgets and named snippets

Find `EntityTable` and `EntityForm` with `authoring-palette` under the qualified
Structure parent returned by `authoring-tree`. Execute `items[].apply` unchanged.
Both are library widgets. Their inputs remain model driven; a page supplies the
entity name, transport configuration and selection/event bindings supported by
the installed widget contract. Do not copy their implementations into a page.

Table slots: `toolbar`, `actions`, `empty`, and `cell`.
Form slots: `actions` and `field`. Read their context bindings from the installed
component descriptor before wiring a custom field value or change action.
Native Svelte callers may also pass `cell_<field>` or `field_<field>` snippets,
for example `cell_libelle` or `field_noteInterne`. These dynamic overrides are
not advertised as wildcard palette slots. The static `Cell` and `Field` slots
keep the Flow palette editable without inventing angle-bracket field names.
Preserve all other slots during an edit.

The server removes hidden fields and enforces ownership, permissions and
revision checks. Hiding an action or a management link is only presentation.
Test anonymous, ordinary-user and administrator sessions over HTTP, then test
the pages. A page loading or a successful model write is not that proof.
