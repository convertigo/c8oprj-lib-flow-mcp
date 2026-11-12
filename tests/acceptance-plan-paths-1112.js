// The acceptance plan of build and openBuilt now carries the paths to walk (flow-acceptance.json of the Svelte
// provider: writes, carried values, loads), beside the probes that prove the build renders. The MCP keeps them in
// openBuilt and says, in the compact build and in the hint given when the relay offers no verifier, that the paths
// and each acceptance criterion are walked, not only the calls run.
// Run with Rhino: java -cp <rhino:commons-io> org.mozilla.javascript.tools.shell.Main tests/acceptance-plan-paths-1112.js <lib_flow_mcp dir>
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
var paths = [
	{ kind: "carry", page: "/", trigger: "Declare", to: "/declare", carries: ["items"], prove: "Go from / to /declare through \"Declare\": that page must show what it receives (items)." },
	{ kind: "write", page: "/declare", trigger: "Declaration", calls: [".Declare"], prove: "As its user, fill and submit \"Declaration\"." }
];
var plan = { strategy: "safe-playwright-plan", calls: [{ tool: "browser_navigate", arguments: { url: url } }], paths: paths,
	next: "Execute calls unchanged and in order: they prove that the build renders, not that it works." };

// 1. openBuilt keeps the paths as they are
var opened = answer({ project: "Shop", actionId: "openBuilt" }, { ok: true, openUrl: url, acceptance: plan });
assert(JSON.stringify(opened.acceptance.paths) === JSON.stringify(paths), "openBuilt keeps the paths: " + JSON.stringify(opened.acceptance));

// 2. The compact build says that the plan has paths to walk, with each criterion
var built = answer({ project: "Shop", actionId: "build" }, { ok: true, message: "built", openUrl: url, details: { action: "build" }, acceptance: plan });
assert(/acceptance\.paths/.test(built.next) && /each acceptance criterion/.test(built.next) && !/acceptance\.calls plan \(or build/.test(built.next),
	"the compact build names the paths to walk: " + built.next);

// 3. Without verifier, the hint asks for the walk of the paths too
var source = read("_flow/blocks/mcp/tools/call.block.js");
assert(/walk its paths and each acceptance criterion/.test(source), "the hint without verifier asks for the walk");
print("acceptance-plan-paths-1112 OK " + checks + " checks");
