# Flow Full-Stack Parallel Build

Parallel build of a backend and a Svelte frontend on agreed contracts, for several Flows and pages.

Sub-guide of `flow://guide/fullstack-paperboard`: read that guide first.

## Parallel Build

For an application of several Flows and pages, build the backend and the
frontend at the same time instead of one after the other: the main agent sets
the contract, two specialists build one side each, the main agent integrates.

1. **Contract first (main agent).** Golden Path steps 1 to 3, then the data
   model (entities, ids, fields; an explicit direct-SQL request uses the
   `schema.json` of `lib_flow_sql`) and every Flow a page calls: its `_flow.inputs`, the fields of its
   result and a minimal body that returns demo-shaped data with those exact
   names and types. `code-run` then `code-promote` each one so the frontend
   pickers see its fields. Write the contracts, the pages with the Flows they
   call, the owner of each area and the lots in `docs/generated/PROGRESS.md`
   (`flow-resource-patch` with `content`).
2. **Two specialists at once**, each with its skill, the contracts and one lot:

   | Specialist | Owns | Never writes |
   |---|---|---|
   | backend | `_flow/flows`, project blocks, `engine.yaml` (`config.*`), backend resources, tests | frontend sources |
   | frontend | `_flow/frontbuilder` sources, theme, assets | Flows, `engine.yaml` |

   The backend fills the bodies without changing the agreed inputs and
   fields. The frontend binds to the contracts as they are: a missing or wrong
   field goes back to the main agent, who hands it to the backend; never a
   hard-coded value, a mock Flow or a renamed binding. Writes are
   revision-checked (`revision`, `baseHash`): on a conflict, read again and
   redo the change on the new revision. Only the main agent writes
   `PROGRESS.md`, saves the project and runs the browser proofs; it writes
   neither side while the specialists run.
3. **Integrate (main agent).** Read the two handoffs, hand the missing fields
   to the backend as a small lot and then the binding to the frontend,
   `dev.sync`, prove the paths with the verifier, `project-save`, and update
   `PROGRESS.md` (lots done with their proof, open issues, next step).

Starting the specialists:

- Claude Code or Codex (write-capable sub-agents of their own): two sub-agents
  started together, each told the project, its side and what it owns, the
  skill to read (`convertigo-flow-backend` or `convertigo-flow-frontend-svelte`),
  the contracts, its lot and the handoff wanted. Start both in the foreground
  in one call and wait for both reports before ending your turn: some hosts
  stop a background sub-agent when the turn ends.
- Vibe (its `task` sub-agents are read-only): the relayed
  `subagent-run({profile:"constructor", task, inputs:{project, scope:"backend"}, waitSec:5})`,
  then the same with `scope:"frontend"`; collect each with
  `subagent-run({runId})` alone until its report comes. A constructor works
  with the `convertigo-flow` tools only, one per scope and project; the MCP
  refuses its writes outside its scope, its saves and its browser proofs.

Stay sequential for a small application (one or two Flows, one or two pages),
on a host with neither, or when the constructor call is refused (no agent key,
no Vibe home): one agent then alternates lots, a page bound to the contracts
while the next backend lot fills them.
