# Entity MCP proof

Run the existing library harness, plus `tests/entity-model-tools.js` in the same Rhino environment. The latter checks 27 assertions, including literal template-like defaults and stale/invalid writes.

`tools/entity-mcp-proof.py --token-file <private-token> --project <new-name> --fixture tests/fixtures/entity-mcp-equipment.json --evidence <output>` constructs the equipment project via authenticated HTTP MCP only. Use a fresh target name and one cookie jar (the script retains it). It records 28 tool calls / 32 JSON-RPC calls for the successful Mission 33 run: blank project, model diagnostics/revision refusal, config, two backend Flows, three pages, project save, palette discovery and real frontend build. No application source is written by Python. Bootstrap and model revisions intentionally reject rerunning on an occupied target.

The fixture is construction evidence, not a two-role runtime acceptance test. It saves an initializer without impersonating an application user. The authoring token and the application's account are different identities; `code-run` does not silently acquire the account session. Native Mission 33 acceptance separately proves real roles, CRUD and widgets. The generated Flow Svelte pages still lack the existing-row selection/edit/refresh chain and parameterized snippets; see the entities guides.

To reproduce locally, reference the modified Engine, entity, SQL, data, UserManager and Svelte libraries. The frontend provider must include the local-component-resources publication fix. Never put account passwords or the proof bearer in a fixture or transcript. `entity-mcp-proof-token.py` is only for a private isolated test workspace and removes its canonical token record with `--remove`.
