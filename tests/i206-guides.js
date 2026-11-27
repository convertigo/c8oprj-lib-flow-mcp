const assert = require("node:assert/strict");
const { readFileSync, readdirSync } = require("node:fs");
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

test("the Flow result proof names the execution tools for both modes", () => {
  const sections = guide("authoring/blocks.md").split(" ## ");
  const tools = ["requestable-execute", "code-run", "c8o call"];
  assert.ok(sections.some(section => tools.every(tool => section.includes(tool))),
    "one section should explain the MCP and file-mode execution tools together");
});

function checkProofInstructions(section, file) {
  const proof = /\b(proof|prov(?:e|ing)|test(?:ing)?|verif(?:y|ication)|check)\b/i;
  const server = /__sequence|\/projects\/|\.bin\b|\b(?:requester|requestable|localhost|(?:the|this|Convertigo) server)\b/i;
  const client = /\b(?:endpoint\.current|curl|fetch)\b/i;
  const heading = section.split("\n", 1)[0];
  for (const paragraph of section.split(/\n\s*\n/)) {
    if (!client.test(paragraph) || !(proof.test(heading) || proof.test(paragraph) || server.test(paragraph))) continue;
    for (const sentence of paragraph.replace(/\s+/g, " ").split(/[.!?]\s+/)) {
      if (client.test(sentence)) {
        assert.match(sentence, /\b(?:do not|never|avoid|skip|without)\b[^,;]*?\b(?:endpoint\.current|curl|fetch)\b/i,
          file + ": " + sentence);
      }
    }
  }
}

test("guides and skills do not recommend HTTP clients or self-calls for proof", () => {
  for (const directory of ["guide", "skills"]) {
    const root = join(__dirname, "../_flow/resources", directory);
    for (const file of readdirSync(root, { recursive: true }).filter(name => name.endsWith(".md"))) {
      const sections = readFileSync(join(root, file), "utf8").split(/^#{1,6} /m);
      for (const section of sections) checkProofInstructions(section, file);
    }
  }
});

test("the CLI skill does not present --json as proof of cookies", () => {
  const skill = readFileSync(join(__dirname, "../_flow/resources/skills/convertigo-flow-cli/SKILL.md"), "utf8");
  for (const sentence of skill.replace(/\s+/g, " ").split(/[.!?]\s+/)) {
    if (sentence.includes("--json") && /\bcookies?\b/i.test(sentence)) assert.match(sentence, /\b(?:not|never|avoid)\b/i);
  }
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

test("an exact error body is a result: only a throw rolls back and stops the caller", () => {
  const data = guide("authoring/data.md");
  const after = data.split(/return \{ error: \{ code: "BAD_INPUT"[^`]*`\./)[1]?.split("`response.error(")[0] ?? "";
  assert.match(after, /`return` does not roll back a `sql\.transaction` or stop a calling Flow: `throw` does/);
});

test("SQL decimals are exact text, a Java BigDecimal a JSON number", () => {
  const outputs = guide("authoring/data.md").split("## Output schemas")[1]?.split(" ## ")[0] ?? "";
  assert.match(outputs, /Java `BigDecimal`/);
  assert.match(outputs, /`lib_flow_sql`[^.]*exact text/);
});
