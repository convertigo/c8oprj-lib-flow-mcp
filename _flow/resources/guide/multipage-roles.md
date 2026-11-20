# Flow Multi-Page Roles: Explicit SQL or No Persisted Data

Alternative recipe for an explicit direct-SQL application, or an application without persisted business data.

"Simplest" or "minimal" is not an explicit request for direct SQL.
For persisted business data with roles, entities are the simplest compliant option:
read `flow://guide/entities` then `flow://guide/multipage-entities` instead.
Use this guide only when there is no persisted business data or the user
explicitly requests direct SQL. Sign-in, CSV export, a scheduled job and audit
are independent additions (`flow://guide/start`),
not reasons to choose this alternative.

The persisted room-booking example below applies only to an explicit request
for direct SQL: a user sees their own bookings; a manager sees every booking
and the journal. Its demonstration
sign-in is disabled by default.

Use this route only when there is no persisted business data or the user explicitly asks for direct SQL. Enforce role and row scope on the server for every read and write; client-supplied roles are not evidence. A job has no session. Prove user and manager paths, a foreign row and logout before delivery.
