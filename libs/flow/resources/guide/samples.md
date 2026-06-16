# FlowScript Samples

When syntax or modeling is unclear, read real executable samples before opening
the full palette. Samples are small, private or internal examples that exercise
the same MCP tools used for normal authoring.

Read these first:

```json
{"method":"resources/read","params":{"uri":"flow://guide/samples"}}
{"tool":"code-get","arguments":{"project":"lib_flow_mcp","qname":"sample_blocks_flow_and_rhino"}}
{"tool":"code-get","arguments":{"project":"lib_flow_mcp","block":"sample.formatGreeting"}}
{"tool":"code-get","arguments":{"project":"lib_flow_mcp","block":"sample.sha256"}}
{"tool":"code-get","arguments":{"project":"lib_flow_engine","qname":"sample_list_filter_sort_map"}}
{"tool":"code-get","arguments":{"project":"lib_flow_engine","qname":"sample_json_object_output"}}
```

`flow://...` values are MCP resources. Do not pass them to `code-get`.
Use `code-get` only for executable Flow qnames and project-local blocks.

What they demonstrate:

- an executable Flow with `_flow.inputs` and `_flow.tests`;
- one FlowScript block implemented as readable Flow code;
- one Rhino block limited to a small Java bridge;
- comments that explain non-obvious DSL rules;
- the rule that Flow block calls use one object of named parameters:
  `block.name({ key: value })`.
- list projection style: `var rows = list.map({ items, select: { field:
  current.field } }); result.rows = rows`.

Use samples as patterns, not as templates to copy blindly. Keep new executable
Flows readable and move only reusable or low-level behavior into project blocks.
After reading these examples, write the first draft with `code-set`; do not open
the full catalog unless compiler diagnostics ask for a focused lookup.
