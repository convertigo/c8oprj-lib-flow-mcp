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

test("the first throw example also shows how to return exact public error fields", () => {
  const data = guide("authoring/data.md");
  const firstThrow = data.match(/\bthrow\s+\{[^}]+\}.*?(?=`response\.| ## |$)/)?.[0] ?? "";
  assert.match(firstThrow, /\benvelope\b/);
  assert.match(firstThrow, /return\s+\{\s*error:\s*\{\s*code:\s*"[^"]+",\s*message:\s*"[^"]+"\s*\}\s*\}/);
});

test("the CLI skill opens with a sources example that publishes and calls its public Flow", () => {
  const skill = readFileSync(join(__dirname, "../_flow/resources/skills/convertigo-flow-cli/SKILL.md"), "utf8");
  assert.ok(Buffer.byteLength(skill) < 4500, "CLI skill exceeds its byte budget");
  assert.equal(skill.match(/`(c8o [^`]+)`/)?.[1], "c8o guide sources");
  const example = guide("sources.md").split(" ## ")[1] ?? "";
  const name = example.match(/_flow\/flows\/(\w+)\.flow\.js/)?.[1];
  assert.ok(name, "missing Flow filename");
  assert.match(example, /_flow\/resources\/sql\//);
  assert.match(example, /sourceVersion:\s*3\b/);
  assert.match(example, /accessibility:\s*"public"/);
  assert.ok(example.includes("function " + name + "("));
  assert.match(example, /return\s+\{[^}]+\}/);
  assert.match(example, new RegExp("\\bc8o check\\b.*?\\bc8o sync\\b.*?\\bc8o call " + name + "\\b"));
});

test("numeric output guidance checks a large decimal as a JSON number", () => {
  const outputs = guide("authoring/data.md").split("## Output schemas")[1]?.split(" ## ")[0] ?? "";
  assert.match(outputs, /flow:\/\/guide\/rhino-block-api/);
  assert.match(outputs, /BigDecimal/);
  assert.match(outputs, /double precision/i);
  assert.match(outputs, /`null`/);
  assert.match(outputs, /\.\w+\s*===\s*\d{10,}\.\d+\b/);
});
