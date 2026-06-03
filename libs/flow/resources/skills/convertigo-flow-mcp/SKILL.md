---
name: convertigo-flow-mcp
description: Use Convertigo Flow MCP to inspect, create, edit, test, and run Convertigo Flow projects through a compact MCP-first workflow.
---

# ConvertigoFlowMCP

Use this skill when working with the experimental Convertigo Flow engine or the Flow-native MCP server.

## Route

- Prefer the `convertigo-flow` MCP server when the task concerns Flow, FlowEngine, Flow blocks, property types, Flow schemas, or Flow-native backend authoring.
- Start with `resources/list`, then read `flow://guide/start` when available.
- Use `tools/list` once, then prefer `flow-search`, `flow-tree`, `flow-catalog`, and targeted mutation tools over broad dumps.
- Before editing, inspect the current Flow with `flow-tree` or `flow-get`; after editing, validate with `flow-test` or `flow-run`.
- For project-local implementation files, prefer `flow-resource-get` then `flow-resource-patch` with the returned base hash.
- Keep responses compact: request summaries first, expand only the relevant node, block, type, or resource.

## Authoring Rules

- Treat a Flow as a readable execution graph and a block as a reusable function with typed properties, slots, hooks, and an implementation.
- Prefer existing blocks from the current provider/namespace before creating new blocks.
- Create custom blocks only when the behavior is reusable or hides unavoidable low-level code.
- Keep Rhino code small and localized inside block implementations; use Flow blocks for orchestration.
- Do not edit generated or cached files unless an MCP tool explicitly returns them as writable Flow resources.

## Local MCP Endpoint

- Expected Codex MCP server: `convertigo-flow`.
- The endpoint URL is configured in `.codex/config.toml`; this skill intentionally does not duplicate it.
- If the endpoint changes, run `lib_flow_mcp._setupCodex` again.
