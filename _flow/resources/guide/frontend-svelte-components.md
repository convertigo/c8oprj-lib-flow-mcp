# Flow Svelte Components

Reusable Flow components: props, declared events with EmitEvent, shared and library components, palette discovery before a mock.

Sub-guide of `flow://guide/frontend-svelte`: read that entry guide first for the authoring loop.

## Components And Inputs

A reusable Flow component is a `<FlowComponent>` whose header declares
`kind: "component"` and its inputs in `props`; inside it, `@props.<name>`
reads an input:

```svelte
<script module>
  export const _flow = {
    sourceVersion: 2,
    kind: "component",
    id: "greeting",
    label: "Greeting",
    props: {
      title: { label: "Title", type: "string", default: "Hi", description: "Heading text." }
    }
  };
</script>

<FlowComponent $$id="greeting">
  <Structure>
    <Text $$id="text" text="@props.title" />
  </Structure>
</FlowComponent>
```

Saved as `src/lib/components/Greeting.flow.svelte`, it is used by its tag;
each input is a bindable property: `<Greeting $$id="hello" title="@route.path" />`.
Its label lives in the header (no `label` attribute on its root), and each
instance owns its own state. An unknown input path gives
`FRONTEND_BINDING_PATH_UNKNOWN`.

A component tells its host what happened through events declared in the same
header, `events: { picked: { label, description, schema } }` (camelCase
names). Inside it, `<EmitEvent $$id="emitPicked" event="picked"
value="@local.choice" />` raises one from an action chain; its host handles it
on the use with `On` plus the capitalized name and reads the value, typed by
the declared `schema`, as `@event.value`:

```svelte
<Picker $$id="namePicker"><Events><OnPicked $$id="whenPicked"><Actions>
  <SetValue $$id="keep" target="page.chosen" value="@event.value.name" />
</Actions></OnPicked></Events></Picker>
```

`EmitEvent` exists only in a component (`FRONTEND_EMIT_OUTSIDE_COMPONENT`) and
only for a declared event (`FRONTEND_EMIT_EVENT_UNKNOWN`); a handler of an
undeclared event gives `FRONTEND_COMPONENT_EVENT_UNKNOWN`.

Shared components live in the builder root
`_flow/frontbuilder/svelte/components/<namespace>/<Tag>.flow.svelte` of the
defining project (older libraries stay flat under `components/`). Studio shows
them under **Catalog > Components** in two forms:

- **Flow UI block:** a `<FlowComponent>` with an `_flow` header, edited as a
  tree (Variables / Events / Structure) like the example above;
- **Svelte UI block:** Svelte code described by an `export const _meta`
  header (`sourceVersion: 2`, `id: "<namespace>.<name>"`, `tag`, `kind`,
  `runtime: "flow-svelte"`, `props`, `slots`, `targetKinds`, `icon`,
  `description`), edited through Open source. Read an existing one with
  `code-get` before writing a new one.

A `<Tag>.flow.css` beside a component is its CSS. A provider may declare
exact npm versions in `_meta.implementation.dependencies`; `dev.sync`
installs them. Never run npm manually or edit the generated `package.json`.

Before creating a local component or mock, query the contextual palette:
`authoring-palette({ project, parentPath, query:"chart" })` with a
`parentPath` returned by `authoring-tree` and the business capability as
`query`. Execute the matching item's `apply` unchanged; the palette searches
the project, its references and the workspace and adds a required project
reference. `flow-project-reference` adds a reference explicitly, or pass
`references` to `flow-project-bootstrap`; its `url` (with `branch` and `path`)
sets or updates the Git URL another workspace imports the provider from, so a
published project brings its dependencies. Referenced components are read-only
library blocks: edit them in their provider project. Otherwise keep a typed,
visibly incomplete mock; never replace a requested chart with a table or fake
data. `authoring-tree` omits the catalogs by default; use the palette for
discovery.
