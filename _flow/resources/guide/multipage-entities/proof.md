# Entity application proof

Read before final verification and delivery.

## 4. Prove and deliver

Test anonymous, two USER sessions and a manager in distinct cookie jars; check
own/foreign reads and writes, client role forgery, revoked roles, two overlapping
bookings by different users, adjoining dates, partial updates, stale revision,
CSV perimeter/formulas/dates/limits, job off/on/replay, journal contents and
rollback, and logout with the old cookie. A page guard complements server checks.
Use `frontend-svelte-action` dev.open, then one relayed verifier for the roles;
a successful build or HTTP 200 alone is not interaction proof. Sign-in errors
return HTTP 200 with an `error` envelope: show `Status`, not only a result field.

Keep sources in Git and runtime data out. Run `flow-block-mock-list`, build with
`frontend-svelte-action` build, try the published URL, and run
`flow-app-progress` hardening. Keep CORS same-origin, symbols for credentials,
demo login/jobs off by default, application-protected initialization and documented production
identity/database choices. Entity example tests execute every backend/config
fence above; `frontend-guide-examples` compiles the exact layout and editor.


Entity CRUD supports HSQLDB and PostgreSQL only; MariaDB's SQL bootstrap support
is not Entity qualification. `initialize`/`demoReset` remain exported blocks
(`private:false`). The reset Flow must be private; an HTTP entry point verifies
ADMIN then uses `requestable.call`. Demo reset runs only in Studio, or when the
server symbol `lib_flow_entity.demoReset.enabled` is true (false by default).
Trusted ownership prefers a live session, otherwise preserves an explicit owner.
`describe` is metadata-only and bounded; unreadable relation targets are omitted.
Public errors omit SQL names and DDL. Author diagnostics and the additive preview
stay in the server log and authenticated MCP `code-run` of `entity.initialize`
with `dryRun:true`. See Backend preview boundary in `flow://guide/entities-actions`.
