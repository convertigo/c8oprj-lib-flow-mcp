# Entity jobs: atomic reminder preparation

Read for a private replayable job sharing its entity writes with a manager action.

Use the installed `entity.read`, `entity.save` and `sql.transaction` contracts;
reference `lib_flow_entity`, `lib_flow_sql` and `lib_flow_crud_data`, with
`config.entities.connection: app` and the same SQL connection for both entities.
No new job framework or generated CRUD is needed. See
`flow://guide/entities/jobs/runner` for the worker and manual entry points.
For scheduling, the contract below supersedes the scheduler paragraph of that
recipe (which assumes the optional Flow fallback).

Merge this model into the application. The due date and status of `Échéance`
are calculated on the server; never write `statut` or `dateEcheance`.
Reference dates are public. A reminder here is a prepared record, not an email.

<!-- example: reminder-model -->
```json
{
  "version": 2,
  "entities": {
    "Task": {
      "display": {"title": "title"},
      "traits": ["Révisé", {"Échéance": {"reference": ["referenceDate"], "delay": {"days": 7}, "timeZone": "Europe/Paris"}}],
      "permissions": {"read": ["MANAGER"], "create": [], "update": [], "delete": []},
      "fields": {
        "title": {"type": "string", "maxLength": 120},
        "referenceDate": {"type": "date", "nullable": true},
        "preparedDue": {"type": "date", "nullable": true, "default": null}
      }
    },
    "Reminder": {
      "display": {"title": "replayKey"},
      "traits": ["Horodaté"],
      "permissions": {"read": ["MANAGER"], "create": [], "update": [], "delete": []},
      "fields": {
        "task": {"type": "int64", "relation": {"entity": "Task", "labelField": "title"}},
        "replayKey": {"type": "string", "maxLength": 100, "unique": true},
        "due": {"type": "date"},
        "state": {"type": "enum", "values": ["PREPARED"], "default": "PREPARED"}
      }
    }
  }
}
```

The application creates/edits tasks through its own guarded business actions;
generic writes are closed so callers cannot forge `preparedDue` or reminders.
The **private** unit below uses trusted entities (`checkAccess:false`, a source
constant). Only a private worker or an authorized facade may call it. It neither
creates a session nor accepts an actor, role, date or replay key from HTTP.
`field()` remains the only field-access gate inside the entity library; the
Flow consumes its row contract. No visibility rule is bypassed in a public Flow.

Save as `PrepareReminder`. Reread the task inside the transaction and use that
revision. The unique key identifies one task/deadline cycle, not one run/day.

<!-- example: prepare-reminder -->
```javascript
const _flow = { sourceVersion: 3, accessibility: "private", inputs: { key: { type: "object" } } }

function PrepareReminder({ input, config, result }) {
  let prepared = false
  sql.transaction({
    connection: "app",
    $$nodes() {
      const task = entity.read({ entity: "Task", checkAccess: false, key: input.key })
      if (task.values.statut === "aRelancer" && task.values.preparedDue !== task.values.dateEcheance) {
        const replay = String(task.key.id) + ":" + task.values.dateEcheance
        const existing = entity.list({
          entity: "Reminder",
          checkAccess: false,
          options: { filter: { replayKey: replay }, limit: 1 },
        })
        if (existing.rows.length === 0) {
          entity.save({
            entity: "Reminder",
            checkAccess: false,
            values: { task: task.key.id, replayKey: replay, due: task.values.dateEcheance },
          })
          prepared = true
        }
        entity.save({
          entity: "Task",
          checkAccess: false,
          key: task.key,
          revision: task.revision,
          values: { preparedDue: task.values.dateEcheance },
        })
      }
    },
  })
  return { prepared }
}
```

Commit is per task: a failure rolls back its reminder and marker together;
previous tasks remain committed. Replay starts from the beginning, skipping
committed cycles. An existing unique reminder repairs a missing marker, including
when a task returns to an older deadline. A concurrent unique/revision conflict
must abort the entire unit; retry it in a fresh transaction, never catch a SQL
failure inside that transaction. Keep both entities on `app`.
Do not delete prepared records or alter their replay keys through another route.

## Schedule with the advertised tool contract

Inspect `tools/list`, then `scheduler-list` (the relayed legacy operation is
`scheduler_list`) for the project before changing a job. The relayed legacy
`scheduler-apply` schema has no preview flag: do not send undocumented arguments.
The optional Flow fallback has a different schema; use only the one actually
advertised by this server.

For the legacy relay, create the project-owned definition **disabled**, with
`project`, `sequence:"RunReminders"`, `name`, `cron:"0 0 9 * * ?"`,
`enabled:false`. List again and verify the target, cron and disabled state.
After isolated execution and replay tests, enable the schedule and the
application symbol separately. Keep scheduler output recording off.

In the Flow fallback `scheduler-list` and `scheduler-apply` (including preview),
read `timeZone` for the effective JVM/Quartz zone and `nextFireTimes` for up to
three upcoming cron occurrences with offsets, even for disabled jobs. If
the zone differs from the specification, report the mismatch, keep the intended
wall-clock cron, leave the job disabled and leave the JVM time zone setting to
the runtime operator; enable it only once the reported zone matches.
If the legacy relay omits these fields, ask the operator to verify the zone
before enabling the job. `Échéance.timeZone` controls deadline evaluation.
