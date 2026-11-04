import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const provider = process.env.FLOW_FRONTBUILDER_RESOURCE_ROOT!;
const guides = process.env.FLOW_GUIDE_TEST_ROOT || resolve(import.meta.dirname, "../../_flow/resources/guide");
const { layoutPageFixture } = await import(pathToFileURL(resolve(provider, "src-builder/generatedLayoutFixture.ts")).href);
const { describeDocument } = await import(pathToFileURL(resolve(provider, "src-builder/frontDocument.ts")).href);
const blankLayout = '<script module>export const _flow = {sourceVersion: 2};</script><FlowComponent $$id="root"><Structure><PageContent $$id="content" /></Structure></FlowComponent>';
const blankPage = '<script module>export const _flow = {sourceVersion: 2};</script><FlowComponent $$id="home"><Structure><Text $$id="homeText" text="Home" /></Structure></FlowComponent>';

async function example(guide: string, id: string) {
  const text = await readFile(resolve(guides, guide + ".md"), "utf8");
  const examples = Array.from(text.matchAll(/```svelte\n([\s\S]*?)```/g), match => match[1]);
  const source = examples.find(source => source.includes(`<FlowComponent $$id="${id}"`));
  assert.ok(source, `${guide} must show the complete ${id} example`);
  return source;
}

for (const guide of ["frontend-svelte", "multipage-roles"]) {
  test(`${guide}: the documented layout refreshes the session after sign-in and sign-out navigation`, async t => {
    const layout = await example(guide, "sessionLayout");
    assert.doesNotMatch(layout, /<Navigate\b/, "Session refresh must not redirect on every navigation");
    const answers = { ".CurrentUser": { authenticated: false, user: null } } as Record<string, unknown>;
    const f = await layoutPageFixture(t, layout, blankPage, answers);
    assert.deepEqual(f.doc.diagnostics.filter((d: any) => d.level === "error"), []);
    assert.equal(f.calls.filter((call: string) => call === ".CurrentUser").length, 1);
    answers[".CurrentUser"] = { authenticated: true, user: { firstName: "Alice", role: "MANAGER" } };
    await f.navigate("/mine");
    assert.match(f.text(), /Alice/);
    assert.equal(f.calls.filter((call: string) => call === ".CurrentUser").length, 2, "A mounted layout must reload on navigation");
    answers[".CurrentUser"] = { authenticated: false, user: null };
    await f.navigate("/");
    assert.doesNotMatch(f.text(), /Alice/);
    assert.equal(f.calls.filter((call: string) => call === ".CurrentUser").length, 3);
    assert.deepEqual(f.errors, []);
  });
}

test("the documented server table sends paging, filter and sort parameters to the Flow", async t => {
  const page = await example("frontend-svelte", "serverBookings");
  const rows = (start: number) => Array.from({ length: 10 }, (_, index) => ({ id: start + index, room: `Room ${start + index}` }));
  const answers = { ".ListBookings": { items: rows(1), total: 25 } } as Record<string, unknown>;
  const f = await layoutPageFixture(t, blankLayout, page, answers);
  assert.deepEqual(f.doc.diagnostics.filter((d: any) => d.level === "error"), []);
  const parameters = () => JSON.parse(JSON.stringify(f.requests.at(-1).parameters));
  assert.deepEqual(parameters(), { offset: 0, limit: 10, query: "", sortKey: "", sortDirection: "none" });
  const palette = describeDocument(f.doc).palette as Array<Record<string, any>>;
  const table = palette.find(item => item.id === "svelte.dataTable")!;
  assert.match(table.properties.serverSide.description, /@event\.value\.offset/);
  assert.match(table.events.change.description, /zero-based/);
  assert.deepEqual(Object.keys(table.events.change.schema.properties), ["query", "sortKey", "sortDirection", "offset", "pageSize"]);
  const pause = () => new Promise(done => f.dom.window.setTimeout(done, 70));
  answers[".ListBookings"] = { items: rows(11), total: 25 };
  (f.dom.window.document.querySelector('button[aria-label="Next page"]') as HTMLButtonElement).click();
  await pause();
  assert.deepEqual(parameters(), { offset: 10, limit: 10, query: "", sortKey: "", sortDirection: "none" });
  assert.match(f.text(), /11–20 of 25/);
  assert.match(f.text(), /Room 11/);
  assert.doesNotMatch(f.text(), /Room 1\b/);
  const input = f.dom.window.document.querySelector('input[type="search"]') as HTMLInputElement;
  input.value = "Alice";
  input.dispatchEvent(new f.dom.window.Event("input", { bubbles: true }));
  await pause();
  assert.deepEqual(parameters(), { offset: 0, limit: 10, query: "Alice", sortKey: "", sortDirection: "none" });
  (f.dom.window.document.querySelector('button[aria-label="Sort ascending: Room"]') as HTMLButtonElement).click();
  await pause();
  assert.deepEqual(parameters(), { offset: 0, limit: 10, query: "Alice", sortKey: "room", sortDirection: "asc" });
  assert.deepEqual(f.errors, []);
});

test('the documented natural Svelte page binds input, updates state and renders keyed items', async t => {
  const source = await example('frontend-svelte', 'naturalSvelte');
  const f = await layoutPageFixture(t, blankLayout, source, {});
  assert.deepEqual(f.doc.diagnostics.filter((d: any) => d.level === 'error'), []);
  assert.equal(f.dom.window.document.querySelector('h1')?.textContent, 'Hello Ada');
  assert.equal(f.dom.window.document.querySelector('li')?.textContent, 'Guide');
  f.dom.window.document.querySelector('button')!.click();
  const input = f.dom.window.document.querySelector('input')!;
  input.value = 'Lin'; input.dispatchEvent(new f.dom.window.Event('input', {bubbles:true}));
  await new Promise(done => f.dom.window.setTimeout(done, 40));
  assert.equal(f.dom.window.document.querySelector('h1')?.textContent, 'Hello Lin');
  assert.match(f.text(), /Count: 1/);
  assert.deepEqual(f.errors, []);
});

test('the documented layout containers keep their slots, properties and rendered contents', async t => {
  const source = await example('frontend-svelte', 'layoutBasics');
  const f = await layoutPageFixture(t, blankLayout, source, {});
  assert.deepEqual(f.doc.diagnostics.filter((d: any) => d.level === 'error'), []);
  assert.match(f.text(), /Library.*Available resources.*2 resources.*Refresh.*Guide.*Examples/);
  const nodes = (items: any[]): any[] => items.flatMap(node => [node, ...nodes(node.children || [])]);
  const byId = new Map(nodes(f.doc.pageNodes).map(node => [node.id, node]));
  for (const [id, tag] of [['frame','PageShell'],['column','ColumnLayout'],['heading','PageHeader'],['toolbar','RowLayout'],['cards','GridLayout'],['first','Card'],['second','Card']]) {
    assert.equal(byId.get(id)?.tag, tag);
  }
  assert.equal(byId.get('toolbar').props.justify.value, 'space-between');
  assert.equal(byId.get('cards').props.minColumnWidth, '220px');
  assert.deepEqual(f.errors, []);
});
