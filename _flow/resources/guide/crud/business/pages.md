# Generated CRUD: PAGES

Read when adding custom pages and sign-in beside generated CRUD pages.

### Pages next to the generated ones

Write a page under its own route, for example
`src/routes/my-tickets/+page.flow.svelte` with `code-set` and `sourceFile`. The
generated root layout wraps it in the shell. Link it from the shell with
`ui.navigation` in the model (`page` is its `page.id`; `permission`, as
`<entity>.<operation>`, shows the link only when the session grants it), then
apply. Load the session first, as the generated pages do:

```svelte
<script module>
export const _flow = { sourceVersion: 2, page: { id: "my_tickets", title: "My tickets" } };
</script>
<FlowComponent $$id="my_tickets">
<Variables><State $$id="viewReady" type="boolean" value={false} /></Variables>
<Structure>
<PageHeader $$id="header" title="My tickets" description="Tickets assigned to you." />
<If $$id="ready" test="@page.viewReady"><Then>
<DataTable $$id="mine" caption="My tickets" source="@.my_tickets.rows" rowKey="id" columns={[{"key":"title","path":"title","label":"Title"},{"key":"status","path":"status","label":"Status","format":"badge"}]} rowActions={[{"id":"open","label":"Open","page":"tickets_detail","query":{"id":"id"}},{"id":"resolve","label":"Resolve"}]}><Events><OnClick $$id="rowCommand"><Actions><CallSequence $$id="resolveTicket" requestable=".ticket_resolve"><Variables><Variable name="id" value="@event.value.row.id" /></Variables></CallSequence><CallSequence $$id="reloadMine" requestable=".my_tickets"><Variables></Variables></CallSequence></Actions></OnClick></Events></DataTable>
</Then></If>
<Status $$id="statusResolve" actionId="resolveTicket" successText="Ticket resolved." />
</Structure>
<Events><OnMount $$id="mount"><Actions><CallSequence $$id="loadSession" requestable=".desk_session"><Variables></Variables></CallSequence><If $$id="signedIn" test="@.desk_session.authenticated"><Then><CallSequence $$id="loadMine" requestable=".my_tickets"><Variables></Variables></CallSequence><SetValue $$id="markReady" target="page.viewReady" value={true} /></Then><Else><Navigate $$id="needLogin" page="crud_login"></Navigate></Else></If></Actions></OnMount></Events>
</FlowComponent>
```

The generated pages, dashboard included, cannot be changed by hand: add a
page instead of editing one.

### Your own home and sign-in pages

The generated shell has a home (the dashboard `crud_dashboard`, at `/`) and a
sign-in (`crud_login`, the demo account picker, at `/login`). To give them to
your pages, name them by their `page.id` at the root of the model:

```json
"ui": {"homePage": "my_tickets", "loginPage": "sign_in",
       "navigation": [{"page": "my_tickets", "label": "My tickets"}]}
```

- `ui.homePage`: the home of the shell and where the demo sign-in leads; the
  dashboard leaves the navigation, and `/` sends a signed-in user to it (an
  anonymous one to the sign-in).
- `ui.loginPage`: where every generated page sends an anonymous user, and
  where sign-out leads. Your sign-in page loads the session without
  requiring it, signs in (`session.authenticate` in a business Flow), then
  navigates to the home page; the pages above then send to `sign_in`, not
  `crud_login`.
- `crud_dashboard` and `crud_login` stay generated, unlinked. `false`
  generates neither: `"homePage": false` leaves `/` to your page (the first
  `ui.navigation` page is the home of the shell), `"loginPage": false` drops
  `/login` and the demo sign-in Flow.
