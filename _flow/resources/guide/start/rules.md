# Flow MCP Project Rules

Essential project rules; open one drawer for detailed setup.

Keep secrets in server symbols or secret configuration; never place token values in sources, traces or public responses. External HTTP uses `/convertigo/api/flow-mcp` with its HS256 bearer token. For business data with roles, choose the entity route by default and enforce access on the server. Use a real project name in MCP calls; do not substitute the current Studio selection. Save Studio working copies before handover.

For browser verification, `browser_wait_for.time` is in **seconds**, at most 30: use `2`, never `2000`.
