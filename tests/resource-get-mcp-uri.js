// An MCP client without resources/read (Vibe 3 lists tools only) reads the Flow MCP guides with flow-resource-get and
// their uri: a guide, skill or library guide URI is answered from resources/read, its text in structuredContent, without
// project or when the project does not answer it; a project resource, or any other unknown URI, keeps the answer of
// flow-resource-get.
// Run with Rhino: java -cp <rhino:rhino-tools:commons-io> org.mozilla.javascript.tools.shell.Main tests/resource-get-mcp-uri.js .
var root = new java.io.File(arguments[0]).getCanonicalFile();
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }
function read(path) { return String(FileUtils.readFileToString(new java.io.File(root, path), "UTF-8")); }

var mcp = eval(read("_flow/lib/mcp.js"));
var source = read("_flow/blocks/mcp/tools/call.block.js");
var call = eval(source.substring(source.indexOf("(function")));

var GUIDE = "# Frontend Svelte\n\nThe guide.";
function run(args, projectOwns, projectError) {
	var calls = [];
	var written = {};
	var request = { jsonrpc: "2.0", id: 17, method: "tools/call", params: { name: "flow-resource-get", arguments: args } };
	var ctx = {
		props: function (node) { return node.props; },
		lib: function () { return mcp; },
		blockNames: function () { return ["mcp.tool.flow.resource.get"]; },
		convertigoContext: function () { return { httpServletRequest: { getHeader: function () { return "MistralAI-VibeCLI/3.0.3"; } } }; },
		write: function (path, value) { written[path] = value; },
		callBlock: function (blockId, props) {
			if (blockId === "mcp.experience") {
				assert(props.request === request && props.response.result, "optional advice receives the completed tool result");
				return props.response;
			}
			calls.push(blockId);
			if (blockId === "mcp.tool.flow.resource.get") {
				if (projectError) {
					return mcp.toolError(props.request, projectError, ctx);
				}
				return projectOwns
					? mcp.jsonRpcResult(props.request.id, { content: [{ type: "text", text: "project resource" }], structuredContent: { ok: true, uri: args.uri, content: "own" } })
					: mcp.toolError(props.request, { code: "UNKNOWN_RESOURCE", message: "Unknown Flow resource uri: " + args.uri }, ctx);
			}
			if (blockId === "mcp.resources.read") {
				assert(props.request.method === "resources/read" && (props.request.params.uri === args.uri ||
					args.uri === "flow://guide/sql" && props.request.params.uri === "flow://lib/lib_flow_sql/sql") && props.request.id === 17, "resources/read of the same uri");
				return /^flow:\/\/guide\/(missing|sql$)/.test(props.request.params.uri)
					? mcp.jsonRpcError(props.request.id, -32000, "Unknown Flow MCP resource: " + args.uri, { code: "FLOW_MCP_RESOURCE_ERROR" })
					: mcp.jsonRpcResult(props.request.id, { contents: [{ uri: args.uri, mimeType: "text/markdown", text: GUIDE }] });
			}
			throw new Error("unexpected block " + blockId);
		}
	};
	var response = call.run(ctx, { props: { request: request, out: "local.response" } });
	return { response: response, calls: calls, written: written["local.response"] };
}

["flow://guide/frontend-svelte", "flow://lib/lib_flow_sql/sql", "flow://skills/convertigo-flow-backend/SKILL"].forEach(function (uri) {
	var guide = run({ project: "KitSmokeNotes", uri: uri }, false);
	var result = guide.response.result;
	assert(guide.calls.join(",") === "mcp.tool.flow.resource.get,mcp.resources.read", uri + ": the project first, then the MCP resource: " + guide.calls);
	assert(result && !result.isError && result.structuredContent.text === GUIDE && result.structuredContent.uri === uri, uri + " is read: " + JSON.stringify(guide.response));
	assert(result.structuredContent.source === "resources/read" && result.structuredContent.mimeType === "text/markdown", "it says where it comes from");
	assert(result.content.length === 1 && /Resource text is in text/.test(result.content[0].text) && result.content[0].text.indexOf(GUIDE) === -1,
		"the content is a short summary, the text stays in structuredContent");
	assert(guide.written === guide.response && guide.response.id === 17, "the answer is written to out with the request id");
});

var own = run({ project: "App", uri: "flow://guide/frontend-svelte" }, true);
assert(own.response.result.structuredContent.text === "own", "Project resources expose canonical text");
assert(own.calls.join(",") === "mcp.tool.flow.resource.get" && /Resource text is in text/.test(own.response.result.structuredContent.content), "a project resource keeps precedence");

var other = run({ project: "App", uri: "flow://App/resources/x.md" }, false);
assert(other.calls.join(",") === "mcp.tool.flow.resource.get" && other.response.result.structuredContent.error.code === "UNKNOWN_RESOURCE",
	"another unknown uri keeps the tool error");

var missing = run({ project: "App", uri: "flow://guide/missing" }, false);
assert(missing.calls.join(",") === "mcp.tool.flow.resource.get,mcp.resources.read" && missing.response.result.structuredContent.error.code === "UNKNOWN_RESOURCE",
	"an unknown guide keeps the tool error: " + JSON.stringify(missing.response));

// Without project (F-01: the guides that tell how to start were refused before any project existed).
["flow://guide/start", "flow://lib/lib_flow_sql/sql", "flow://skills/convertigo-flow-mcp/SKILL"].forEach(function (uri) {
	var bare = run({ uri: uri }, false);
	assert(bare.calls.join(",") === "mcp.resources.read", uri + " without project goes to resources/read alone: " + bare.calls);
	assert(bare.response.result.structuredContent.text === GUIDE && bare.response.result.structuredContent.source === "resources/read" &&
		!bare.response.result.isError && bare.response.id === 17, uri + " is read without project: " + JSON.stringify(bare.response));
	assert(/Resource text is in text/.test(bare.response.result.structuredContent.content), "Legacy content explicitly redirects");
});
var bareMissing = run({ uri: "flow://guide/missing" }, false);
assert(bareMissing.calls.join(",") === "mcp.resources.read" && bareMissing.response.result.structuredContent.error.code === "UNKNOWN_RESOURCE" &&
	/flow:\/\/guide\/start lists the guides/.test(bareMissing.response.result.structuredContent.error.hint),
	"an unknown guide without project is an UNKNOWN_RESOURCE that names the start guide: " + JSON.stringify(bareMissing.response));
var bareProject = run({ uri: "flow://App/resources/x.md" }, false);
assert(bareProject.calls.join(",") === "mcp.tool.flow.resource.get", "a project resource uri without project still goes to the project tool");
var barePath = run({ path: "_flow/engine.yaml", uri: "flow://guide/start" }, false);
assert(barePath.calls.join(",") === "mcp.tool.flow.resource.get", "a path read is never redirected, even with a guide uri");
// A project that does not answer (not created yet, not loaded) does not hide the guide.
var notCreated = run({ project: "NotCreatedYet", uri: "flow://guide/start" }, false,
	{ code: "FLOW_MCP_TOOL_ERROR", message: "Unknown Convertigo project NotCreatedYet." });
assert(notCreated.calls.join(",") === "mcp.tool.flow.resource.get,mcp.resources.read" && notCreated.response.result.structuredContent.text === GUIDE,
	"a guide stays readable when the named project fails: " + JSON.stringify(notCreated.response));

var path = run({ project: "App", path: "_flow/resources/guide/x.md" }, false);
assert(path.calls.join(",") === "mcp.tool.flow.resource.get", "a path read is not redirected");
["flow://guide/start", "flow://lib/lib_flow_sql/sql", "flow://skills/convertigo-flow-mcp/SKILL"].forEach(function(uri) {
 var readable = run({uri:uri, format:"text"}, false).response.result;
 assert(!readable.structuredContent && readable.content.length === 1 && readable.content[0].text === GUIDE,
  "Readable guide is one raw Markdown block: " + uri);
});
var readableProject = run({project:"App", uri:"flow://App/resources/x.md", format:"text"}, true).response.result;
assert(!readableProject.structuredContent && /Resource metadata:/.test(readableProject.content[0].text) && /\n\nown$/.test(readableProject.content[0].text), "Project text uses the same formatter");
var badFormat = run({uri:"flow://guide/start", format:"other"}, false);
assert(badFormat.calls.length === 0 && badFormat.response.result.structuredContent.error.code === "INVALID_ARGUMENT", "Unknown formats fail before reading");
var textMissing = run({uri:"flow://guide/missing", format:"text"}, false).response.result;
assert(textMissing.isError && textMissing.structuredContent.error.code === "UNKNOWN_RESOURCE", "Readable missing guide is still an error");
// flow://guide/sql is the guide of the SQL library when it is the only one with that name (alias, with a note).
var guideAliasFor = mcp.guideAliasFor;
var flowscriptAlias = mcp.guideAlias('flow://guide/flowscript', [], ['start', 'authoring']);
assert(flowscriptAlias.uri === 'flow://guide/authoring',
	'backend guide shorthand leads directly to the authoring guide: ' + JSON.stringify(flowscriptAlias));
// A topic word that only one core guide holds, or a sub-topic of a core guide, leads to that guide.
var coreGuides = ["start", "fullsync", "frontend-svelte", "frontend-svelte-datatable", "frontend-svelte-components"];
var topicAliases = [["flow://lib/lib_flow_frontbuilder_svelte/datatable", "frontend-svelte-datatable"], ["flow://lib/lib_flow_frontbuilder_svelte/components", "frontend-svelte-components"],
	["flow://guide/fullsync-scaffold", "fullsync"], ["flow://guide/fullsync-transactions", "fullsync"]];
topicAliases.forEach(function (pair) {
	var found = mcp.guideAlias(pair[0], [{ uri: "flow://lib/lib_flow_frontbuilder_svelte/frontend-design", project: "lib_flow_frontbuilder_svelte" },
		{ uri: "flow://lib/lib_flow_frontbuilder_svelte/frontend-actions", project: "lib_flow_frontbuilder_svelte" }], coreGuides);
	assert(found.uri === "flow://guide/" + pair[1], pair[0] + " leads to " + pair[1] + ": " + JSON.stringify(found));
});
mcp.guideAliasFor = function (ctx, uri) {
	return mcp.guideAlias(uri, [{ uri: "flow://lib/lib_flow_sql/sql", project: "lib_flow_sql" }], ["start", "frontend-svelte"]);
};
var aliased = run({ uri: "flow://guide/sql" }, false);
assert(aliased.calls.join(",") === "mcp.resources.read,mcp.resources.read" && aliased.response.result.structuredContent.text === GUIDE &&
	aliased.response.result.structuredContent.uri === "flow://lib/lib_flow_sql/sql" && /flow:\/\/lib\/lib_flow_sql\/sql/.test(aliased.response.result.structuredContent.note),
	"flow://guide/sql reads the SQL library guide and says so: " + JSON.stringify(aliased.response));
var aliasedText = run({ uri: "flow://guide/sql", format: "text" }, false).response.result;
assert(!aliasedText.isError && /^Note: flow:\/\/guide\/sql is read as flow:\/\/lib\/lib_flow_sql\/sql/.test(aliasedText.content[0].text) &&
	aliasedText.content[0].text.slice(-GUIDE.length) === GUIDE, "Readable alias keeps the guide after one note line");
var near = run({ uri: "flow://guide/missing-frontend" }, false).response.result.structuredContent.error;
assert(near.code === "UNKNOWN_RESOURCE" && /Did you mean flow:\/\/guide\/frontend-svelte/.test(near.hint) &&
	near.details.didYouMean.indexOf("flow://guide/frontend-svelte") !== -1, "An unknown guide lists the nearest URIs: " + JSON.stringify(near));
mcp.guideAliasFor = guideAliasFor;
print("resource-get-mcp-uri OK (" + count + " checks)");
