# Entity jobs: atomic reminder preparation

Read for a private replayable job sharing its entity writes with a manager action.

Use the installed `entity.read`, `entity.save` and `sql.transaction` contracts;
reference `lib_flow_entity`, `lib_flow_sql` and `lib_flow_crud_data`, with
`config.entities.connection: app` and the same SQL connection for both entities.
No new job framework or generated CRUD is needed. See
`flow://guide/entities/jobs-runner` for the scheduler and manual entry points.

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
const _flow = { sourceVersion: 2, accessibility: "private", inputs: { key: { type: "object" } } }

function PrepareReminder({ input, config, result }) {
  local.prepared = false
  sql.transaction({
    connection: "app",
    $$nodes: function () {
      local.task = entity.read({ entity: "Task", checkAccess: false, key: input.key })
      if (local.task.values.statut === "aRelancer" && local.task.values.preparedDue !== local.task.values.dateEcheance) {
        local.replay = String(local.task.key.id) + ":" + local.task.values.dateEcheance
        local.existing = entity.list({
          entity: "Reminder", checkAccess: false, options: { filter: { replayKey: local.replay }, limit: 1 },
        })
        if (local.existing.rows.length === 0) {
          local.reminder = entity.save({
            entity: "Reminder", checkAccess: false,
            values: { task: local.task.key.id, replayKey: local.replay, due: local.task.values.dateEcheance },
          })
          local.prepared = true
        }
        local.saved = entity.save({
          entity: "Task", checkAccess: false, key: local.task.key, revision: local.task.revision,
          values: { preparedDue: local.task.values.dateEcheance },
        })
      }
    },
  })
  return { prepared: local.prepared }
}
```

Commit is per task: a failure rolls back its reminder and marker together;
previous tasks remain committed. Replay starts from the beginning, skipping
committed cycles. An existing unique reminder repairs a missing marker, including
when a task returns to an older deadline. A concurrent unique/revision conflict
must abort the entire unit; retry it in a fresh transaction, never catch a SQL
failure inside that transaction. Keep both entities on `app`.
Do not delete prepared records or alter their replay keys through another route.
