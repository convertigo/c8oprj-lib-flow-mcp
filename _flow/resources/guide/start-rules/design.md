# Flow project design rules

Read for HTTP/CORS, secrets, configuration and application design.

## Design rules

- Keep structural constants (service URLs, API paths, namespaces, timeouts)
  in `config.*` or the project `_flow/engine.yaml`, not in block code. Reuse
  existing project config instead of copying it into `_flow.config`.
- Never write a secret (password, token, API key) in a configuration or a
  source: reference a Convertigo global symbol whose name ends with `.secret`,
  declared with a default, `password: "${<project>.<usage>.<name>.secret=}"`.
  The server resolves it for the running Flow only (stored encrypted, set in
  the Global symbols page); traces and schemas show the reference. Every
  `${...}` in a config string is a symbol reference. A development HSQLDB
  may keep its default user, but its password is such a reference too.
- Keep the CORS policy of the bootstrap (empty `corsOrigin`: same origin; the
  dev viewer and the production build are served by Convertigo). Never set
  `=Origin` or `*` on an application with a session cookie: any site could
  call it in the name of a signed-in user. List the origins (`#`) when a
  separate front end needs them.
- For sign-in, CSV, jobs and audit, see `flow://guide/start-rules/workspace` for authentication and add-ons.
- Keep a Flow `private` unless a frontend or an external client calls it:
  `const _flow = { accessibility: "private", ... }`. Private Flows run for
  Flow→Flow calls, the MCP and administrators only; `hidden` is callable but
  not listed, `public` is listed. A server, and a recent Studio, refuse a
  private one over HTTP to anyone but an administrator (an older Studio still
  ran it for an anonymous call): prove access control with a session that is
  not an administrator. Exploration, authoring, test and
  qualification Flows are always private.
- `throw { code, message }` what must interrupt the caller: the
  answer is the error alone and a frontend call fails and stops its chain.
  Return a normal result (`ok: false` with a reason) for an outcome the caller
  handles, such as a wrong password or nothing found.
- For repeated external work, model one item and iterate with `list.map` over
  a config collection or a small data block. Five or more copied `http.get` /
  `requestable.call` nodes must be refactored before promotion.
- Reusable domain blocks take business values (`country`, `city`, `product`)
  and read endpoints from `config.*`; prefer `currency.countryRate({ country:
  current, rates: local.rates })` over passing a prebuilt URL.
- For object maps whose keys are data, use `object.keys`, `object.get` and
  `object.firstEntry`; never write a Rhino block just to read `map[code]`.
- Keep the algorithm visible in FlowScript. Rhino is for one missing JVM
  primitive; project Rhino blocks that open URLs or call requestables are
  rejected.
- Top-down: call the domain block you want even if it does not exist yet.
  When `UNKNOWN_BLOCK` has no matching candidate (follow
  `candidateDecision`), create a typed mock with `flow-block-mock({ project,
  name, properties, outputs })`. A Flow using a mock is unfinished; check
  `flow-block-mock-list` before reporting completion.
- For request inputs and reusable tests, declare `const _flow = { inputs:
  {...}, tests: {...} }`; `code-set`/`code-check` report `inputDefinitions`,
  `inputVariables` and `testCases`, and inputs are synchronized to Convertigo
  request variables.
