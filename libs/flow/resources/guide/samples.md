# FlowScript Samples

When syntax or modeling is unclear, read real executable samples before opening
the full palette. Samples are small, private or internal examples that exercise
the same MCP tools used for normal authoring.

Read these first:

```json
{"tool":"flow-code-get","arguments":{"project":"lib_flow_mcp","qname":"sample_blocks_flow_and_rhino"}}
{"tool":"flow-block-code-get","arguments":{"project":"lib_flow_mcp","name":"sample.formatGreeting"}}
{"tool":"flow-block-code-get","arguments":{"project":"lib_flow_mcp","name":"sample.sha256"}}
```

What they demonstrate:

- an executable Flow with `_flow.inputs` and `_flow.tests`;
- one FlowScript block implemented as readable Flow code;
- one Rhino block limited to a small Java bridge;
- comments that explain non-obvious DSL rules;
- the rule that Flow block calls use one object of named parameters:
  `block.name({ key: value })`.

For general list/JSON examples from the core engine, search or read:

```json
{"tool":"flow-search","arguments":{"project":"lib_flow_mcp","query":"sample list sort map json object","includeSamples":true,"limit":5}}
```

Use samples as patterns, not as templates to copy blindly. Keep new executable
Flows readable and move only reusable or low-level behavior into project blocks.
