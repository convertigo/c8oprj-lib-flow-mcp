const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

function guide(path) {
  const text = readFileSync(join(__dirname, "../_flow/resources/guide", path), "utf8");
  assert.ok(text.length <= 12000, path + " exceeds the guide budget");
  return text.replace(/\s+/g, " ");
}

test("a detail page behind a session guard loads when it mounts", () => {
  const actions = guide("frontend-svelte/actions.md");
  const routeBinding = /<EntityView\b[^>]*\brouteId="@route\.params\.id"/;
  assert.doesNotMatch(actions, /`OnAfterNavigate`[^.]*\bfirst display\b/);
  assert.match(actions, routeBinding);
  const mount = actions.match(/<OnMount\b[^>]*>(.*?)<\/OnMount>/)?.[1] ?? "";
  assert.match(mount, /<CallSequence\b[^>]*\$\$out="page\.record"/);
  assert.match(guide("entities/widgets/view.md"), routeBinding);
});

test("EntityForm leaves the trimmed note validation to the server", () => {
  const form = guide("entities/widgets/form.md");
  assert.match(form, /\brequired:\s*false\b/);
  assert.match(form, /`beforeSave`.*?\btrim\(\)/);
});

test("the anonymous HTTP contract example requests a stateless session in the POST body", () => {
  const section = guide("authoring/blocks.md").split("## Proving an HTTP contract")[1]?.split("## ")[0] ?? "";
  const body = section.match(/`body:\s*\{([^}]*)\}`/)?.[1] ?? "";
  assert.match(body, /\b__removeSession:\s*"true"/);
});
