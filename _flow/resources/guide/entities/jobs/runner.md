# Entity jobs: scheduling, manual action and proof

Read after entities/jobs for the private worker, guarded manager facade and verification limits.

Set `config.jobs.enabled` to the symbol `${<project>.jobs.enabled=false}`.
Only the scheduled worker checks it; an authorized manual action can prepare
one task while the schedule is disabled. Both call the exact same private unit.
`app.actor` is the server-session provider from `flow://guide/entities/auth`;
it reloads the active role and ignores client-supplied identity.

<!-- example: manual-reminder -->
```javascript
const _flow = {
  sourceVersion: 3,
  accessibility: "hidden",
  authenticatedContextRequired: true,
  inputs: { key: { type: "object" } },
}

function PrepareReminderManually({ input, config, result }) {
  const actor = app.actor({})
  if (!actor.roles.includes("MANAGER")) {
    throw { code: "FORBIDDEN", message: "Operation refused" }
  }
  try {
    result.preparation = flow.call({ flow: "PrepareReminder", input: { key: input.key } })
  } catch (failure) {
    log({ level: "warn", message: "REMINDER_MANUAL_FAILED" })
    throw { code: "REMINDER_FAILED", message: "Operation failed" }
  }
}
```

A global MANAGER may prepare any task in this model. For a scoped manager,
perform `entity.read({checkAccess:true,...})` before calling the trusted unit and
enforce that scope in the unit's transaction too; a role alone is not row access.
Do not offer the private worker as an HTTP button or change it to hidden/public.

<!-- example: run-reminders -->
```javascript
const _flow = { sourceVersion: 3, accessibility: "private" }

function RunReminders({ input, config, result }) {
  if (String(config.jobs.enabled) !== "true") {
    return { enabled: false, prepared: 0 }
  }
  let offset = 0
  let pages = 0
  let more = true
  let prepared = 0
  let scanned = 0
  log({ level: "info", message: "REMINDER_JOB_STARTED" })
  try {
    flow.while({
      condition: more && pages < 5,
      maxIterations: 5,
      timeoutMs: 60000,
      $$nodes() {
        const page = entity.list({
          entity: "Task",
          checkAccess: false,
          options: { filter: { statut: "aRelancer" }, orderBy: "id", limit: 200, offset },
        })
        for (const item of page.rows) {
          const one = flow.call({ flow: "PrepareReminder", input: { key: item.key } })
          prepared += one.prepared ? 1 : 0
          scanned += 1
        }
        more = page.hasMore
        offset = page.nextOffset
        pages += 1
      },
    })
  } catch (failure) {
    log({ level: "error", message: "REMINDER_JOB_FAILED", data: { scanned, prepared } })
    throw { code: "REMINDER_FAILED", message: "Operation failed" }
  }
  log({ level: "info", message: "REMINDER_JOB_FINISHED", data: { scanned, prepared, complete: !more } })
  return { enabled: true, scanned, prepared, complete: !more }
}
```

The marker does not remove a row from the due list, so offset paging visits a
stable set during an ordinary run. The worker rereads each task before writing.
Five pages bound one run to 1000 candidates: `complete:false` needs a smaller
business scope or a durable partition/cursor before using this on larger data.
Restarting alone cannot progress beyond that cap. Concurrent changes to due
membership may shift offsets; the next run rescans from zero. This is eventual
processing, not a database snapshot. Configure SQL statement deadlines too;
the loop timeout cannot interrupt a blocked child call.

Follow [the scheduler contract in jobs.md](flow://guide/entities/jobs): read the
advertised `scheduler-apply` contract and inspect `scheduler-list` before creating a disabled job. Target
`<project>.RunReminders` using `project`, `sequence:"RunReminders"`, a project-owned
`name` and Quartz `cron:"0 0 9 * * ?"`. Create with `enabled:false`, using only the
advertised parameters. Check the scheduler's effective zone and cron occurrences
as described in jobs.md. `Échéance` uses Europe/Paris for deadline evaluation.
Reapplying that name updates the definition. After isolated run/replay proofs,
enable the schedule and the application symbol separately. Keep scheduler output
recording off. Log only fixed events and counts, never rows, titles, recipients,
config, the caught error/stack, credentials or message bodies.

Pure Node proof: `node tests/private-reminder-guide.cjs` compiles these exact
fences with the production parser/contracts and executes them with transactional
in-memory entity doubles. It checks replay, repair, partial failure and manual
roles.
With an isolated Convertigo engine, verify actual SQL rollback, simultaneous
unique/revision conflicts on HSQLDB/PostgreSQL, the real scheduler invocation
without a user session and the disabled switch. Keep both Flows private.
Check the manual facade's anonymous refusal and each role's result, including forged inputs.
For each signed-in call, run the app's login Flow in the relayed `requestable-execute` tool's
`before`, or use the `c8o call --as <name>` session opened by that login Flow. Inspect persisted
reminders and secret-free server logs. Run the targeted
`tests/response-budget.js` and `tests/flow-scheduled-private.js` too. No benchmark
is needed. Real email requires a separate outbox dispatcher with provider-side
idempotency; this preparation makes no claim of exactly-once external delivery.
