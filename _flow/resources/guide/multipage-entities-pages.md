# Multi-Page Entity Application: Pages

Page, export, job and proof drawers for an entity-backed application.

Use `EntityTable` for lists and `EntityForm` for create/edit through the local EntityGateway. Put New in the table Toolbar under `context.permissions.create`; refresh the list after save or delete. Server policy applies to every query. A scheduled job has no browser session and must use a private, bounded Flow with its own trusted data access.

## Drawers

- `flow://guide/multipage-entities/pages` — open to write the pages, navigation and events.
- `flow://guide/multipage-entities/operations` — open for CSV export, jobs and audit.
- `flow://guide/multipage-entities/proof` — open for acceptance checks and delivery.
