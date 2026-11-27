# Flow Svelte POC Acceptance And Browser Proof

What an application and a POC must prove, the safe Playwright plan, the verifier sub-agent, browser-verify and the visual checklist before handing over.

## Application Acceptance

Before building, write the acceptance table from the specification: one line per
criterion that goes through a screen, with the path a user walks and an empty
seen column; fill its seen column during the walk. The seen column says what showed (the
message, the page, the count of rows), never a password, a token or personal
data; a path names the test account, not its password.

An application built from a specification is done only when each of its
acceptance criteria that goes through a screen has been walked in the browser,
as its user would: open the page from the navigation, fill the form, submit
it, read the result on the screen (the list, the message, the next page). For
each form, also submit one value the specification refuses: its message must
show on the screen. Leave each list page and come back: the list must show
again. A criterion proved only by a direct Flow call is not proved on the
screen. Give these walks as the `paths` and `checks` of the verifier below (or
of a sub-agent of your host), fix what fails, walk the failed paths again,
and end the handoff with one line per criterion: criterion, path, what the
screen showed. A simple page without a specification keeps the single proof.
Walk on the development database or the demo data, signed in with the test
accounts of the project seed; a path that sends an email or calls an outside
service uses the development settings; never walk against a production
connection or with the account of a real person. To sign in from the browser
without a page, call the sign-in Flow with form fields or query parameters
(`fetch(url, { method: "POST", body: new URLSearchParams({ user }) })`): a
requestable called by its URL reads them, not a JSON body.

## POC Acceptance

A POC proves the requested path, including its Page transitions and requested
content. It may defer exhaustive history, offline restoration, responsive
coverage and polish. It may not stack downstream business steps in one
scrolling Page.

Execute the safe Playwright plan of `openBuilt` (`acceptance.calls`; `build`
gives it with `detail:"full"`). For handoff, put the page URL first in your
final answer: prefer the `openBuilt` URL after a build. A `dev.sync` or
`dev.open` URL works only while the dev server runs; it stops 2 min after the
last viewer leaves by default (15 min if no viewer ever connects). Prefer roles, visible text,
images and documented `data-*` attributes; `$$id`s are not DOM ids. On failure, keep each diagnostic on a failed path, and go on while a fix resolves an identified failure; report a blocker when no next step remains, never an exploratory test campaign. Do not infer that a network-backed component works from its
container size: for maps, confirm one tile image has `naturalWidth > 0`, and
apply the equivalent resource check to other visualizations.

In a Playwright Test with the export page open, use the accessible names and
option labels from that page. This example uses an English booking form.

```javascript
const form = page.getByRole("form", { name: "Export bookings", exact: true })
const status = form.getByRole("combobox", { name: "Status", exact: true })
await expect(status.locator("option")).toHaveText(["All statuses", "Open", "Cancelled"])
await status.selectOption({ label: "Open" })
const download = page.waitForEvent("download")
await form.getByRole("button", { name: "Export CSV", exact: true }).click()
const file = await download
expect(await file.failure()).toBeNull()
```

The option assertion reports a missing or changed label before a 30-second
selection timeout, and subscribing before the click catches a fast download.

Delegate a multi-step proof (sign-in, a path through several pages, a form
submitted then the list that shows the result) to a verifier sub-agent: its
clicks, snapshots and waits stay out of your context, and its vision model
also checks the rendering.

Reuse the current browser context. Open at most one additional context per
role (for example, USER and manager), and keep it through that role's checks.
Sign out in the application (`SignOut`/`Logout`) before closing an unused test
context; closing it alone leaves its Convertigo session alive. The development
engine allows only 5 HTTP sessions in Standard Edition, and each browser
context can occupy one for 30 minutes. If all MCP calls suddenly fail without
a readable response, suspect the session limit: sign out and close test
contexts, retry once, and report it.

```text
subagent-run({ profile:"verifier",
  task:"Prove the loan page for a member, a librarian and a member at the loan limit.",
  inputs:{ url:"<openUrl of dev.sync or dev.open>",
    paths:["Member: open loans and borrow an available book",
      "Librarian: open loans", "Member at loan limit: try an available book"],
    checks:["Accessible heading Prêts; tables named Mes prêts or Tous les prêts and Catalogue",
      "Borrow action only for the member on available rows",
      "Loan limit refusal is visible and the loan list is unchanged"],
    hints:"Use the configured demo accounts and an available book for the refusal" } })
-> status:"running", runId -> subagent-run({ runId }) until the report
```

When your tool list offers it, use `browser-verify` with `checks` for one
visual check of the current page, otherwise one screenshot through the
Playwright of your host, and a Playwright evaluation only for one DOM or
timing measure.

In browser tools, `browser_wait_for.time` is in **seconds**, at most 30:
use `2`, never `2000`.

Check heading roles and table accessible names, not only visible text:
`Text variant="title"` is a paragraph; use `PageHeader` or
`Heading level="1"`. Find tables by caption. Check both present and absent
actions for each role and row state (`flow://guide/multipage-roles/pages`).
For a server refusal, check the application error and visible `Status`, then
read the state again to prove no write occurred; HTTP 200 alone is insufficient.

Before handing a frontend over, when your tool list offers it, have the
verifier or `browser-verify` apply the visual checklist, passed as `checks`,
otherwise one screenshot through the Playwright of your host per case (light
and dark, 1366px and 390px wide):

- an `AppShell` (or a `Header`) carries the navigation, its current page
  highlighted, and the user and logout;
- each Page starts with a `PageHeader`; one primary button per area;
- records are in a `DataTable`, not in stacked full-width cards of texts;
  dates and numbers formatted;
- every status is a badge with a semantic tone, never a colored `Text`;
- no stray status text such as "Completed."; a command reports its success
  with a toast; an empty list shows an `EmptyState` or its table `emptyText`;
- form fields grouped in `FormSection`s with labels;
- no horizontal overflow of the page at 390px; tables scroll in their surface. The verifier is
read-only: allow one run and at most two reruns after focused repairs, on failed
paths only. Collecting the same `runId` does not count as a rerun; report checks
left undone when that limit is reached.
