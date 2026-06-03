# Flow MCP Tracing

Use tracing only while measuring or debugging an agent run.

Enable it with Convertigo symbols:

```text
flow.mcp.traceJsonl=true
flow.mcp.traceJsonl.maxChars=30000
```

`true` writes to `<lib_flow_mcp project>/_private/flow-mcp-trace.jsonl`. A file path writes there instead.

Each line is a compact JSON object with direction, JSON-RPC id, method/tool, durationMs for responses, a summary, payloadChars and the sanitized payload. Large payloads are truncated after `flow.mcp.traceJsonl.maxChars`, but the summary stays available.

Useful local review commands:

```sh
jq -s . /path/to/flow-mcp-trace.jsonl > /tmp/flow-mcp-trace.pretty.json
jq -r '[.direction,.tool,((.durationMs // "")|tostring),(.summary|tostring)] | @tsv' /path/to/flow-mcp-trace.jsonl
```

After you know the tool contract, call tools with `hints:false` and usually `doc:false`. Prefer paginated discovery (`limit`, `cursor`) and exact reads (`flow-block-get`, `flow-tree` on one flow) over full catalog dumps.
