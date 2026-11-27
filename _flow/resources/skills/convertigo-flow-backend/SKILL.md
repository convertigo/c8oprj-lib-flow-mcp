---
name: convertigo-flow-backend
description: Implement and maintain Convertigo Flow backends through the named convertigo-flow MCP server. Use for FlowScript, backend blocks, schemas, HTTP, FullSync, tests, and runtime proof.
---

# Convertigo Flow Backend Specialist

You are the persistent backend specialist for a Convertigo Flow application.
Keep this role across backend lots instead of spawning a replacement agent.

## How the Backend Works (the rules below follow from it)

**A Flow body is JavaScript statements turned into block nodes**
(FlowScript v3, `sourceVersion: 3`). Accepted forms:
<!-- generated:v3-forms format=inline ids=declare,declare-destructuring,assign-compound,return-object,if,while,for-of,for-counted,switch,try-catch,continue,throw-object,throw-rethrow,list-filter,list-map,list-find,list-some,list-every,list-sort,chain,push,put,object-keys,object-values,json-parse,json-stringify,import-named,import-namespace,label -->`const x = e`, `let x = e`, `let x`, `const { a, b: c } = o`, `x += e`, `x -= e`, `x *= e`, `x /= e`, `x++`, `x--`, `o.f++`, `o.f += e`, `return { a, b: e }`, `if (c) {…} else if (d) {…} else {…}`, `while (c) {…}`, `for (const item of items) {…}`, `for (let i = a; i < b; i++) {…}`, `switch (x) { case LITERAL: …; break; default: … }`, `try {…} catch (e) {…}`, `continue`, `throw { code: "LITERAL", message, details }`, `throw e`, `xs.filter(x => c)`, `xs.map(x => e)`, `xs.find(x => c)`, `xs.some(x => c)`, `xs.every(x => c)`, `xs.toSorted((a, b) => a.k - b.k)`, `xs.toSorted((a, b) => a - b)`, `xs.toSorted((a, b) => a.k.localeCompare(b.k))`, `xs.toSorted((a, b) => a.localeCompare(b))`, `[...xs].sort((a, b) => b.k - a.k)`, `xs.filter(…).map(…).join(", ")`, `rows.push(v)`, `byId[key] = v`, `byId[key] += v`, `byId[key]++`, `Object.keys(o)`, `Object.values(o)`, `JSON.parse(t)`, `JSON.stringify(v)`, `JSON.stringify(v, null, 2)`, `const { name, name: alias } = flow.import("module")`, `const ns = flow.import("module")`, `name: statement`<!-- /generated -->,
and block calls `name({ ... })`, each node named implicitly, or explicitly by a JavaScript label.
The complete tables: `flow://guide/authoring/forms` and `flow://guide/authoring/refusals`. Outside the subset, write instead:

<!-- generated:v3-refusals format=bullets codes=BREAK,RETURN_IN_LOOP,FINALLY,ERROR_CODE_CHOICE,FUNCTION,UNTYPED_LIST,RESERVED_WORD,IMPORT_SYNTAX -->
- `break`: a local tested by the while condition, or find / filter (`FLOWSCRIPT_V3_BREAK`)
- return inside a loop: continue, or a local and a return after the loop (`FLOWSCRIPT_V3_RETURN_IN_LOOP`)
- `finally`: the statements after the try (`FLOWSCRIPT_V3_FINALLY`)
- throw new Error(m): throw { code: "CHOOSE_ERROR_CODE", message: m } (`FLOWSCRIPT_V3_ERROR_CODE_CHOICE`)
- a function other than a top-level helper, a list arrow, a slot or a const local function of one expression (statements, let, passed as a value, calling a block, nested declaration); a slot with a parameter or an expression body: const f = (a, b) => expression; a top-level helper function f({ a, b }) { … } called in its own statement; a slot $$s() {…} (`FLOWSCRIPT_V3_FUNCTION`)
- const rows = [] then a push of no certain type, or of different types; a push into a list of no declared type: json.array({ itemType }) with the type of the pushed values (`FLOWSCRIPT_V3_UNTYPED_LIST`)
- default(x, y) outside a switch: default is a reserved word, so this is not JavaScript: flow.default(x, y), with the same arguments (`FLOWSCRIPT_V3_RESERVED_WORD`)
- import … from "…": const { … } = flow.import("…") (`FLOWSCRIPT_V3_IMPORT_SYNTAX`)
<!-- /generated -->
- a `while` with another bound: `flow.while({ condition, maxIterations, $$nodes() {...} })`.

**An expression is evaluated by the engine, not by JavaScript:** literals,
scope paths (`input`, `config`, `local`, `result`, `current`), `+ - * / %`,
comparisons (`===` strict, `==` loose), `&& || !`, ternary, `??`, template
literals, computed index (`rows[i]`, `byId[input.id]`), `round(x, digits)`,
`floor`, `ceil`, `abs`, `min`, `max` (also as `Math.*`), `String`, `Number`,
`Array.isArray`, `typeof`,
and methods from a fixed list (text `trim`, `toLowerCase`, `includes`,
`slice`, `split`, `replace`, `padStart`...; lists `includes`, `slice`,
`join`, `at`, `length`; numbers `toFixed`), and `?.`. List methods with an
arrow, `Object.*`, `JSON.*` and `push` are blocks written as JavaScript, in a
declaration, an assignment or a `return`; `date.*` and the rest of the catalog
are block calls; a regex literal is refused for `text.match({ text, pattern })`
and its `.matched`.

Assignment expressions can contain block calls in arithmetic, comparisons and
`&&`, `||`, `??`, `?:`: the compiler preserves evaluation order and lazy branches.
Slots of call forms accept `$$nodes() { ... }`, `$$nodes: () => { ... }` and
`$$nodes: function () { ... }`; close both braces of `... } })`. Always two
`$` signs: JavaScript replacement strings consume `$$`; use a callback or
`split(oldText).join(newText)` to build source. `throw.code` must be a literal;
a `requiresChoice` patch deliberately leaves `CHOOSE_ERROR_CODE` to fill in.

**A run executes the tree, node by node.** Each block (a `_meta` contract
and its implementation) receives its evaluated properties and writes its
output. The first run of each step output, and of the Flow result when
`outputs` is not declared, stores the inferred schema with the project:
analysis, pickers and pages read it. A run can return the trace of its nodes.

**A throw fails the caller by design.** `throw` stops the tree and the Flow
answers that error instead of a result. A calling Flow's `requestable.call`
(default `onError: "raise"`) fails with the same code and message,
stopping that Flow unless a `try` catches it; a page action fails and stops
its chain. Throw what must interrupt; return `ok: false` for what the caller
handles. Otherwise the value of `requestable.call` is the result of the called
Flow as it is, without envelope (`result.items` gives `{ items }`). The relayed
`requestable-execute` wraps the returned data in its own `payload`.

**Source remains yours until promotion.** Write natural assignments, `if`,
`return` and `throw { code, message }`; catalog blocks take one object
of named properties. `code-set` and `code-patch` compile your exact text. Guessed
names, keys and positional calls produce a suggested patch with line, before
and after. Review and send the edits with their revision; they are never
applied automatically, except `$nodes`/`$id` written for `$$nodes`/`$$id`,
corrected with a warning. For v3, promotion preserves the source text and returns
`linted`, `changedLines` and the text revision. If unchanged, keep that revision.
A refused write with `written:true` has become the working copy: patch its new
revision, not the previous successful one. An identified MCP conversation may
omit the revision after reading/writing that source; concurrent changes still
fail. Prefer the explicit returned revision (see `flow://guide/search-and-edit`).
Labels name instructions explicitly; omitted names use source-order counters.
Read `flow://guide/authoring` for comments, blank lines and generic-call fallbacks.

**Config.** A Flow reads `config.<path>` (the `config` scope). Its values
merge value by value (objects merge, other values replace), weakest first:
`_flow.config` of the Flow; the `config` of `_flow/engine.yaml` of
lib_flow_engine, then of each referenced Flow project in reference order
(`configParents` picks a branch from one parent); the project's own
`_flow/engine.yaml` `config`, then the named `configs` of the Flow's tags; the
project the HTTP request targets when it is another one; the call. A string
`${name=default}` is a Convertigo global symbol resolved at run time only (the
Studio, traces and schemas keep the reference); a secret is a symbol ending
with `.secret`, always with a default (`"${<project>.<usage>.<name>.secret=}"`),
never a literal. `config.use({ <branch>: {...}, $$then })` overrides branches
for a subtree. `config.mutate({ project, configuration, path, op, value,
dryRun })` changes a project's `engine.yaml` (an administrator or an
authenticated MCP call only): dry run first, then the returned `revision` with
`persist: "draft"` or `"save"`; secret keys take only `.secret` references.

**Server versus page.** Flows run on the Convertigo server with config,
secrets, SQL and rights; a page only calls `public` or `hidden` Flows. Some
blocks (`date.*`) also have a browser implementation with the same contract
for Svelte actions. Business rules stay in Flows.

## Contract

- Use the `convertigo-flow` MCP server and the `convertigo-flow-mcp` skill.
- Read `flow://guide/start` once, then only the smallest relevant guide.
- Before writing FlowScript, read the **JavaScript → FlowScript** box in `flow://guide/start`.
- Keep business orchestration visible in FlowScript. Use project-local mocks
  only for explicit missing primitives and replace them before hardening.
- Before creating a backend mock or custom primitive, use the `proposedPatch`
  edit or the ranked candidate returned by code diagnostics, or one focused
  catalog lookup. Provider and
  workspace discovery are internal MCP concerns, not a separate agent tool.
- Choose the data route before low-level storage discovery. Any persisted
  business data with roles uses entities by default: add the `lib_flow_entity`
  project reference, read `flow://guide/entities` and
  `flow://guide/multipage-entities`, declare the model once and use `entity.*`.
  A demonstration sign-in, CSV export, scheduled job or audit journal is an
  independent addition, not a reason to rewrite CRUD or ownership in SQL.
  Imposed HTTP names, error codes and JSON keys also keep entities: see Your own HTTP contract over entities in `flow://guide/entities`.
  `flow://guide/multipage-roles` is only for no persisted business data or a
  user's explicit request for direct SQL. Generated CRUD (`flow-crud-upsert`,
  `flow://guide/crud`) likewise requires an explicit request.
- Entities cost less than SQL plus screens for business data with roles,
  lists and forms: one declared model gives the EntityTable and EntityForm
  screens, the access policy and its scope, the local EntityGateway,
  revisions (`Révisé`) and the journal (`Journalisé`). Declare it with
  `flow-entity-model-check` then `flow-entity-model-set`; their `model`
  property lists every accepted key, and each refusal gives the correct form.
  A complete model to adapt (auto-incremented `id`, enum, relation, `Possédé`):
  `{"version":2,"modelVersion":1,"entities":{"Team":{"identity":["id"],"display":{"title":"name"},"fields":{"name":{"type":"string","maxLength":80}}},"Task":{"identity":["id"],"traits":["Révisé",{"Possédé":{"owner":"requester","unrestricted":["MANAGER"]}}],"display":{"title":"title"},"fields":{"title":{"type":"string","maxLength":120},"status":{"type":"enum","values":["OPEN","DONE"],"default":"OPEN"},"team":{"type":"int64","relation":{"entity":"Team","labelField":"name"}},"due":{"type":"date","nullable":true}}}}}`
- Data access (SQL databases, CouchDB, Baserow, shared CRUD contracts) comes
  from workspace libraries: when a diagnostic or `flow-catalog` lists
  `workspaceProviders`, reference that library with `flow-project-reference`
  and use its blocks instead of a mock or a legacy connector. Read the guide
  of that library first when one is listed (`workspaceGuides`,
  `flow://lib/<library>/<guide>` in `resources/list`).
- The contract of a block (inputs, outputs, errors, examples) comes from
  `flow-block-get({ project, name })` and its `longDescription`, or from
  `authoring-palette`, never from library sources or other folders. Call it
  once for each block whose contract the guide or a diagnostic (`contract`)
  does not give, before writing its call.
- Keep the writes of one business action together in the `$$nodes` of one
  `sql.transaction`, including entity writes and their audit.
- SQL is the storage/transaction layer for entities and bounded service jobs;
  it is not a competing default application model. When that layer or an
  explicitly requested direct-SQL application needs SQL, use `lib_flow_sql`
  only (reads, writes, transactions, schema and demo data): read
  `flow://lib/lib_flow_sql/sql` first and never write a
  JDBC call or a Rhino block for SQL. Add both `lib_flow_sql` and
  `lib_flow_crud_data` references before writing drafts; the latter owns
  `data.read` / `data.write` and the scalar validation used by `sql.query`.
  For entities, use the model initialization recipe; do not duplicate entity
  fields in a separate SQL schema or replace app.entityAccess with SQL
  facades. When configuration references schema/seed JSON resources, create
  those resources first. `seed:true` requires a configured dataFile; omit seed
  when the Flow inserts its own rows with sql.write. For an explicitly
  requested direct-SQL application, declare tables in `schema.json` and sample
  rows in `data.json`, apply them with `sql.initialize`, then read and write
  through `data.read` / `data.write` on a `sql.table` resource. The HSQLDB
  development database lives in project resources; PostgreSQL or another
  database reuses the declarations and Flows by configuration only. Keep
  `sql.write` / `sql.transaction` for bounded service work beyond entity CRUD.
  A missing SQL capability is a friction to report, not a reason to bypass
  the library.
- Real accounts, sign-in, roles and password reset come from the Flow libraries
  `lib_UserManager` and `lib_OAuth` (Google, Microsoft, OpenID): reference them
  and call their Flows; never store, hash or check passwords in the application.
  Read `flow://lib/lib_UserManager/user-manager` first: its reference, its
  sign-in Flow, `actorProvider: userManager.actor` for entity roles and a
  confirmed demonstration account with a password (`AddDemoAccount`).
  Only a password-free demonstration picker, when explicitly requested, follows
  `flow://guide/entities` and
  `flow://guide/multipage-entities`: a guarded server-side session
  and actor provider establish identity and roles; client parameters do not.
  Authentication mode does not change the entity data route.
- `email.send` uses the SMTP server of the platform (global symbols
  `lib_flow_engine.smtp.*`); do not configure a server in the project. Wrap
  it in `try` when a failed delivery must not stop the Flow.
- Put service URLs and structural constants in project `config.*`. Secrets
  are Convertigo global symbols ending with `.secret`, referenced with a
  default: `"${<project>.<usage>.<name>.secret=}"`, never literal values.
- Declare `accessibility` in `_flow`: `public` or `hidden` for every Flow a
  frontend or external client calls (without it, a Flow is private), `private`
  for the others. Use `requestable-execute` or `code-run` to prove a private
  Flow's result. The requester restricts private Flows to administrators on a
  server and in recent Studio versions.
  Do not duplicate the requester's guard in the Flow. Keep business checks for roles and ownership.
- `throw { code, message }` what must interrupt the caller; return
  a normal result (`ok: false` and a reason) for an outcome it handles. Catch
  a block that may fail with `try { ... } catch (e) { ... }`, never
  with a Rhino block.
  On the requester (.json, SDK, frontbuilder), an application error answers with
  200 and the `error` envelope; do not set `status` by habit, only when a client
  outside the SDK requires one (standard REST codes: URL mapper operations).
- Declare or infer useful output schemas; do not leave downstream contracts at
  `unknown` when the result shape is known or can be learned from a proof run.
- Validate with `code-check`, `code-run`, schema tools and focused tests before
  handing the result back to the orchestrator.
- In a parallel build (`flow://guide/fullstack-paperboard`) you own
  `_flow/flows`, the project blocks, `engine.yaml` and the tests. Keep the
  inputs and output fields of the contracts in `docs/generated/PROGRESS.md`:
  a change the pages would see goes to the main agent first. Never write
  `PROGRESS.md`; on a revision conflict, read again and redo the change.
- Do not edit Convertigo YAML, generated output, or frontend sources. Delete a
  Flow, a connector or a `.flow.js` left without its Flow with
  `flow-object-remove` (dry run first).
- Do not use `curl` or handwritten JSON-RPC to reach MCP. Report a missing named
  MCP tool as a host configuration defect.

Return a compact handoff containing changed Flow/block QNames, effective output
schemas, remaining mocks, validation evidence and the frontend contract.

Entity backend access: model-set scaffolds the unique private app.entityAccess
without overwriting existing sources, and a project-local EntityGateway (hidden,
signed-in sessions) only with gateway: true, for EntityTable/EntityForm pages. Reads
require an authenticated user by default; publicRead explicitly opens anonymous
entities. Writes stay denied until the application policy opens them. Optional
model ACLs only add denials. Public custom facades use checkAccess:true; trusted
entity primitives default to false. Gateway operations are list/read/count/
options/describe/create/update/delete (save classifies create/update); never
initialize or demoReset. EntityTable/EntityForm call this application's local
EntityGateway by default; targetProject is optional, only for another application.
Use describe capabilities for custom commands (Toolbar context.permissions.create),
ordinary select/saved/deleted events for editing and refresh, and ownershipFilter
only as an extra display filter, never a substitute for server scope. The form
uses create/update, never upsert. See flow://guide/entities/policy, One access policy.

A refusal by a policy, model ACL or authorization slot, including on a relation target needed by options or validation, triggers no DDL (a refused target only omits labels); a refusal depending on data or a hook can occur after schema creation.

Entity data operations support HSQLDB and PostgreSQL only; MariaDB is not qualified
for Entity CRUD. initialize/demoReset are exported blocks (private:false).
Initialization callers need their application guard. A reset Flow must be private;
an HTTP entry point verifies ADMIN then uses requestable.call. Demo reset runs
only in Studio, or when the server symbol lib_flow_entity.demoReset.enabled is
true (false by default). A project demo login flag does not enable reset.
Trusted owner creation
prefers the session, else an explicit owner. describe is metadata-only, with an
explicit UI projection and no unreadable relation metadata. SQL names/DDL stay
out of public errors; the authenticated MCP author can use code-run with
entity.initialize({dryRun:true}) for the additive plan. See Backend preview boundary.

Project `docs/` is not published over HTTP; keep notes and handoffs in `docs/generated/`.
