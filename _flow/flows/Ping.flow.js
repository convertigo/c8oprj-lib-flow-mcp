// c8o: Flow source (FlowScript, sourceVersion 2). Calls are Flow blocks; plain keys are business properties, $$ keys are engine attributes and slots.
// c8o: Edit in the Studio or with the Flow MCP code tools; patch with the returned revision.

const _flow = {
  "sourceVersion": 2,
}

function Ping({ input, config, result }) {
  set({
    $$id: "returnResult",
    path: "result.result",
    value: {
      ok: true,
      server: "convertigo-flow-mcp",
      endpoint: "/flow-mcp",
    },
  })
}
