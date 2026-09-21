// c8o: FlowScript spike. Function calls are Flow blocks; named arguments are block properties.
// c8o: Patch with the returned revision. The engine validates and compiles this code back to Flow YAML.

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
  return result
}
