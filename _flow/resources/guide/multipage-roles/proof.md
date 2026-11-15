# Direct SQL jobs and proof

Read for scheduled work, tracing and end-to-end proof.

## 6. Schedule and trace

A standalone job does not depend on a browser cookie. It calls a dedicated,
bounded private Flow that checks its configuration, uses
`date.today`/`date.add` in the chosen time zone and returns a countable result.
Inspect `scheduler-list`, then create the job with the relayed
`scheduler-apply`; keep a name specific to the project. Test a real run and its
idempotence before enabling a regular schedule.

In a demonstration, record a `SIMULATED` notification and a journal entry in
the same `sql.transaction`, with a unique replay key. Do not claim that a
message was sent. For a real sending, use `email.send` and the platform SMTP;
start with a capture server. Never log a password, a token or a sensitive body.
The persistent journal holds the actor, the operation, the object and the date;
its access is checked on the server. A journal entry written after a mutation is
not atomic with it: use a transaction when that guarantee is needed.

## 7. Prove the path

Test the dates and the contracts in private test Flows named `test_...`: their
steps may call the same requestable several times in order, which stays a
warning for them (`FLOWSCRIPT_REPEATED_EXTERNAL_CALLS`). To run a step as a
user, call `session.authenticate({ user })` then `requestable.call`; a project
block taking the user, the requestable and its input keeps each step on one
line, and `session.authenticate({ user: "" })` ends the scenario. For HTTP, open a
session and keep its cookie in a separate jar for Alice, Bob and the manager; a
sign-in through `code-run` does not prove the session of the next HTTP call.
Check: anonymous access refused, data partitioned, forged identity ignored,
another user's mutation refused, revoked role read again, stale revision,
invalid filter or sort, CSV identical to the filtered list, job replayed without
duplicates, journal, and sign-out with the old cookie unusable.

Before declaring the application done, check its delivery too:

- demo sign-in off by default (`demo.login` false in the project), and the
  production setting documented: the symbol to set, or to leave unset;
- `corsOrigin` empty or the listed origins, never `=Origin` or `*`;
- database password through a symbol reference, never a literal;
- production build run with `frontend-svelte-action({ project, actionId:"build" })`,
  and `<server>/convertigo/projects/<project>/DisplayObjects/mobile/` serving
  the application; links meant for users (e-mails, shared URLs) point there,
  never to the dev viewer;
- `flow-app-progress({ project, mode:"hardening" })` without open
  `corsSameOrigin` or `productionBuild` task.

Finally prove the pages with each role through one relayed
`subagent-run({profile:"verifier", task, inputs:{project, url, paths, checks, hints}})`:
`url` is the viewer `openUrl`, one path per role (sign in, open each page, check
the visible rows and the downloaded file), the demo accounts in `hints`. While
it answers `status:"running"`, call it again with its `runId` alone. Do not
walk these paths yourself with Playwright. After each MCP tool, read
`result.error`, its code and its message before retrying. `FLOW_INPUT_REQUIRED`
and `FLOW_INPUT_TYPE_INVALID` point to an input contract;
`unsaved:true` in a `code-run` answer asks to resume from its `revision`. Keep
tests and sources in Git, without runtime data or secrets.
