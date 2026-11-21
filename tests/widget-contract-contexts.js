// The contract of a widget read block by block (code-get with contractBlocks, flow-block-get) gives what each named
// snippet receives and what each event gives (lot 6 of 21/11: the context of the Toolbar of EntityTable, total and shown,
// and of the Related1 slot of EntityView, its filter, and the value of OnLoaded were in no contract). The fields of a
// snippet parameter come with their description, the events with theirs; the starter contract keeps its size.
var root = String(new java.io.File(arguments[0]).getCanonicalPath());
var engineDir = String(new java.io.File(arguments[1]).getCanonicalPath());
var FU = Packages.org.apache.commons.io.FileUtils;
var __flowProjectDir = root, __flowEngineDir = engineDir;
var engine = eval(String(FU.readFileToString(new java.io.File(engineDir, "Engine.js"), "UTF-8")));
var mcp = eval(String(FU.readFileToString(new java.io.File(root, "_flow/lib/mcp.js"), "UTF-8")));
var checks = 0;
function check(ok, message) { checks++; if (!ok) throw new Error(message); }

// 1. The contract item of the engine: the description of each snippet, the fields of its parameters, the events.
var treeSource = String(FU.readFileToString(new java.io.File(engineDir, "modules/flow-tree-service.js"), "UTF-8"));
function extract(name) { var start = treeSource.indexOf("\tfunction " + name + "("), end = treeSource.indexOf("\n\t}\n", start); return eval("(" + treeSource.substring(start, end + 3).trim() + ")"); }
var descriptor = { snippets: { toolbar: { description: "Commands above the table.", parameters: [{ name: "context", schema: { type: "object", properties: {
	total: { type: ["number", "null"], description: "The rows the search and filters match" }, shown: { type: "number" } } } }] },
	cell2: { parameters: [{ name: "row", schema: { type: "object", description: "A row read from the server" } }, { name: "field" }] } },
	events: { loaded: { label: "Loaded", description: "@event.value is {total, shown, offset, hasMore}." }, select: { label: "Select" } } };
var snippets = extract("descriptorSnippets")(descriptor), events = extract("descriptorEventDescriptions")(descriptor);
check(snippets.toolbar.description === "Commands above the table." && snippets.toolbar.parameters[0].name === "context" &&
	snippets.toolbar.parameters[0].fields.total === "The rows the search and filters match" && snippets.toolbar.parameters[0].fields.shown === "number" &&
	snippets.cell2.parameters[0].description === "A row read from the server" && snippets.cell2.parameters[1].name === "field",
	"the engine contract gives what each snippet receives: " + JSON.stringify(snippets));
check(JSON.stringify(events) === JSON.stringify({ OnLoaded: "@event.value is {total, shown, offset, hasMore}." }), "the events with a description: " + JSON.stringify(events));

// 2. code-get with contractBlocks: the block asked for carries them, the starter contract does not.
var blockSource = String(FU.readFileToString(new java.io.File(root, "_flow/blocks/frontend/svelte/source.block.js"), "UTF-8"));
var block = eval(blockSource.substring(blockSource.indexOf("(function")));
var projectDir = java.nio.file.Files.createTempDirectory("flow-widget-contexts-").toFile();
var page = '<script module>\n  export const _flow = { sourceVersion: 2 };\n</script>\n\n<FlowComponent $$id="home" label="Home"><Structure /></FlowComponent>\n';
var file = new java.io.File(projectDir, "_flow/frontbuilder/svelte/model/Test/src/routes/+page.flow.svelte");
file.getParentFile().mkdirs();
FU.writeStringToFile(file, page, "UTF-8");
var item = { id: "entity.table", tag: "EntityTable", properties: { entity: { type: "string", intents: ["literal"] } }, slots: {},
	snippets: snippets, events: ["OnLoaded", "OnSelect"], eventDescriptions: events };
function contract(asked) {
	var props = { operation: "get", projectDir: String(projectDir.getCanonicalPath()), sourceFile: "_flow/frontbuilder/svelte/model/Test/src/routes/+page.flow.svelte", out: "local.source" };
	if (asked) props.contractBlocks = asked;
	return block.run({ props: function () { return props; }, resourceGet: function () { return { content: page, hash: "revision", contentLength: page.length }; },
		authoringContractSource: function () { return { items: [item] }; }, write: function () {} }, {}).authoringContract;
}
var table = contract("EntityTable").blocks[0];
check(table.snippetContexts.Toolbar.description === "Commands above the table." && table.snippetContexts.Toolbar.context.total === "The rows the search and filters match" &&
	table.snippetContexts.Cell2.row === "A row read from the server" && table.eventDescriptions.OnLoaded.indexOf("hasMore") > 0 && table.snippets.Toolbar.join() === "context",
	"contractBlocks gives what each snippet receives and what each event gives: " + JSON.stringify(table));
check(JSON.stringify(contract("")).indexOf("snippetContexts") < 0, "the starter contract keeps its size");

// 3. The page of a targeted contract keeps them, block by block.
var reply = mcp.toolResponse({ id: 1, method: "tools/call", params: { name: "code-get", arguments: { project: "App", sourceFile: "src/routes/+page.flow.svelte", contractBlocks: ["EntityTable"] } } },
	{ ok: true, revision: "r", authoringContract: { version: 2, detail: "blocks", blocks: [table], portableBlocks: [], missingBlocks: [] } }, {}).result;
var served = reply.structuredContent.authoringContract.blocks[0];
check(served.snippetContexts && served.snippetContexts.Toolbar.context.shown === "number" && served.eventDescriptions.OnLoaded === events.OnLoaded &&
	reply.structuredContent.authoringContract.complete === true, "the contract page keeps them: " + JSON.stringify(served));
FU.deleteDirectory(projectDir);
print("widget-contract-contexts OK (" + checks + " checks)");
