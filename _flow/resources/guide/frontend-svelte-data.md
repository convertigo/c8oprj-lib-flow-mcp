# Flow Svelte Values, State And Flow Calls

Binding modes and sources (@.Sequence, @page, @event, @route, @props), State and $$out results, CallSequence markers and Status.

Sub-guide of `flow://guide/frontend-svelte`: read that entry guide first for the authoring loop.

## Values And Bindings

A bindable property has three human modes, as in the Studio picker:

- **Literal:** `label="News"` (or `value={true}` for non-strings);
- **Source:** `text="@.GetNews.news"`, a schema-backed reference that always
  starts with `@`;
- **Compose:** ordered literal, source and expression parts
  (`expression.parts`) such as `index + 1 + " / " + total`; a source framed by
  text is Compose, not Source.

A raw `{expression}` stays available for advanced browser-only logic. Write
`@source.path` references or concise expressions in source; never hand-write
the internal `FlowValueBinding` JSON, and apply `suggestedBinding` or an exact
picker mutation when validation returns one. A source path can always be
typed; schema paths are suggestions. Use the canonical bindable property of
each block: `Text.text`, `Button.label`, `Image.src`, `ForEach.source`.

Sources:

- `@.Sequence.path` (or `@.Sequence#marker.path`): the last result of that
  sequence, as in NGX, wherever a `CallSequence` ran it on the page;
  `<CallSequence $$id="load" requestable=".Sequence">` calls it, with its inputs in
  `<Variables>` and the follow-up actions after it in the same `Actions`
  (`sequence="Sequence"` is accepted with a `FRONTEND_PROPERTY_ALIAS` warning);
- `@Project.Sequence.path`: the result of a sequence of another project, named
  as its `CallSequence` names it (`requestable="lib_OAuth.GetOAuthCredentials"`
  is read by `@lib_OAuth.GetOAuthCredentials.GoogleClientID`); `@.Sequence`
  always means the page project, and a result no `CallSequence` produces warns
  with `FRONTEND_SEQUENCE_RESULT_UNKNOWN`;
- `@<actionId>.path`: a FullSync or portable action result;
- `@page.name`, `@layout.name`, `@comp.name`: a variable (`State`, `Derived`,
  `Translations`) named by its owner, as in NGX: `page.` in a page,
  `layout.` in a layout, `comp.` in a component. A page reads the variables of
  its Layouts as `@layout.name` (the nearest Layout declaring `name`);
- `@<context>.path` and `@index` inside a `ForEach` (`@row.name` under
  `context="row"`), or the explicit `@<forEachId>.item.path` and
  `@<forEachId>.index`;
- `@event.value`, `.checked`, `.key`, `.name`, `.file`, `.files`, `.source`:
  the normalized event; `@event.target.*` and `@event.detail.*` do not exist
  (`FRONTEND_EVENT_PATH_NOT_NORMALIZED`);
- `@route.path`, `@route.params.id`, `@route.query.tab`: current route;
- `@props.<name>`: a component input (inside a component);
- `@theme.available`, `@theme.options`, `@theme.default`: application themes.

```svelte
<ForEach $$id="news" source="@.GetNews.news" context="item" index="index">
  <Children>
    <Image $$id="image" src="@item.imageUrl" />
    <Text $$id="title" text="@item.title" />
    <Text $$id="position" text="@news.index" />
  </Children>
</ForEach>
```

In a source attribute, `@` belongs to a quoted binding (`value="@event.value"`),
not JavaScript braces (`value={@event.value}` is invalid Svelte). Keep quotes
balanced: `label='Livres "disponibles"'` uses different outer and inner
quotes. A comparison in a quoted attribute is not a source reference; use a
an expression such as `test={page.count > 0}` for an action test. Backslash-escaping a double quote does not escape an HTML attribute.
Read a portable computation's contract before composing client actions;
`JSON.stringify([@event.value.row.id])` is invalid JavaScript; use
`value={JSON.stringify([event.value.row.id])}`.

Create target Pages before writing a `Navigate` to their **Page id**. Use the
`authoringContract.pages` and bindings from `code-get` for actual names and
paths; do not guess state/action ids, properties or schema fields. An `If`
action's `Then`/`Else` contains actions directly, without another `Actions`.
Each `$$id` must be unique in its source.

When the provider supplies a typed correction, `code-set` now also returns
`error.details.proposedPatch` with exact `line`, `before`/`after` and
`oldText`/`newText`. Review and apply it to the refused text, then retry
`code-set`. It may fix one diagnostic while others remain; the refused text
has not replaced the previous source. See `flow://guide/search-and-edit` for
the revision rule.

Unknown navigation targets report `availablePages` with their exact ids and
routes. A missing binding source reports the complete `availableReferences`;
a missing field reports `sourceSchema`. Choose from those contracts without
inventing a State or removing a field just to make validation pass. DataTable
row actions emit `OnClick` with `@event.value.action` and `@event.value.row`:
an invented `OnRowAction` remains an error, with an explicit rename proposal
only when the table has no existing OnClick handler. Other invented events
need a choice from the returned `emittedEvents` and `eventContracts`.
`FRONTEND_PATCH_EDITS_REQUIRED` means a patch has no edits or unified diff;
send a complete replacement to `code-set` with the last read revision.

Client action parameters accept the pure expressions described in `flow://guide/frontend-svelte-sources`; use a source, a
literal or a portable block for computation.

## State, Results And Flow Calls

Declare mutable state with `State` and computed state with `Derived` or
`DerivedBy` in `Variables`. Write a value into a state with `SetValue`
(`<SetValue $$id="setLanguage" target="page.language" value="fr" />`); only
the state actions (`SetValue`, `UpdateList`, `UpdateNumber`) take `target`.
`UpdateList` `remove` deletes every occurrence of `value`; `toggle` removes it
when present, otherwise appends it (a multiple selection). Comparison is
strict, `17` differs from `"17"`: keep stable primitive identifiers.
An action that produces a result (a Flow call, `DateFormat`, any Flow block)
writes it straight into a state with its Output, `$$out="page.hour"`, with no
extra `SetValue`; without `$$out`, the following actions read it as `@<$$id>`.
Read state with `@page.name` (`layout.` / `comp.` in a layout or a component).
The former `local.name` is still read and rewritten on save.

Inside an event, an action's Output may instead declare a variable of that
event, as a `let` in JavaScript: `$$out="local.probe"` keeps the result for the
following actions of the same run only (`value="@local.probe.message"`). It is
not visible in the page structure nor to earlier actions, and every run of the
event starts without it.

```svelte
<OnMount $$id="mount"><Actions>
  <CallSequence $$id="callProbe" $$out="local.probe" requestable=".LiveProbe" />
  <SetValue $$id="keep" target="page.message" value="@local.probe.message" />
</Actions></OnMount>
```

`Variable` is the argument block of actions,
Params and Query, not page state. Initialize local state before long network
actions, and keep provisioning, synchronization and the first query separate
so progress and errors remain observable.

```svelte
<CallSequence $$id="getDetail" marker="cardDetail" requestable=".GetDetail">
  <Variables><Variable name="id" value="@item.id" /></Variables>
</CallSequence>
```

`marker` is an optional static identity that keeps a separate result per
marker (`@.GetDetail#cardDetail.name`), not a business parameter; per-item
results stay scoped to the iterator. Use `SetValue`,
`UpdateList` and `UpdateNumber` for explicit client state, `Derived` /
`DerivedBy` for pure projections, and portable blocks (inserted by their
palette tag, never `RunAxiom`) for reusable browser logic. For FullSync, read
`flow://guide/fullsync`. `Status` displays the action named by its `actionId`:
a spinner line while it runs, its error in place, and a success toast with
its `successText` (nothing without one, so a load shows no stray message;
`successDisplay="inline"` keeps the message in the page). The toast stays on
screen when the chain then navigates (`CallSequence`, then `Navigate` back to
the list): no query parameter is needed to confirm on the next page.
