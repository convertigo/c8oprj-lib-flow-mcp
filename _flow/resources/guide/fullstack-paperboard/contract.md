# Fullstack paperboard contract

Read when defining the shared contract, progress and done criteria.

## Paperboard Contract

A paperboard is not throwaway generated code. It is the first real low-code tree
that will be refined. Every visible region must be represented by a block in
the tree, even if its data source is still mocked.

Use placeholder labels that describe intent, not implementation:

```text
PageShell
  Card "Search"
    Text "Search form"
    Button "Load"
  Card "Results"
    Status for load action
    Table for result rows
  Card "Detail"
    Text "Select a row"
```

For Svelte route pages, use the normal SvelteKit tree (sources under
`<App>/src/routes/`, each Page a `<FlowComponent $$id="…">` with
`sourceVersion: 2` in its header):

```text
Routes
  ROOT /
    Layout
    Page
      Structure
        PageShell
          ...
    Children
      detail
        Page
```

Do not create hidden layout defaults in the generator to make the paperboard
look nicer. If rows, columns or responsive behavior matter, insert explicit
layout blocks with visible semantic properties. If gradients, typography or a
cohesive theme matter, use explicit classes and the source-backed application
CSS rail rather than duplicating general CSS properties on every block.

## Progress Signals

Use `flow-app-progress` to collect stable signals for the Studio chatbot or an
agent status update:

- FlowEngine can be read;
- executable Flows exist;
- the requested Flow exists when `qname` is provided;
- explicit project-local mocks remain or not;
- Svelte frontend builder/tree is readable;
- route/page structure exists;
- frontend build/dev actions are available.

The response includes `recommendedCalls`: exact MCP calls for the next audit
loop, such as `flow-output-schema`, `code-run`,
`frontend-svelte-tree detail:"inspect"` and `frontend-svelte-action generate`.
Use those calls instead of rediscovering broad catalogs or reading generated
files.

Progress is a delivery gauge, not a quality score. A project can be 80% on the
gauge and still need visual polish, schema refinement, performance work, or
mock replacement.

## Chatbot Status Style

Show user-facing work states, not raw hidden reasoning:

- "I created the first paperboard page with form, result table and detail
  placeholders."
- "The backend Flow runs with one typed mock: `feed.fetchItems`."
- "I wired the `Load` button to the backend action and generated the Svelte
  app."
- "Next I will replace the mock with the real HTTP Flow and keep the UI tree
  unchanged."

Keep MCP calls collapsible and attach important results: diagnostics, mock
count, build status, browser smoke status, and the next action.

## Done Criteria

For a small full-stack Flow application, done means:

- no explicit mocks remain unless the user accepted them;
- backend `code-run` proves the requestable result;
- output schema is static/effective enough for pickers;
- frontend tree contains explicit layout and data blocks;
- generated Svelte compiles through MCP actions;
- a visible runtime smoke proves the primary workflow.
