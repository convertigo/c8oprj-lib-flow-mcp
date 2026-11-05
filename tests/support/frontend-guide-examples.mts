import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const provider = process.env.FLOW_FRONTBUILDER_RESOURCE_ROOT!;
const guides = process.env.FLOW_GUIDE_TEST_ROOT || resolve(import.meta.dirname, "../../_flow/resources/guide");
const { layoutPageFixture } = await import(pathToFileURL(resolve(provider, "src-builder/generatedLayoutFixture.ts")).href);
const { describeDocument, loadDocument } = await import(pathToFileURL(resolve(provider, "src-builder/frontDocument.ts")).href);
const { generateSvelteProject } = await import(pathToFileURL(resolve(provider, "src-builder/generateSvelteProject.ts")).href);
const { compile } = createRequire(resolve(provider, "package.json"))("svelte/compiler");
const engine = process.env.FLOW_ENGINE_RESOURCE_ROOT!;
const entity = ["lib_flow_entity", "c8oprj-lib-flow-entity"]
  .map(name => resolve(import.meta.dirname, "../../..", name))
  .find(path => existsSync(path));
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


// Exact entity-guide fences are loaded as Flow documents, with their real native
// library descriptors. No implicit provider discovery or modified guide snippets.
const entityExamples = [
  { guide: "entities", id: "selectionExample", project: "EquipmentApp", route: "", layout: false },
  { guide: "multipage-entities", id: "sessionLayout", project: "BookingApp", route: "", layout: true },
  { guide: "multipage-entities", id: "bookingEditor", project: "BookingApp", route: "mine", layout: false },
];
const walk = (nodes: any[]): any[] => nodes.flatMap(node => [node, ...walk(node.children || [])]);

async function entityGuideFixture(t: test.TestContext, plan: typeof entityExamples[number]) {
  assert.ok(engine, "FLOW_ENGINE_RESOURCE_ROOT must identify the Engine provider");
  assert.ok(entity, "A side-by-side lib_flow_entity checkout is required for native widget contracts");
  const root = await mkdtemp(join(tmpdir(), "flow-entity-guide-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const routes = join(root, "_flow/frontbuilder/svelte/model", plan.project, "src/routes");
  for (const page of ["home", "mine", "manage", "journal"]) {
    const filename = join(routes, page === "home" ? "" : page, "+page.flow.svelte");
    await mkdir(dirname(filename), { recursive: true });
    await writeFile(filename, `<script module>export const _flow = {sourceVersion: 2, page: {id: "${page}"}};</script><FlowComponent $$id="${page}"><Structure><Text $$id="${page}Text" text="${page}" /></Structure></FlowComponent>`);
  }
  await writeFile(join(routes, "+layout.flow.svelte"), blankLayout);
  let source = "";
  // Fences belonging to one recipe coexist: in particular the real layout
  // and booking editor must keep layout.session and page.session independent.
  for (const companion of entityExamples.filter(item => item.guide === plan.guide)) {
    const code = await example(companion.guide, companion.id);
    const filename = companion.layout ? join(routes, "+layout.flow.svelte") : join(routes, companion.route, "+page.flow.svelte");
    await writeFile(filename, code);
    if (companion.id === plan.id) source = code;
  }
  const config = {
    resourceRoot: provider,
    projectRoot: root,
    projectName: plan.project,
    referenceRoots: [resolve(engine, ".."), entity],
    discoverImplicitProviders: false,
  };
  const doc = await loadDocument(join(routes, "+page.flow.svelte"), {}, config);
  assert.deepEqual(doc.diagnostics.filter((d: any) => d.level === "error"), [], `${plan.guide}/${plan.id} must load with all route and library contracts`);
  const built = await generateSvelteProject(root, doc.model, { resourceRoot: provider });
  const generated = new Map<string, string>();
  for (const page of ["home", "mine", "manage", "journal"]) {
    const route = page === "home" ? "" : page + "/";
    const name = route + "+page.svelte";
    const code = await readFile(join(built.generatedRoot, "src/routes", name), "utf8");
    assert.doesNotThrow(() => compile(code, { filename: name, generate: "client" }), `${plan.guide}/${plan.id}: ${name}`);
    generated.set(name, code);
  }
  const layout = await readFile(join(built.generatedRoot, "src/routes/+layout.svelte"), "utf8");
  assert.doesNotThrow(() => compile(layout, { filename: "+layout.svelte", generate: "client" }));
  generated.set("+layout.svelte", layout);
  return { doc, source, generated };
}

test("all Svelte fences in both entity guides have an explicit compilation proof", async () => {
  for (const guide of ["entities", "multipage-entities"]) {
    const text = await readFile(resolve(guides, guide + ".md"), "utf8");
    const fences = Array.from(text.matchAll(/```svelte\n([\s\S]*?)```/g), match => match[1]);
    const ids = fences.map(source => source.match(/<FlowComponent\b[^>]*\$\$id="([^"]+)"/)?.[1]);
    assert.ok(ids.every(Boolean), `${guide}: each fence must remain a complete Flow component`);
    assert.deepEqual(ids, entityExamples.filter(plan => plan.guide === guide).map(plan => plan.id), `${guide}: add a compilation plan whenever a Svelte fence is added`);
  }
});

for (const plan of entityExamples) {
  test(`${plan.guide}: exact ${plan.id} fence loads and generates compilable Svelte with entity references`, async t => {
    const { doc, source, generated } = await entityGuideFixture(t, plan);
    if (!plan.layout) {
      const tags = source.match(/<Entity(?:Table|Form)\b[^>]*>/g) || [];
      assert.equal(tags.length, 2, "The selection/editor example keeps both native entity widgets");
      for (const tag of tags) {
        assert.match(tag, new RegExp(`targetProject="${plan.project}"`), "Every entity widget names the application project explicitly");
      }
      const code = generated.get(plan.route ? plan.route + "/+page.svelte" : "+page.svelte")!;
      assert.match(code, new RegExp(`targetProject=(?:"${plan.project}"|\\{"${plan.project}"\\})`), "The generated native widget transport retains the target project");
      assert.match(code, /onselect=\{/);
      if (plan.id === "bookingEditor") {
        assert.match(code, /onsaved=\{/);
        assert.match(code, /ondeleted=\{/);
        assert.match(code, /oncancel=\{/);
        assert.match(code, /refreshKey=/);
        assert.match(code, /row=/);
      }
    } else {
      // The shared layout fixture has only a home route. Preserve the exact
      // documented mine link here and check the logout/navigation contract on
      // the real multi-route document rather than deleting that link for a mock.
      const logout = doc.model.backendCalls.find((call: any) => call.requestable === ".Logout");
      assert.ok(logout, "The layout calls the application logout Flow");
      assert.equal(logout.parameters?.__disableAutologin, true, "Logout must prevent automatic sign-in replay");
      assert.ok(doc.model.clientActions.some((action: any) => action.kind === "backendCall" && action.backendCall === logout.id));
      assert.ok(doc.model.clientActions.some((action: any) => action.kind === "navigate" && action.page === "home"));
      const nodes = walk(doc.model.components.flatMap((component: any) => component.nodes || []));
      const signout = nodes.find((node: any) => node.id === "signout");
      assert.ok(signout);
      assert.deepEqual(walk(signout.children || []).filter((node: any) => ["logoutCall", "goHome"].includes(node.id)).map((node: any) => node.id), ["logoutCall", "goHome"], "Return home only after the logout call in the ordinary chain");
      const refresh = nodes.find((node: any) => node.id === "refreshSession");
      assert.ok(refresh);
      assert.ok(walk(refresh.children || []).some((node: any) => node.id === "loadSession"));
      assert.ok(!walk(refresh.children || []).some((node: any) => node.id === "goHome" || String(node.type || node.tag).toLowerCase() === "navigate"), "Session refresh never redirects every navigation");
      assert.match(generated.get("+layout.svelte")!, /afterNavigate\(/);
    }
  });
}
