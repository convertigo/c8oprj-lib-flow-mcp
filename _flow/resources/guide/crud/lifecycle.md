# Generated CRUD lifecycle

Read for preview, apply, proof, model evolution and limits.

## Preview, apply, prove

1. `flow-project-bootstrap({project, ui: true})` for a new project.
2. `flow-crud-upsert({project, spec, dryRun: true})`. Read `status`,
   `diagnostics` (each with `code`, `message` and, when known, `line`,
   `block`, `fix`), `names` (per entity: its Flows, pages and route),
   `references.missing` and `sql.plan.statements`.
   `blocked`: fix each error diagnostic and preview again.
3. `flow-crud-upsert({project, spec, planHash})` with the `planHash` of the
   preview. Apply adds the missing references (`lib_flow_sql`,
   `lib_flow_crud_data`, `lib_flow_frontbuilder_svelte`), writes the model to
   `_flow/data/model.yaml`, the Flows and pages, creates or migrates the
   database and seeds it. `FLOW_CRUD_PLAN_STALE`: preview again.
4. `flow-crud-proof({project})`: every generated file matches the model and
   nothing is left to apply. Then prove rights over HTTP: sign in with each
   demo account in its own cookie jar (`<prefix>_demo_login` with `user`) and
   call the Flows; an anonymous call is refused.
5. Build the pages with `frontend-svelte-action`.

Without `spec`, both tools use the stored `_flow/data/model.yaml`.

## Evolve the model

Change the model and preview again; `schemaVersion` increases by itself.
The database plan is additive: new entities, relations, and fields that are
nullable or have a `default` (`ALTER TABLE ... ADD COLUMN ... DEFAULT`). A
removed or renamed field is refused (`SQL_SCHEMA_MIGRATION_UNSUPPORTED`), and
so is a removed entity (`FLOW_CRUD_REMOVAL_UNSUPPORTED`; `generate: "data"`
drops its pages instead): add a new field and
stop using the old one. A new required field on a filled table needs a
`default`.

## Before delivery

- `flow-crud-proof` is ok, and each demo account was proven over HTTP.
- No generated screen offers an operation that a business rule forbids:
  sign in with each role and open every generated list, detail and form.

## Limits

- Roles come only from `security.principals` (or `authenticated` for every
  signed-in user when it is empty); they cannot come from `lib_UserManager`
  or another identity provider yet. Outside a demo, sign in with that
  provider and list its user names in `principals`.
- `rowPolicy` is the owner form only. For a restricted role, the generated
  list has no search or caller filter (the owner filter takes its one
  predicate), and the read hides the labels of related rows under a row
  policy.
- Keys are one generated integer; no composite or text key.
- Indexes are refused (`SQL_PORTABLE_INDEX_NOT_IMPLEMENTED`); relations are
  many-to-one only, without cycles.
- Removals and renames are not migrated.
- Generated texts follow `ui.language`: French by default, English for
  `en` and any other language, whose number and date formats still apply.
