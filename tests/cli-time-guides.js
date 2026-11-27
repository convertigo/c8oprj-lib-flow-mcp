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

test("browser proofs check option labels before selecting and defer downloads to the CSV guide", () => {
  const source = guide("frontend-svelte/proof.md");
  assert.match(source, /option labels[\s\S]{0,200}selectOption|selectOption[\s\S]{0,200}option labels/);
  assert.match(source, /flow:\/\/guide\/crud\/business\/csv/);
  assert.doesNotMatch(source, /waitForEvent\("download"\)/);
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

test("the CSV proof downloads through the page and sets the type in the Flow", () => {
  const paragraphs = guide("multipage-entities/proof.md").split(/\n\s*\n/);
  assert.ok(paragraphs.some(text => /\bCSV\b/i.test(text) && /\bdownload\w*\b/i.test(text) && /\bpage\b/i.test(text)),
    "CSV download from the page");
  assert.ok(paragraphs.some(text => text.includes("file.respond") && text.includes("mimeType") && text.includes("text/csv")),
    "CSV response type in the Flow");
});

test("the room form and its button use the public component contracts", () => {
  const pages = guide("multipage-entities/pages.md");
  assert.match(pages, /fields=\{\[\{\s*name: "name",\s*label: "[^"]+"/);
  for (const variant of ["primary", "secondary", "ghost", "danger"]) {
    assert.ok(pages.includes("`" + variant + "`"), variant);
  }
  assert.match(pages, /contractBlocks:\s*\["EntityForm", "Button"\]/);
});
