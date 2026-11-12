# Flow Svelte POC Acceptance And Browser Proof

What an application and a POC must prove, the safe Playwright plan, the verifier sub-agent, browser-verify and the visual checklist before handing over.

Sub-guide of `flow://guide/frontend-svelte`: read that entry guide first for the authoring loop.

## Application Acceptance

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
connection or with the account of a real person.

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
images and documented `data-*` attributes; `$$id`s are not DOM ids. On
failure, allow one focused browser diagnostic instead of an exploratory test
campaign. Do not infer that a network-backed component works from its
container size: for maps, confirm one tile image has `naturalWidth > 0`, and
apply the equivalent resource check to other visualizations.

Delegate a multi-step proof (sign-in, a path through several pages, a form
submitted then the list that shows the result) to a verifier sub-agent: its
clicks, snapshots and waits stay out of your context, and its vision model
also checks the rendering.

```text
subagent-run({ profile:"verifier",
  task:"Prove that a signed-in member submits two requests.",
  inputs:{ url:"<openUrl of dev.sync or dev.open>",
    paths:["Sign in as member.demo / demo", "Select two requests, submit them"],
    checks:["Both statuses become \"Submitted\""],
    hints:"demo accounts: member.demo / demo" } })
-> status:"running", runId -> subagent-run({ runId }) until the report
```

When your tool list offers it, use `browser-verify` with `checks` for one
visual check of the current page, otherwise one screenshot through the
Playwright of your host, and a Playwright evaluation only for one DOM or
timing measure.

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
read-only: fix what it reports with the Flow tools, then run it again on the
failed paths only.
