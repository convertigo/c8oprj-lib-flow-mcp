// A UI bootstrap queues the existing dev.start action once, without opening a viewer.
var root = new java.io.File(String(arguments[0])).getCanonicalFile();
var IO = Packages.org.apache.commons.io.FileUtils;
var checks = 0;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
function read(path) { return String(IO.readFileToString(new java.io.File(root, path), "UTF-8")); }

var source = read("_flow/blocks/project/bootstrap.block.js");
var bootstrap = eval(source.substring(source.indexOf("(function"))
	.replace("run: function (ctx, node) {", "_startDev: startDev, run: function (ctx, node) {"));
assert(typeof bootstrap._startDev === "function", "bootstrap exposes its dev startup helper");
var calls = [];
var ctx = { contextActionSource: function (request) {
	calls.push(request);
	return { ok: true, pending: true, details: { status: "starting" } };
} };
var project = { getDirPath: function () { return "/tmp/Shop"; }, getName: function () { return "Shop"; },
	getFlowEngine: function () { return { getEngineSource: function () { return "version: 1\nconfig:\n  frontbuilder:\n    svelte: {}\n"; } }; } };
var result = bootstrap._startDev(ctx, project, true, true);
assert(result === true && calls.length === 1, "the UI bootstrap starts preparation once");
assert(bootstrap._startDev(ctx, project, true, false) === false && calls.length === 1,
	"ui:true with devStart:false does not start dev preparation");
assert(bootstrap._startDev(ctx, project, false, true) === false && calls.length === 1,
	"a backend-only bootstrap does not start dev preparation");
assert(calls[0].projectDir === "/tmp/Shop" && calls[0].targetObject.kind === "frontendBuilder" &&
	calls[0].action.id === "frontbuilder.svelte.dev.start" && calls[0].wait === false,
	"bootstrap uses the same nonblocking action as dev.ensure");
assert(calls[0].origin !== "mcp" && calls[0].action.id.indexOf("dev.open") === -1,
	"bootstrap does not notify or open the viewer");
assert(bootstrap._startDev({ contextActionSource: function () { throw new Error("socket unavailable"); } }, project, true, true) === false,
	"dev startup failure does not undo the saved bootstrap");
assert(/var devStart = boolValue\(prop\(props, "devStart"\), true\)/.test(source), "devStart defaults to true for an explicit UI bootstrap");
assert(/result\.devStarting = startDev\(ctx, project, ui, devStart\)/.test(source), "the saved UI bootstrap queues and reports dev startup");
assert(/if \(ui\) \{\s*result\.devStarting = startDev/.test(source), "backend bootstrap does not call the dev action");

var mcp = eval(read("_flow/lib/mcp.js"));
var refusedArguments = mcp.prepareToolArguments(null,
	{ params: { name: "flow-project-bootstrap", arguments: { project: "Shop", ui: true, devStart: false } } },
	{ resolveProject: false });
assert(refusedArguments.devStart === false, "the MCP transport preserves the explicit startup refusal");
var compact = mcp.toolResponse({ id: 1, params: { name: "flow-project-bootstrap", arguments: { project: "Shop", ui: true } } },
	{ ok: true, project: "Shop", saved: true, devStarting: true }, {}).result.structuredContent;
assert(compact.devStarting === true, "the compact MCP answer reports dev startup");

// Exercise the engine's actual dev.start dispatcher with a project-scoped preparation stub.
var engine = read("../lib_flow_engine/_flow/Engine.js");
var from = engine.indexOf("\tfunction frontendStartDev(request, blocks) {");
var to = engine.indexOf("\n\tfunction frontendDestroyJavaProcess", from);
assert(from >= 0 && to > from, "the engine exposes its dev.start dispatcher");
var preparationCount = 0, entry = null;
var devStart = eval("(function () {\n" +
	"function frontbuilderSettingsForRequest() { return { name: 'svelte' }; }\n" +
	"function frontendDevKey() { return 'Shop|svelte'; }\n" +
	"function frontendCancelProductionBuild() {}\n" +
	"function frontendDevEntry() { return entry; }\n" +
	"function frontendDevDetails(value) { return { status: value.status }; }\n" +
	"function frontendDevWaitRequested() { return false; }\n" +
	"function frontendStudioBrowser() { return null; }\n" +
	"function frontendStartDevBackground() { preparationCount++; entry = { status: 'starting', setupKind: 'app' }; return { ok: true, pending: true }; }\n" +
	"function frontendStartDevNow() { throw new Error('unexpected relaunch'); }\n" +
	engine.substring(from, to) + "\nreturn frontendStartDev; })()");
entry = null;
var startedByBootstrap = bootstrap._startDev({ contextActionSource: function (request) { return devStart(request, null); } }, project, true, true);
assert(startedByBootstrap === true && preparationCount === 1, "bootstrap queued one preparation");
var reused = devStart({ projectDir: "/tmp/Shop", wait: false }, null);
assert(reused.ok === true && reused.pending === true && preparationCount === 1,
	"first dev.ensure finds the preparation in progress without repeating it");
entry.status = "running";
reused = devStart({ projectDir: "/tmp/Shop", wait: false }, null);
assert(reused.ok === true && reused.pending === false && preparationCount === 1,
	"first dev.ensure also finds the completed startup without repeating it");
print("bootstrap-dev-ensure OK (" + checks + " checks)");
