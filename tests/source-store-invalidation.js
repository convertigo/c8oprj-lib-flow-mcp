// A source written as a working copy of a loaded project (the Studio) leaves the data caches of the other projects:
// sourceStore.write invalidated those of every project (FlowEngineBridge.invalidateDataCaches) on each frontend
// code-set or authoring mutation, before its caller notified the written source, which invalidates those of its
// project and of the projects using it. The answers and snapshots of the other projects now stay.
// Run with Rhino: java -cp <rhino:commons-io> org.mozilla.javascript.tools.shell.Main tests/source-store-invalidation.js <lib_flow_mcp dir>
var projectDir = String(new java.io.File(arguments.length > 0 ? arguments[0] : ".").getCanonicalPath());
var realPackages = Packages;
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }
function read(dir, path) {
	return String(realPackages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(dir, path), "UTF-8"));
}

var root = java.nio.file.Files.createTempDirectory("flow-source-store-invalidation").toFile().getCanonicalFile();
var calls = [];
var written = [];
var flowEngine = {
	setSources: function (sources) { written.push(String(sources.toString())); },
	hasSource: function () { return false; },
	isSourceDirty: function () { return false; },
	getSource: function () { return ""; }
};
var project = {
	getName: function () { return "App"; },
	getDirFile: function () { return root; },
	getFlowEngine: function () { return flowEngine; }
};
// The loaded project of the Studio and the bridge, the rest of the platform as it is.
var Packages = {
	java: realPackages.java,
	javax: realPackages.javax,
	org: realPackages.org,
	com: { twinsoft: { convertigo: { engine: {
		Engine: {
			theApp: { databaseObjectsManager: { getLoadedProjectByName: function (name) { return String(name) === "App" ? project : null; } } },
			isStudioMode: function () { return true; },
			getServletContext: function () { return null; }
		},
		flow: {
			FlowEngineBridge: {
				invalidateDataCaches: function () { calls.push("invalidateDataCaches"); },
				invalidateProjectDataCaches: function (dir) { calls.push("invalidateProjectDataCaches " + dir); }
			},
			FlowStudioSupport: {
				clearCatalogCache: function () { calls.push("clearCatalogCache"); }
			}
		}
	} } } }
};
var mcp = eval(read(projectDir, "_flow/lib/mcp.js"));

var store = mcp.sourceStore({ project: "App", projectDir: String(root.getPath()) });
assert(store.drafts === true, "a source of a loaded project is written as its working copy");
var page = String(new java.io.File(root, "_flow/frontbuilder/svelte/model/App/src/routes/+page.flow.svelte").getPath());
var sources = {};
sources[page] = "<FlowComponent $$id=\"page\"><Structure /></FlowComponent>\n";
var result = store.write(sources);
assert(result.draft === true && written.length === 1 && written[0].indexOf(page) >= 0,
	"the working copy is handed to the FlowEngine of the project: " + JSON.stringify(written));
assert(calls.indexOf("invalidateDataCaches") < 0,
	"a working copy must not invalidate the data caches of every project: " + JSON.stringify(calls));
assert(calls.indexOf("clearCatalogCache") >= 0, "the palette caches of the FlowEngine follow its working copy");

print("source-store-invalidation OK (" + count + " checks)");
