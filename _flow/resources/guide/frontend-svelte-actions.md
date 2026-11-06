# Flow Svelte Events, Actions And Lifecycle

Event action chains, If in actions, reentrancy, OnMount and OnAfterNavigate, the session Layout, Interval, Timeout and clocks.

Sub-guide of `flow://guide/frontend-svelte`: read that entry guide first for the authoring loop.

## Structure And Actions

```text
FlowComponent -> Variables -> State / Derived / DerivedBy / Translations
FlowComponent -> Events -> OnMount / OnAfterNavigate / OnDestroy / Effect / PreEffect / Interval / Timeout
FlowComponent -> Structure -> PageShell
Button -> Events -> OnClick -> Actions -> CallSequence -> Variables
Input / Textarea -> Events -> OnInput / OnChange -> Actions -> SetValue / portable block
AlertDialog -> Events -> OnConfirm / OnCancel -> Actions -> CallSequence
ForEach -> Children -> Card
If -> Then / Else
Layout -> PageContent
```

The actions of an event run in order; each one waits for the previous and the
chain stops at the first error. A Flow that fails answers its error alone,
`{ error: { code, message } }`: its call ends in error, its `Status` shows the
message and the chain stops, while `@.Flow.error.message` stays readable; a
result with an `error` field among others is a business answer.

An `If` in `Actions` is one step of the chain: its `test` (a source or a
Compose, JavaScript truthiness) picks the actions of its `Then` or of its
`Else`, which run in order with the same event and variables; the first
failure ends the chain, an empty branch lets it go on. Its branches hold
actions and `If` only. A `DataGrid` `OnChange` also fires when new rows drop
the selected one (`@event.source` is `selection`): guard what needs a row.

A chain started by a user event survives the teardown of the view that
launched it: a button may hide its own panel, or a Flow component may be
unmounted, and the remaining actions still run; lifecycle work (`OnMount`,
intervals) is cancelled instead. Reentrancy policies still apply. The first
error fills `Status` and is logged in the console.

```svelte
<OnChange $$id="pickTable"><Actions>
  <If $$id="hasRow" test="@event.value.selectedRows.length"><Then>
    <CallSequence $$id="describe" requestable=".Describe" />
  </Then><Else>
    <SetValue $$id="clearDetail" target="page.detail" value={{}} />
  </Else></If>
</Actions></OnChange>
```

When an event fires again while its actions
still run, its Expert `reentrancy` decides: `drop` ignores it, `latest` cancels
the running actions, `serial` queues it (at most 16), `parallel` runs both;
Expert `debounceMs` first waits for a pause. The defaults fit the common case:
`OnClick`, `OnSubmit` and `Interval` drop, `OnChange` and `OnAfterNavigate`
keep the latest. A
control stays disabled while the actions of a `drop` event run (`OnClick`,
`OnSubmit` by default), so a double click never starts them twice; a field
whose `OnChange` or `OnInput` runs actions stays editable and keeps its focus. Set
`<OnClick reentrancy="parallel">` only for harmless repeats such as a counter,
never for an order or a payment. Lifecycle actions (`OnMount`, `Interval`,
`Timeout`) still running when their page or component is destroyed are
cancelled and publish nothing; a chain started by a user event goes on.

Use palette blocks for layout (`AppShell`, `PageHeader`, `PageShell`,
`RowLayout`, `ColumnLayout`, `GridLayout`, `Card`), display, forms and
navigation. A Layout must contain
`PageContent`. Do not hide behavior in CSS, generated code or browser
globals. To skip a block temporarily, patch `$$disabled={true}` onto it;
remove the attribute to restore it.

Page lifecycle goes in the root `Events` slot, with the Svelte meaning of each
event. `OnMount` runs when the page or component mounts: its first display,
each entry on its route and a live reload; a navigation that keeps the page
shown (other route parameters, another query) does not run it again.
`OnAfterNavigate` runs after each navigation, the first display included, as
SvelteKit `afterNavigate`: load there what depends on the address, with
`@event.to.params.id`, `@event.to.query.tab`, `@event.to.path` or
`@event.to.route`, `@event.from` (null on the first display) and `@event.type`
(`enter`, `link`, `goto`, `popstate`, `form`). A newer navigation cancels the
run of an older one still going.

```svelte
<OnAfterNavigate $$id="load"><Actions>
  <FullSyncGet $$id="readProduct" database="retail" docid="@event.to.params.id" />
</Actions></OnAfterNavigate>
```

A Layout can remain mounted across sign-in, sign-out and navigation between
pages. `OnMount` alone therefore leaves its session stale. In the root
`src/routes/+layout.flow.svelte`, refresh the session on each navigation:

```svelte
<script module>export const _flow = { sourceVersion: 2 };</script>
<FlowComponent $$id="sessionLayout">
  <Variables><State $$id="session" type="object" value={{ authenticated: false, user: null }} /></Variables>
  <Events><OnAfterNavigate $$id="refreshSession"><Actions>
    <CallSequence $$id="loadSession" requestable=".CurrentUser" $$out="layout.session" />
  </Actions></OnAfterNavigate></Events>
  <Structure>
    <AppShell $$id="shell" title="Bookings" userName={layout.session.user?.firstName ?? ""}>
      <Children><PageContent $$id="content" /></Children>
    </AppShell>
  </Structure>
</FlowComponent>
```

`.CurrentUser` returns `{ authenticated: false, user: null }` for an anonymous
session, or `{ authenticated: true, user: { firstName, role } }` from the
server session. It must allow the anonymous home page to refresh normally.
Keep login redirects outside this `OnAfterNavigate`: navigate after sign-in
or sign-out in that command's chain, or guard a protected page separately.
Redirecting to login on every navigation would undo a successful sign-in.
A group Layout at `(app)/+layout.flow.svelte` only wraps pages inside `(app)`;
put the anonymous login page outside that group when it needs no shell.

`Interval` and `Timeout` register on mount and clean up on teardown; nest them
under `OnMount` only inside a larger explicit mount chain. `OnMount once={true}`
survives route round trips but not a full reload.

## Clocks And Timers

`Interval` and `Timeout` are schedulers: their callback count is not elapsed
time. For clocks and stopwatches, read wall-clock timestamps and compute from
them with `DateNow`, `DateFormat`, `NumberAdd`, `NumberSubtract`,
`NumberChoose` and `DurationFormat`; `authoringContract.portableBlocks` lists
their properties and a `wallClock` recipe. Look up one exact block (for
example `date.now`) in the palette only when its properties are absent. A
portable action writes its result with its Output `$$out="page.name"` (an
existing state), or the following actions read it as `@<$$id>`; only
`SetValue`, `UpdateList` and `UpdateNumber` take `target`. Never implement a stopwatch by counting `Interval`
callbacks.
