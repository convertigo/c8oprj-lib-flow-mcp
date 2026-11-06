# Flow Generated CRUD: Generation Modes

Choose a CRUD generation mode, and keep entities with business rules out of the generic write path.

Sub-guide of `flow://guide/crud`: read that guide first.

## Choose a generation mode

| Application kind | Model |
|---|---|
| reference data / back office | `generate: "full"` (default) |
| business application, own Flows and pages | `"schema"` for the entities your Flows read and write with `data.read` / `data.write` or `sql.*`; `"data"` when a page needs the generated `list` / `read` / `options`; `"full"` only for admin reference tables |
| business workflow on generated reads | `"data"` for workflow entities, `rowPolicy` for owner perimeters, `ui.homePage` / `ui.loginPage` to business pages |

A business application uses `"schema"` or `"data"`, never `"full"` for its
business entities: the generated `list|read|save` Flows do not carry business
rules, and copying them costs more than calling the data sources directly.

- `"full"`: table, seed, sources, the Flows `list|read|count|options|save|delete`,
  pages (list, detail, form) and a shell entry.
- `"data"`: table, seed, sources `<entity>_read` / `<entity>_write`, and
  `list|read|count|options`. No page, no shell entry, no `save` / `delete`
  unless `permissions` names the roles. Business Flows own the mutations.
- `"schema"`: table, seed and sources `<entity>_read` / `<entity>_write`
  only. No Flow, no page, no shell entry, no session permission. Business
  Flows call `data.read({source:"<entity>_read", filter, orderBy, limit})`,
  `data.write({source:"<entity>_write", operation, key, revision, patch})` or
  `sql.*`: apply registers these sources and their connection in the project
  `config` of `_flow/engine.yaml` (see Call the generated Flows). `data.write`
  returns `{resource, mutation}`: the written row is under `mutation.row`, never
  at the top level (`result.row = local.created.mutation.row.values`, its key
  `local.created.mutation.key`; `mutation.row` is null after delete). A generated
  form cannot list the options of a `"schema"` entity: relate a `"full"`
  entity to it only with `ui.generate: "none"`, or make the target `"data"`.
- root `ui.generate: "none"`: no shell, sign-in, home or page at all; your
  pages call the generated Flows and `desk_session`.
- `flow-crud-upsert` previews `names[]` and `next` list the Flows each
  entity generates: read them before writing code.

Example, assets assigned to owners, with check-ins and reminders:

```json
"security": {"principals": {"ada": "member", "max": "admin"},
             "accounts": {"entity": "members", "login": "login", "active": "active"}},
"ui": {"homePage": "my_assets", "loginPage": "sign_in",
       "navigation": [{"page": "my_assets", "label": "My assets"}]},
"entities": [
 {"name": "categories", "permissions": {"list": ["member", "admin"], "read": ["member", "admin"], "save": ["admin"]}},
 {"name": "members", "generate": "data", "permissions": {"list": ["admin"], "read": ["admin"]}},
 {"name": "assets", "generate": "data", "permissions": {"list": ["member", "admin"], "read": ["member", "admin"], "count": ["member", "admin"]},
  "rowPolicy": {"field": "owner_id", "equals": "account.id", "unrestricted": ["admin"]}},
 {"name": "checkins", "generate": "data", "permissions": {"list": ["member", "admin"], "read": ["member", "admin"]},
  "rowPolicy": {"field": "member_id", "equals": "account.id", "unrestricted": ["admin"]}},
 {"name": "reminders", "generate": "data", "permissions": {"list": ["admin"], "read": ["admin"]}}]
```

(fields omitted). `categories` keeps its generated back office; check-in,
assignment and the reminder job are business Flows that write through
`checkins_write` / `assets_write`.

Switching an applied entity from `full` to `data` (or `readOnly: true`,
`ui.generate: "none"`, the demo sign-in off) is additive: a Flow the model no
longer generates stays owned and refuses every call (`GONE`, 410); a page
stays on disk, unlinked from the generated ones, and the preview reports it
released (`FLOW_CRUD_FILE_RELEASED`): delete it or keep it as your own.

## Entities with business rules

When the writes of an entity follow business rules (state changes, an audit
trail, constraints across tables), the generic save and delete bypass them.
Declare them off, route every write through a business Flow, and link the
business pages in the shell:

```json
{"name": "tickets", "label": "Tickets", "fields": ["..."],
 "permissions": {"list": ["agent", "manager"], "read": ["agent", "manager"], "count": ["agent", "manager"], "save": false, "delete": false},
 "ui": {"navigation": false}}
```

and at the root of the model
`"ui": {"navigation": [{"page": "ticket_desk", "label": "Tickets", "permission": "tickets.list"}]}`.

- `desk_tickets_save` and `desk_tickets_delete` refuse every role, and no
  generated page offers New, Edit or Delete; the list and detail stay,
  read-only. `ui.navigation: false` drops the generic list from the shell,
  where `ticket_desk` takes its place.
- `permissions.tickets.update` of the session is now `false`: your business
  Flows check the role (`local.session.role`), then apply the rules and
  write the audit row in the same transaction (`flow://guide/crud-business`).
- `generate: "data"` goes further: no generic page at all.
