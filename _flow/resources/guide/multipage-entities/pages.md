# Entity application pages

Read to build pages with ordinary events and entity widgets.

Use `EntityTable` for lists and `EntityForm` for create/edit through the local EntityGateway. Put New in the table Toolbar under `context.permissions.create`; refresh the list after save or delete. Server policy applies to every query. A scheduled job has no browser session and must use a private, bounded Flow with its own trusted data access.

## 3. Build pages with ordinary events

On a manager page, `EntityForm` sets field captions in
`fields={[{ name: "name", label: "Room name" }]}`, and a `Button` takes one of
the four variants `primary`, `secondary`, `ghost` and `danger`. For the
accepted properties, read the page with `code-get` and
`contractBlocks: ["EntityForm", "Button"]`.

Use `BookingApp` below as the target project name (adapt it to your project).
Create home/sign-in, `mine`, `manage` and `journal` pages **before** links. The
root Layout refreshes `CurrentUser` after navigation. Show management and journal
links only for MANAGER/ADMIN, and guard their pages before mounting tables.
The server model enforces the perimeter even if a user navigates directly.
Use `Status actionId="loginCall"` for transport/Flow errors. In a login button,
chain `CallSequence requestable=".DemoLogin"` (account only), then `Navigate`;
do not pass a role. For logout, pass `__disableAutologin=true` so the SDK cannot
replay sign-in. Navigate only in the successful login/logout action chain.

Write each of those Pages complete, in any order, with its final
`_flow.page.id`: a link to a Page not written yet is only a warning
(`FLOW_PAGE_LINK_UNKNOWN` at the build). Validate each Page. For
account/password sign-in, use the exact `Form` with `<Children>`, bound
`Input` States and adjacent `Status` in `flow://guide/frontend-svelte/forms`.

<!-- example: session-layout -->
```svelte
<script module>export const _flow = { sourceVersion: 2 };</script>
<FlowComponent $$id="sessionLayout">
  <Variables><State $$id="session" type="object" value={{ authenticated: false, user: null }} /></Variables>
  <Events><OnAfterNavigate $$id="refreshSession"><Actions>
    <CallSequence $$id="loadSession" requestable=".CurrentUser" $$out="layout.session" />
  </Actions></OnAfterNavigate></Events>
  <Structure>
    <AppShell $$id="shell" title="Bookings" userName={layout.session.user?.firstName ?? ""}>
      <Navigation><LinkButton $$id="mine" label="My bookings" page="mine" /></Navigation>
      <Tools><Button $$id="logout" label="Sign out" variant="ghost"><Events><OnClick $$id="signout"><Actions>
        <CallSequence $$id="logoutCall" requestable=".Logout"><Variables><Variable name="__disableAutologin" value={true} /></Variables></CallSequence>
        <Navigate $$id="goHome" page="home" />
      </Actions></OnClick></Events></Button></Tools>
      <Children><PageContent $$id="content" /></Children>
    </AppShell>
  </Structure>
</FlowComponent>
```

For the guarded `mine` page, use this editing chain. Omit `targetProject`: both
widgets call this application's `EntityGateway` (hidden, signed-in sessions), never a library Flow.
Only cross-project screens set `targetProject` to the other application.
`describe` returns effective capabilities: put New inside the table Toolbar
and test `context.permissions.create`; EntityForm hides denied save/delete
actions and sends `create` for a new row, `update` for an existing key.
MANAGER uses the same widgets: `app.entityAccess` decides the server perimeter.

The optional table `ownershipFilter="mine"` narrows an authorized result; it is
not the policy's typed `scope` and cannot grant access. Leave it unset for the
nominal path. A refusal answers 200 with `ok: false`: `ENTITY_UNAUTHENTICATED` invites sign-in,
`ENTITY_FORBIDDEN` reports a forbidden action, and 400 shows field validation when supplied. Native model validation can also return
422. A 409 shows the existing Reload command before retrying the stale row.
The widgets clear old rows while reloading after a permission/session change.

<!-- example: booking-editor -->
```svelte
<script module>export const _flow = { sourceVersion: 2, page: { id: "mine" } };</script>
<FlowComponent $$id="bookingEditor">
  <Variables>
    <State $$id="session" type="object" value={{ authenticated: false, user: null }} />
    <State $$id="row" type="object" value={null} />
    <State $$id="editing" type="boolean" value={false} />
    <State $$id="refresh" type="number" value={0} />
  </Variables>
  <Events><OnMount $$id="checkSession"><Actions>
    <CallSequence $$id="me" requestable=".CurrentUser" $$out="page.session" />
  </Actions></OnMount></Events>
  <Structure>
    <PageHeader $$id="heading" title="My bookings" />
    <Status $$id="sessionStatus" actionId="me" />
    <If $$id="authenticated" test={page.session.authenticated}><Then>
      <EntityTable $$id="bookings" entity="Reservation" refreshKey="@page.refresh">
        <Toolbar><If $$id="mayCreate" test={context.permissions.create}><Then>
          <Button $$id="create" label="New booking"><Events><OnClick $$id="new"><Actions>
            <SetValue $$id="clear" target="page.row" value={null} />
            <SetValue $$id="open" target="page.editing" value={true} />
          </Actions></OnClick></Events></Button>
        </Then></If></Toolbar>
        <Events><OnSelect $$id="select"><Actions>
          <SetValue $$id="keep" target="page.row" value="@event.value" />
          <SetValue $$id="edit" target="page.editing" value={true} />
        </Actions></OnSelect></Events>
      </EntityTable>
      <If $$id="editor" test={page.editing}><Then>
        <EntityForm $$id="form" entity="Reservation" row="@page.row">
          <Events>
            <OnSaved $$id="saved"><Actions>
              <SetValue $$id="closeSaved" target="page.editing" value={false} />
              <SetValue $$id="clearSaved" target="page.row" value={null} />
              <UpdateNumber $$id="refreshSaved" target="page.refresh" operation="increment" step={1} />
            </Actions></OnSaved>
            <OnDeleted $$id="deleted"><Actions>
              <SetValue $$id="closeDeleted" target="page.editing" value={false} />
              <SetValue $$id="clearDeleted" target="page.row" value={null} />
              <UpdateNumber $$id="refreshDeleted" target="page.refresh" operation="increment" step={1} />
            </Actions></OnDeleted>
            <OnCancel $$id="cancel"><Actions>
              <SetValue $$id="closeCancel" target="page.editing" value={false} />
              <SetValue $$id="clearCancel" target="page.row" value={null} />
            </Actions></OnCancel>
          </Events>
        </EntityForm>
      </Then></If>
    </Then><Else><Text $$id="loginRequired" text="Sign in to see your bookings." /></Else></If>
  </Structure>
</FlowComponent>
```

Add `EntityTable entity="Audit"` to the manager-guarded journal page. For a
custom cell, preserve the generic lexical snippet arguments described in
`flow://guide/entities`; do not copy widget internals or add browser scripts.

## Dashboard and list

For a CRM with Company, Contact and Deal, use the complete **Dashboard and list**
recipe in `flow://guide/entities/widgets/table`: AppShell sidebar with icon
links, four EntityStat cards, summed EntityBreakdown bars, a recent compact
EntityTable and company cells with a secondary domain, related contacts counts
and filtered pipeline sums. Keep the same session, create capability guards,
record routes and refreshKey wiring as the pages here. Read that drawer before
writing the dashboard or list; it includes the model gateway allowlists.

Dashboard and list page structures, after declaring the CRM model and routes
of that recipe (place each in the shared AppShell's Children):

```svelte
<script module>export const _flow = { sourceVersion: 2, page: { id: "crmDashboard" } };</script>
<FlowComponent $$id="crmDashboard"><Structure>
  <PageHeader $$id="header" title="Dashboard" description="Your pipeline at a glance"><Tools><LinkButton $$id="add" page="newDeal" label="Add deal" variant="primary" /></Tools></PageHeader>
  <EntityStat $$id="pipeline" entity="Deal" label="Open pipeline" icon="trending-up-outline" sum="amount" currency="USD" filter={{stage:["Lead","Qualified","Proposal"]}} />
  <EntityBreakdown $$id="stages" entity="Deal" label="Deals by stage" groupBy="stage" sum="amount" currency="USD" allValues={true} />
  <EntityTable $$id="recent" entity="Deal" caption="Recently updated deals" layout="compact" subtitleFields={["companyId","contactId"]} badgeField="stage" amountField="amount" currency="USD" pageSize={5} viewPage="deal" />
</Structure></FlowComponent>
```

```svelte
<script module>export const _flow = { sourceVersion: 2, page: { id: "crmCompanies" } };</script>
<FlowComponent $$id="crmCompanies"><Structure>
  <PageHeader $$id="header" title="Companies"><Tools><LinkButton $$id="add" page="newCompany" label="Add company" variant="primary" /></Tools></PageHeader>
  <EntityTable $$id="companies" entity="Company" labels={{search:"Search company names"}} columns={[{path:"companyName",label:"Company",secondary:{path:"domain",monospace:true}},{path:"industry"},{path:"city",label:"Location",secondary:"country"},{path:"employees",format:"number"}]} counts={[{as:"contacts",entity:"Contact",via:"companyId"}]} sums={[{as:"openPipeline",entity:"Deal",via:"companyId",sum:"amount",currency:"USD",filter:{stage:["Lead","Qualified","Proposal"]}}]} viewPage="company" />
</Structure></FlowComponent>
```
