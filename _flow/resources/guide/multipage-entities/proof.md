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
In that verifier, group visible assertions into one continuous journey:
fresh-session sign-in and identity, each list with expected rows, a detail
page, new row appearing after add, changed value after edit, and changed
aggregate after recalculation. Capture the failure message for an invalid
login in a separate fresh session. At each transition wait for the expected
element or response, using the browser tool's documented selector and arguments;
avoid fixed pauses. Keep the distinct USER and manager cookie jars for policy
checks, and report which visible assertion failed instead of treating an HTTP
200 or a rendered anonymous page as proof of the authenticated path.

A verifier gets at most two reruns after focused repairs, on failed paths only;
collecting its `runId` is still the same run. Report any paths left unverified.

Reuse the current browser context; open at most one additional context per role
being proved (for example, USER and manager), and keep it until that role's
checks finish. Sign out through the application (`SignOut`/`Logout`) before
closing an unused test context: closing it alone leaves its Convertigo session
alive. The development engine allows only 5 HTTP sessions in Standard Edition;
each browser context can occupy one for 30 minutes. If all MCP calls suddenly
fail without a readable response, suspect the session limit: sign out and close
test contexts, retry once, and report the incident.

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
