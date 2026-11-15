# Flow Svelte Known Limits

Read when dynamic routes, Await slots or literal braces fail validation.

## Known Limits

- On a server that predates bracketed paths, dynamic routes such as
  `product/[id]` fail with HTTP 400 in the dev viewer. There, use a static
  Page, pass the id with `Navigate` `Query`, and read `@route.query.id`
  (see `flow://guide/frontend-svelte-routing`).
- `Await` announces a `pending` slot that the model refuses (`Undeclared slot
  "pending"`); show progress with `Status` instead.
- A literal containing braces was reported to break project-wide validation
  without naming the file; keep braces inside `{expression}` values.
