# Equipment exercise through MCP

`entity-mcp-proof.py` is a deterministic HTTP client, without a language model.
It sends every application source write through Flow MCP. The fixture declares
the entity model, SQL configuration, four backend Flows, three pages and a
shared layout; it contains no account password or bearer token.

Provide a private bearer file for the owned test runtime, then run:

```sh
python3 tools/entity-mcp-proof.py \
  --project EquipmentExercise \
  --fixture tests/fixtures/entity-mcp-equipment.json \
  --token-file /private/flow-mcp.token \
  --cookie-file /private/exercise.cookies \
  --credentials-file /private/exercise-accounts.json \
  --deploy \
  --evidence /private/exercise-evidence
```

The credential JSON has a `password` key. `--username` defaults to
`admin@example.test`, a real account that the test environment must provision
before this scenario. Authentication storage is independent of equipment SQL.
This client never creates fake sessions or interprets an authoring bearer as
an application account. Its optional deployment step signs in through the real
application, initializes twice as ADMIN and signs out. A separate cookie jar first proves an anonymous session. These five HTTP calls
are counted separately from MCP construction tools.

`summary.json` records attempted tool calls, total JSON-RPC requests, deployment
HTTP calls and whether the scenario completed. A refused source, runtime loss
or failed build keeps `complete:false`; its partial transcript remains evidence.
For a stopped run, `--resume-from <partial>/summary.json` checks the stored model,
reads existing source revisions, skips equal sources and writes only changed
sources through MCP before saving, building and deploying again. Prior attempted
tool calls remain included, including requests interrupted by a runtime loss.
Use a separate evidence directory for the continuation. Add `--rebuild-only`
to clear caches and rebuild the existing authored sources after a shared
provider change; it does not write application sources.

The fixture uses real session guards, role-dependent navigation, USER and ADMIN
landings, row selection, an editable form, save/delete/cancel event chains,
refresh counters and an immutable register. A successful construction/build is
still distinct from an interaction proof. Test the published `productionUrl`
under both roles with a browser; the root mission's Playwright proof does that.
The scenario records `dev.open` and its browser-control readiness. A headless
server may have no Studio CDP; the explicitly requested published-app Playwright
proof is independent of that control channel.

Keep bearer, cookie jar and credential files outside published evidence and Git.
The local test token helper is reserved for an owned disposable runtime. Stop
owned resources and remove those private test credentials after acceptance.
