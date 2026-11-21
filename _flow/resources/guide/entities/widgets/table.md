# EntityTable business screens

Read before configuring an entity list, actions, paging or columns.

## Tables for business screens

Columns default to visible `describe` fields; override with ordered `columns`
entries `{path,label,format,labels,tones,order,cellSlot}`. Fields removed by the
server cannot be restored. An explicit column may include `table:false`
computed fields, for example `dateEcheance` from the `Échéance` trait.
Enum values in the model may be strings or `{value,label,tone}`. Stored values
stay strings; `describe` adds label/tone maps and `timeZone`. Dates use
`dd/MM/yyyy`; table and record view share formatting. A timestamp without an
offset is already local time in the model's zone.

Use `filters={[{field:"statut"},{field:"responsableId"},{field:"actif"}]}` for enum,
searchable relation and boolean controls; dates and text also work. A filter's
`op` is an `entity.list` operator: `eq` by default, `contains`, or one bound,
`gt`, `gte`, `lt`, `lte`; `{field:"dateDebut",op:"gte",label:"Du"}` and
`{field:"dateDebut",op:"lte",label:"Au"}` make an inclusive date range. An optional
base `filter` is ANDed with all controls on the server. Admin lists offering
inactive rows set `active="all"`; neither control grants that access. Search,
sort and pagination are server operations, and ordinary page/sort changes keep
the previous page visible while controls are disabled. `refreshKey` clears old
identity data: change it after a session change as well as after a write.
`caption` names the table (its accessible name and title; the entity label by
default): a heading above the table does not name it.

`orderBy="dateEcheance" direction="asc"` sets the initial server sort; headers
remain sortable. Identity refresh restores it; changing either property resets
paging and selection. For a due queue, counter and alert contract, read
`flow://guide/entities/widgets/deadlines`.

Default View/Edit actions raise `OnView`/`OnEdit`, plus compatible `OnSelect`.
Wire them to an editor/record view, or set `viewPage`/`editPage` to the logical
page id. Dynamic route parameters come from `row.key`; `[id]` also aliases the single
identity field when its model name differs. There, `EntityForm` and `EntityView`
take `routeId="@route.params.id"`. Activation sends only
key, revision and the active-field change through the gateway. Its rule must
live in a model hook, not only in a calling Flow. An `Actions` slot replaces
defaults, including in read-only sessions where it may offer View. An empty
`<Actions></Actions>` is dropped and keeps the defaults.

`selectable` plus `bulkActions={[{id:"declare",label:"Déclarer"}]}` raises
`OnBulkAction` with `{action,keys}`; `OnSelectionChange` and bindable `selected`
expose the array of exact object keys. Keep it as an array in page state when
opening a local form. Typed URL arrays belong to the separate route change;
never count the characters of a serialized query parameter. Every business
command must authorize every key on the server. `exportable` downloads the
formatted current page only; complete exports use a checked server command
from Toolbar, as in `flow://guide/multipage-entities/operations`.

For a complete filtered CSV, set `exportFlow` to an application Flow calling
`entity.exportCsv`; read `flow://guide/entities/exports` for the server limits,
list policy and a page with a real download button.

## Dashboard and list: companies, contacts and deals

Declare `Company` (companyName, domain, industry, city, country, employees),
`Contact` (fullName, companyId relation), and `Deal` (title, companyId relation,
contactId relation, stage enum, amount decimal, updatedAt timestamp).
The relation labels are Company.companyName and Contact.fullName. Set
`Deal.gateway.aggregate: [companyId, stage, amount]` and
`Contact.gateway.aggregate: [companyId]`. Declare stage values with readable
labels; tones are optional. Keep the application read policy as the authority
for every row, relation label and measure. Declare `updatedAt` as
`{type: "timestamp", auto: "update", readOnly: true, table: false}`: the server
writes it at every save, and the recent list sorts on it. The trait `Horodaté`
adds `dateCreation` and `dateModification` instead, never `updatedAt`: with it,
sort with `orderBy="dateModification"`.

Use AppShell `layout="sidebar"`, named LinkButton entries with `icon`, and
`userName` from CurrentUser. Tools contains the existing Logout action. Keep
Dashboard, Companies, Contacts and Deals as page ids and labels. Add a page
header with its title, subtitle and a primary LinkButton to the creation page.
Guard creation actions with the session's effective create capability.

Dashboard structure (the model and pages already exist):

```svelte
<script module>export const _flow = { sourceVersion: 2, page: { id: "dashboard" } };</script>
<FlowComponent $$id="dashboard"><Variables><State $$id="userName" type="string" value="" /></Variables><Structure>
  <AppShell $$id="shell" title="CRM" layout="sidebar" userName="@page.userName">
    <Navigation>
      <LinkButton $$id="navDashboard" page="dashboard" label="Dashboard" icon="grid-outline" />
      <LinkButton $$id="navCompanies" page="companies" label="Companies" icon="business-outline" />
      <LinkButton $$id="navContacts" page="contacts" label="Contacts" icon="people-outline" />
      <LinkButton $$id="navDeals" page="deals" label="Deals" icon="briefcase-outline" />
    </Navigation>
    <Children>
      <PageHeader $$id="heading" title="Dashboard" description="Your pipeline at a glance"><Tools><LinkButton $$id="addDeal" page="newDeal" label="Add deal" variant="primary" /></Tools></PageHeader>
      <GridLayout $$id="stats" minColumnWidth="220px"><Children>
        <EntityStat $$id="pipeline" entity="Deal" label="Open pipeline" sum="amount" currency="USD" icon="trending-up-outline" tone="info" filter={{stage:["Lead","Qualified","Proposal"]}} />
        <EntityStat $$id="won" entity="Deal" label="Closed value" sum="amount" currency="USD" icon="checkmark-circle-outline" tone="success" filter={{stage:"Won"}} />
        <EntityStat $$id="companies" entity="Company" label="Companies" hint="View all companies" icon="business-outline" page="companies" />
        <EntityStat $$id="contacts" entity="Contact" label="Contacts" hint="View all contacts" icon="people-outline" page="contacts" />
      </Children></GridLayout>
      <Card $$id="stagesCard"><Children><EntityBreakdown $$id="stages" entity="Deal" label="Deals by stage" groupBy="stage" sum="amount" currency="USD" allValues={true} /></Children></Card>
      <Card $$id="recentCard"><Children><EntityTable $$id="recent" entity="Deal" caption="Recently updated deals" layout="compact" titleField="title" subtitleFields={["companyId","contactId"]} badgeField="stage" amountField="amount" currency="USD" orderBy="updatedAt" direction="desc" pageSize={5} viewPage="deal" />
      <LinkButton $$id="allDeals" page="deals" label="All deals" variant="link" /></Children></Card>
    </Children>
  </AppShell>
</Structure></FlowComponent>
```

The four metrics accept `hint` for a short explanatory line. For dynamic
"13 open deals" and "5 deals closed", use each EntityStat Loaded result to
update a declared state hint; keep amounts server-aggregated. Add Add deal
and Add company with the existing create page links and capability guard.

Company list (place inside the same shell's Children):

```svelte
<script module>export const _flow = { sourceVersion: 2, page: { id: "companies" } };</script>
<FlowComponent $$id="companies"><Structure>
  <PageHeader $$id="heading" title="Companies"><Tools><LinkButton $$id="addCompany" page="newCompany" label="Add company" variant="primary" /></Tools></PageHeader>
  <EntityTable $$id="list" entity="Company" caption="Companies" labels={{search:"Search company names"}} columns={[{path:"companyName",label:"Company",secondary:{path:"domain",monospace:true}},{path:"industry"},{path:"city",label:"Location",secondary:"country"},{path:"employees",format:"number"}]} counts={[{as:"contacts",label:"Contacts",entity:"Contact",via:"companyId"}]} sums={[{as:"pipeline",label:"Open pipeline",entity:"Deal",via:"companyId",sum:"amount",currency:"USD",filter:{stage:["Lead","Qualified","Proposal"]}}]} viewPage="company" />
</Structure></FlowComponent>
```

Search uses the model title by default. Its single label is supplied by labels.search; do not add a separate search-help text.
Use the authorized list total for the header subtitle "13 companies"; never
count a downloaded page. All examples use the application's gateway, without
targetProject. Wire refreshKey to session changes and completed writes.

Defaults: camelCase field names become readable labels; technical identity and
revision fields stay out of automatic tables, record sections and forms.
Enum badges have a stable accessible palette derived only from their visible
value; explicit tones win. A summed EntityBreakdown defaults to bars showing
label, amount, row count and proportional track; `display="cards"` restores
cards. Table `secondary` supports a field name or `{path,format,monospace}`;
a field absent from describe cannot appear. `sums` is computed by one server
grouped query per column for this page's keys, under the related entity policy
and gateway authorization. Related summaries support SQL entities; provider-backed entities are omitted.
Both via and sum must be enabled; an unreadable or
refused sum is omitted, never shown as zero. `layout="compact"` uses authorized
relation labels, viewPage record links, server sorting and a bounded pageSize
(1..50). Without orderBy it sorts on updatedAt, descending, when the model
declares it, else on the identity.

Bar counts use the current public model label, with optional `labelSingular` and `labelPlural` for explicit grammatical forms (for example `label: "Deal", labelPlural: "Deals"`). Common English/French statuses receive semantic tones before the stable fallback; explicit tones win. Sidebar layout keeps a full-height rail on mobile.
