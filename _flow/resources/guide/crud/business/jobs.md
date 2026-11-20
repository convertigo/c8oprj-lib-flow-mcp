# Generated CRUD: JOBS

Read when scheduling generated CRUD business jobs without a browser session.

### Scheduled jobs

A job has no session, so the generated entity Flows refuse it
(`UNAUTHENTICATED`). Write a private Flow that works through named SQL with
the copied connection, as a business action does, bounded and idempotent;
schedule it as `flow://guide/multipage-entities` shows.
For interpreted Flow Entities, use trusted `entity.*` composition instead:
`flow://guide/entities/jobs` shares an atomic reminder unit between a private
worker and a guarded manual action.
