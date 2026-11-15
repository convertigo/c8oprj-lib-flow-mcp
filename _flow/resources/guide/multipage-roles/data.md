# Direct SQL multi-page data

Read for contracts, SQL data and session setup.

## 1. Prepare the contracts

Read `flow://guide/start`, `flow://guide/authoring` and
`flow://guide/frontend-svelte`. Add the references that `flow-catalog`
proposes: `lib_flow_sql`, `lib_flow_crud_data`, `lib_flow_frontend_data_svelte`
and the Svelte frontbuilder. Read `flow://lib/lib_flow_sql/sql` for the
configuration and `flow://lib/lib_flow_crud_data/csv` for the export. Inspect
the real contracts before writing the calls, with `flow-block-get` for each
block (`sql.write`, `data.read`, `date.add`...), never in the library sources;
an available catalog does not prove that a connection is configured.

Create the schema, the demonstration data and the server Flows first, then the
pages. Declare typed parameters; `int64` identifiers stay strings. Declare
`items: {type:"object"}` for an array of objects. Platform symbols belong to
the configuration, with demonstration values disabled by default; no secret in
the source, the outputs or the logs.

## 2. Set up the data and the session

Configure `config.sql.connections`, the separate schema and data, then call
`sql.initialize`. HSQLDB is a development database: its path is relative to
the project, under `_flow/resources/sql/`, outside `_private`, protected by
`.httpignore`. A CAR replaces this database; use an external DBMS in
production. Ignore in Git the database files that tests create. A replayed
initialization must keep the user's writes; a reset stays explicit and
reserved for the demonstration.

In production, call a real authentication provider: the Flows of
`lib_UserManager` (guide `flow://lib/lib_UserManager/user-manager`). `session.authenticate` establishes an identity; it does not
check a password. An Alice/Bob/Manager picker is acceptable only behind a
demonstration configuration, never as a production sign-in screen.

The demonstration switch is `config.demo.login`, which the bootstrap declares
off in `_flow/engine.yaml` as a global symbol:

```yaml
config:
  demo:
    login: "${<project>.demo.login=false}"
```

The demo sign-in Flow refuses before anything else when it is off; a symbol is
text, hence `String(...)`:

```javascript
if (String(config.demo.login) !== "true") {
  throw { code: "DEMO_LOGIN_DISABLED", message: "Demo sign-in is disabled" }
}
```

To turn it on for a demonstration, an administrator sets the global symbol
`<project>.demo.login` to `true` (Global symbols page of the server or the
Studio); the CAR deployed elsewhere keeps it off. Never write `login: true` in
the project, and never let the demo sign-in pick any account from a parameter
when the switch is off. The page hides the demo picker when a public Flow says
the switch is off.

The development database keeps HSQLDB and its default user, but its password
is a reference, as for any connection:
`password: "${<project>.db.password.secret=}"` (`flow://lib/lib_flow_sql/sql`).

Create a `CurrentUser` Flow that reads `session.authenticatedUser`, looks the
account up on the server, checks that it is active and returns its role. Take
neither the identity nor the role from the page. Refuse a missing session
(`UNAUTHENTICATED`, 401) or a disabled or unauthorized account (`FORBIDDEN`,
403). A public session-check Flow may answer `{authenticated:false}` normally
for the anonymous home page. To sign out, call `session.authenticate({user:""})`,
clear the displayed state and disable the automatic replay of credentials; the
cookie must no longer authorize a protected read. In its `CallSequence`, pass a
`Variable` named `__disableAutologin` with `value={true}`: otherwise the SDK
may replay the sign-in instead of completing the sign-out.
