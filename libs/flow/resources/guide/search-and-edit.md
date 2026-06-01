# Search And Edit

`flow-search` is the Flow equivalent of `rg`; multi-word queries match unordered tokens.

Useful arguments: `query`, `kinds:["node"]`, `context:1`, `limit`, `cursor`.

Each node match returns `flowQName`, `flow`, `nodeId`, canonical JSON Pointer `path`, `summary` and `snippet`.

Preferred mutations:

- Change a node property: `{op:"replace", nodeId:"setMessage", property:"value", value:"Hello"}`.
- Merge node properties: `{op:"merge", nodeId:"setMessage", value:{comment:"..."}}`.
- Insert near a node: `{op:"insert", afterNodeId:"setMessage", value:{id:"log", block:"log", message:"done"}}`.
- Insert in a container: `{op:"append", parentNodeId:"loopItems", slot:"nodes", value:{id:"push", block:"json.push"}}`.

Common MCP tools wrap those mutations: `flow-node-add`, `flow-node-edit`, `flow-node-move`, `flow-node-delete`, `flow-node-duplicate`.

`flow-node-add` requires a stable id. `flow-node-duplicate` requires `newId` or `properties.id`.

Use `path` only for low-level mutations or when no stable `nodeId` exists.
