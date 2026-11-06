// The browser plan of frontend-svelte-action names generic Playwright calls (browser_navigate...). It says they run with
// the browser tools of the host (its Playwright MCP server, whatever the prefix), never through convertigo-flow: in the
// light bench of 06/11 (it4), the Codex runs looked for these calls among the convertigo-flow tools and gave up.
// Run with Rhino: java -cp <rhino:commons-io> org.mozilla.javascript.tools.shell.Main tests/acceptance-plan-host-1106.js <lib_flow_mcp dir>
var root = new java.io.File(arguments.length > 0 ? arguments[0] : ".").getCanonicalFile();
var FileUtils = Packages.org.apache.commons.io.FileUtils;
function read(path) { return String(FileUtils.readFileToString(new java.io.File(root, path), "UTF-8")); }
var mcp = eval(read("_flow/lib/mcp.js"));
var checks = 0;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
function answer(args, raw) {
	return mcp.toolResponse({ id: 1, params: { name: "frontend-svelte-action", arguments: args } }, JSON.parse(JSON.stringify(raw)), {})
		.result.structuredContent;
}
var url = "http://127.0.0.1:19606/convertigo/projects/Shop/DisplayObjects/mobile/index.html";
var plan = { strategy: "safe-playwright-plan", path: "/convertigo/projects/Shop/DisplayObjects/mobile/index.html", calls: [
	{ tool: "browser_navigate", arguments: { url: url } },
	{ tool: "browser_evaluate", arguments: { function: "() => document.title" } },
	{ tool: "browser_close", arguments: {} }
] };
function saysHost(text, label) {
	text = String(text || "");
	assert(/browser tools of your host/.test(text) && /Playwright/.test(text), label + " names the browser tools of the host: " + text);
	assert(/not (?:through|among|in) (?:the )?convertigo-flow|convertigo-flow has no browser tool/.test(text), label + " says convertigo-flow has none: " + text);
	assert(/browser_navigate/.test(text) && /browser_snapshot/.test(text) && /browser_click/.test(text), label + " gives the generic calls: " + text);
}

// 1. openBuilt: the plan itself says who runs it, the calls are unchanged.
var opened = answer({ project: "Shop", actionId: "openBuilt" }, { ok: true, openUrl: url, acceptance: plan });
assert(opened.acceptance && opened.acceptance.calls.length === 3 && opened.acceptance.calls[0].tool === "browser_navigate",
	"openBuilt keeps the calls unchanged: " + JSON.stringify(opened));
saysHost(opened.acceptance.runWith, "openBuilt acceptance.runWith");

// 2. build, compact: the next step says the same; detail:"full" keeps the plan with runWith.
var built = answer({ project: "Shop", actionId: "build" }, { ok: true, message: "built", openUrl: url, details: { action: "build" }, acceptance: plan });
assert(built.acceptance === undefined, "the compact build still omits the plan: " + JSON.stringify(built));
saysHost(built.next, "compact build next");
var full = answer({ project: "Shop", actionId: "build", detail: "full" }, { ok: true, openUrl: url, details: { action: "build" }, acceptance: plan });
saysHost(full.acceptance.runWith, "full build acceptance.runWith");

// 3. dev.sync and dev.open answer a viewer URL: the proof is with the browser tools of the host too.
["dev.sync", "dev.open"].forEach(function (action) {
	var dev = answer({ project: "Shop", actionId: action }, { ok: true, message: "Svelte dev mode started.", openUrl: "http://127.0.0.1:19606/convertigo/gw/x/" });
	saysHost(dev.browserProof, action + " browserProof");
});
var failed = answer({ project: "Shop", actionId: "dev.sync" }, { ok: false, message: "Svelte dev mode failed to start." });
assert(failed.browserProof === undefined, "no proof line without a viewer URL: " + JSON.stringify(failed));
print("acceptance-plan-host-1106 OK " + checks + " checks");
