# Entity application operations

Read for CSV export, scheduled jobs and audit.

## Export CSV

The export reuses `entity.list` with `checkAccess:true`, so forged users and roles cannot widen its
perimeter. This minimal export has no client filter and is explicitly complete
up to 200 rows: if more exist, refuse rather than silently export one page.
When adding screen filters, validate and pass the **same** filters here. For
larger exports use a bounded paging loop, not a client-side CSV encoder.

<!-- example: export-bookings -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "hidden", authenticatedContextRequired: true }

function ExportBookings({ input, config, result }) {
  local.page = entity.list({ entity: "Reservation", checkAccess: true, options: { limit: 200, orderBy: "id" } })
  if (local.page.hasMore) {
    throw { code: "EXPORT_LIMIT", message: "Narrow the export below 201 rows" }
  }
  local.rows = list.map({
    items: local.page.rows,
    select: {
      id: current.key.id,
      title: current.values.title,
      starts: current.values.starts,
      ends: current.values.ends,
    },
  })
  result.file = data.csv({
    rows: local.rows,
    columns: [
      { field: "id", type: "int64" },
      { field: "title" },
      { field: "starts", type: "date" },
      { field: "ends", type: "date" },
    ],
    filename: "bookings.csv",
    separator: ";",
    bom: true,
    maxRows: 200,
    maxBytes: 1048576,
  })
}
```

Use ordinary `CallSequence` then `FileDownload` with `@page.export.file`; read
the `data.csv` and frontend file-download contracts from the palette. The CSV
has UTF-8 BOM, French dates and formula protection. A `.bin` facade can instead
end with `file.respond`. Neither a download button nor a hidden link grants
permission.

## Scheduled jobs

Start with a **read-only daily check**: a private Flow counts bookings starting
today, with a server date, no browser session and no notification side effect.
It is naturally replayable; do not claim that a message was sent. The job is off
by default through `<project>.jobs.enabled`. No session is forged for the job.
The private named query has only the aggregate necessary for this service.

<!-- example: daily-bookings -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "private" }

function DailyBookings({ input, config, result }) {
  if (String(config.jobs.enabled) !== "true") {
    return { enabled: false, count: "0" }
  }
  local.day = date.today({ timeZone: "Europe/Paris" })
  local.page = sql.query({ query: "startsToday", parameters: { day: local.day }, limit: 1 })
  return { enabled: true, day: local.day, count: local.page.rows[0].total }
}
```

Inspect `scheduler-list`, then use the advertised relayed `scheduler-apply` to
schedule the exact private `<project>.DailyBookings` requestable with a
project-specific job name, Europe/Paris and a daily trigger. Read that tool's
contract; scheduler availability is deployment-specific. Run it once and replay
it before enabling the schedule. For real sending, add an idempotent outbox and
`email.send` with a capture server first; do not send external effects in a JDBC
transaction. A manual run of a job for the ADMIN is a separate hidden Flow that
checks the ADMIN role, then calls the private job with `requestable.call`;
never make the job itself public or hidden.

## Audit

`Journalisé` allowlists only the model fields shown in `flow://guide/multipage-entities`. The library writes
actor, operation, key, server date and those values **in the mutation's SQL
transaction**. Failure of the hook or journal aborts the write; no password,
token or account secret belongs in this model or journal. The read-only Audit
entity shares the table and checks MANAGER/ADMIN read permissions. Review
retention separately; a journal after a committed mutation is not equivalent.
