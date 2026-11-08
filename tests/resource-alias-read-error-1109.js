// flow-resource-get of a guide URI tries the alias of that URI (flow://guide/sql -> flow://lib/lib_flow_sql/sql) only
// when resources/read answers that the exact URI is unknown. Any other read failure of the exact URI is answered as
// it is: the alias never replaces it, and it is not turned into UNKNOWN_RESOURCE.
var root = new java.io.File(arguments[0]).getCanonicalFile();
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var checks = 0;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
function read(path) { return String(FileUtils.readFileToString(new java.io.File(root, path), "UTF-8")); }
var mcp = eval(read("_flow/lib/mcp.js"));
var source = read("_flow/blocks/mcp/tools/call.block.js");
var call = eval(source.substring(source.indexOf("(function")));
mcp.guideAliasFor = function (ctx, uri) {
	return mcp.guideAlias(uri, [{ uri: "flow://lib/lib_flow_sql/sql", project: "lib_flow_sql" }], ["start"]);
};
var GUIDE = "# SQL\n\nThe library guide.";
// exact: the answer of resources/read for flow://guide/sql ("unknown", "truncated" or "failed")
function run(args, exact) {
	var calls = [];
	var request = { jsonrpc: "2.0", id: 21, method: "tools/call", params: { name: "flow-resource-get", arguments: args } };
	var ctx = {
		props: function (node) { return node.props; },
		lib: function () { return mcp; },
		blockNames: function () { return ["mcp.tool.flow.resource.get"]; },
		convertigoContext: function () { return { httpServletRequest: { getHeader: function () { return "MistralAI-VibeCLI/3.0.3"; } } }; },
		write: function () {},
		callBlock: function (blockId, props) {
			if (blockId === "mcp.experience") return props.response;
			calls.push(blockId + " " + (props.request.params.uri || ""));
			if (blockId === "mcp.tool.flow.resource.get") {
				return mcp.toolError(props.request, { code: "UNKNOWN_RESOURCE", message: "Unknown Flow resource uri: " + args.uri }, ctx);
			}
			if (props.request.params.uri !== "flow://guide/sql") {
				return mcp.jsonRpcResult(props.request.id, { contents: [{ uri: props.request.params.uri, mimeType: "text/markdown", text: GUIDE }] });
			}
			if (exact === "unknown") {
				return mcp.jsonRpcError(props.request.id, -32000, "Unknown Flow MCP resource: flow://guide/sql", { code: "FLOW_MCP_RESOURCE_ERROR" });
			}
			if (exact === "truncated") {
				return mcp.jsonRpcError(props.request.id, -32000, "Flow MCP resource could not be read completely: flow://guide/sql", { code: "FLOW_MCP_RESOURCE_TRUNCATED" });
			}
			return mcp.jsonRpcError(props.request.id, -32603, "Guide store unavailable.", { code: "FLOW_MCP_TOOL_ERROR" });
		}
	};
	return { response: call.run(ctx, { props: { request: request, out: "local.response" } }), calls: calls };
}

// An unknown exact URI: the alias is read, with its note.
[{ uri: "flow://guide/sql" }, { project: "App", uri: "flow://guide/sql" }].forEach(function (args) {
	var aliased = run(args, "unknown");
	assert(aliased.calls[aliased.calls.length - 1] === "mcp.resources.read flow://lib/lib_flow_sql/sql" &&
		aliased.response.result.structuredContent.text === GUIDE && /is read as flow:\/\/lib\/lib_flow_sql\/sql/.test(aliased.response.result.structuredContent.note),
		"an unknown URI reads its alias: " + JSON.stringify(aliased));
});

// Another failure of the exact read: answered as it is, with or without project.
[["truncated", "FLOW_MCP_RESOURCE_TRUNCATED", /could not be read completely/], ["failed", "FLOW_MCP_TOOL_ERROR", /Guide store unavailable/]].forEach(function (item) {
	[{ uri: "flow://guide/sql" }, { project: "App", uri: "flow://guide/sql" }].forEach(function (args) {
		var failed = run(args, item[0]);
		var result = failed.response.result, error = result && result.structuredContent && result.structuredContent.error;
		assert(failed.calls.join(",").indexOf("flow://lib/lib_flow_sql/sql") < 0, item[0] + " never reads the alias: " + failed.calls.join(","));
		assert(result && result.isError === true && error && error.code === item[1] && item[2].test(error.message),
			item[0] + " keeps the read error " + JSON.stringify(args) + ": " + JSON.stringify(failed.response));
	});
});
print("resource-alias-read-error-1109 OK (" + checks + " checks)");
