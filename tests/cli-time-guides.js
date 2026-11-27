const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

function guide(path) {
  return readFileSync(join(__dirname, "../_flow/resources/guide", path), "utf8");
}

function exampleWith(source, language, marker) {
  for (const [, tag, body] of source.matchAll(/^```(\w+)\n([\s\S]*?)^```/gm)) {
    if (tag === language && body.includes(marker)) return body;
  }
  return "";
}

test("the export filter is checked by accessible name before waiting for the download", () => {
  const source = guide("frontend-svelte/proof.md");
  const example = exampleWith(source, "javascript", 'getByRole("combobox"');
  assert.match(example, /getByRole\("form", \{ name: "[^"]+"/);
  assert.match(example, /getByRole\("combobox", \{ name: "[^"]+"/);
  assert.match(example, /locator\("option"\).*toHaveText\(\[[^\]]*"Open"[^\]]*\]\)[\s\S]*selectOption\(\{ label: "Open" \}\)/);
  assert.match(example, /waitForEvent\("download"\)[\s\S]*getByRole\("button"[^\n]*\.click\(\)[\s\S]*await download/);
  assert.doesNotMatch(example, /waitForTimeout/);
});

test("the booking policy uses the request alias and checks the block in isolation", () => {
  const source = guide("multipage-entities/access.md").split("<!-- example: booking-access-policy -->")[1] ?? "";
  const [block, after] = source.split("```").slice(1, 3);
  assert.match(block, /const req = input\.request\b/);
  assert.doesNotMatch(block, /const request\b/);
  assert.match(block, /req\.entity === "Reservation"[\s\S]*scope: \{ owner: req\.user \}/);
  assert.match(after, /reserves `request`/);
  assert.match(after, /c8o check _flow\/blocks\/app\/entityAccess\.block\.js/);
});

test("the CSV proof checks the served file and identifies the caller", () => {
  const proof = guide("multipage-entities/proof.md");
  const paragraph = proof.split(/\n\s*\n/).find(text => text.includes("--anonymous --json")) ?? "";
  assert.match(paragraph, /c8o call \w+ --anonymous --json/);
  assert.match(paragraph, /--as \w+ --json/);
  for (const marker of [".bin", "file.respond", "Content-Type", "text/csv", "header", "row"]) {
    assert.ok(paragraph.includes(marker), marker);
  }
});

test("the room form and its navigation button use the public component contracts", () => {
  const pages = guide("multipage-entities/pages.md");
  const example = exampleWith(pages, "svelte", 'entity="Room"');
  assert.match(example, /<EntityForm\b[^>]*entity="Room"[^>]*fields=\{\[\{\s*name: "name",\s*label: "[^"]+"/);
  assert.match(example, /<Button\b[^>]*variant="secondary"/);
  assert.match(example, /<Navigate\b[^>]*page="mine"/);
  for (const variant of ["primary", "secondary", "ghost", "danger"]) {
    assert.ok(pages.includes("`" + variant + "`"), variant);
  }
  assert.match(pages, /contractBlocks:\s*\["EntityForm", "Button"\]/);
});

test("the entry guide names the CSV and SQL transaction blocks before the quick path", () => {
  const intro = guide("multipage-entities.md").split(/^## /m)[0];
  assert.match(intro, /CSV export[^.]*`data\.csv`[^.]*`file\.respond`/i);
  assert.match(intro, /SQL transaction[^.]*`sql\.transaction`/i);
});
