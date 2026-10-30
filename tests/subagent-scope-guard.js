// A constructor sub-agent of a parallel build sends X-Convertigo-Subagent-Scope (backend or frontend): the tools/call
// dispatcher refuses its writes to the other side of the project and the main agent's own operations (save, browser
// proofs, sub-agents, PROGRESS.md), before any tool runs or any call is relayed. Without the header nothing changes.
// Run with Rhino: java -cp <rhino:commons-io> org.mozilla.javascript.tools.shell.Main tests/subagent-scope-guard.js .
var root = new java.io.File(arguments[0]).getCanonicalFile();
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }
function read(path) { return String(FileUtils.readFileToString(new java.io.File(root, path), "UTF-8")); }

var mcp = eval(read("_flow/lib/mcp.js"));
var source = read("_flow/blocks/mcp/tools/call.block.js");
var dispatcher = eval(source.substring(source.indexOf("(function")));

var headers = {};
function context() {
	return { httpServletRequest: { getHeader: function (name) { return headers[name] === undefined ? null : headers[name]; } } };
}
function call(name, args) {
	return { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: name, arguments: args || {} } };
}
function refusal(name, args) {
	return mcp.subagentScopeRefusal({ convertigoContext: context }, call(name, args));
}

var frontendSource = { project: "App", sourceFile: "_flow/frontbuilder/svelte/model/App/src/routes/+page.flow.svelte", revision: "r1", code: "<x/>" };
var flowSource = { project: "App", qname: "App.ListItems", code: "function ListItems() {}" };
var writes = {
	frontend: [
		["frontend-svelte-code-set", frontendSource], ["frontend-svelte-code-patch", frontendSource], ["frontend-svelte-mutate", { project: "App" }],
		["frontend-svelte-asset-import", { project: "App" }], ["frontend-svelte-action", { project: "App", actionId: "dev.sync" }],
		["code-set", frontendSource], ["code-patch", { project: "App", kind: "source", revision: "r1", patch: "@@" }],
		["code-set", { project: "App", target: "frontend", code: "<x/>" }],
		["authoring-mutate", { project: "App", surface: "frontend", builder: "svelte", mutation: {} }],
		["authoring-mutate", { project: "App", sourceFile: frontendSource.sourceFile, mutation: {} }],
		["flow-resource-patch", { project: "App", path: "_flow/frontbuilder/svelte/model/App/src/theme.flow.css", content: "x" }],
		["flow-resource-delete", { project: "App", path: "./_flow/frontbuilder/svelte/model/App/src/app.flow.css" }]
	],
	backend: [
		["code-set", flowSource], ["code-patch", { project: "App", qname: "App.ListItems", revision: "r1", patch: "@@" }],
		["code-promote", { project: "App", qname: "App.ListItems" }], ["code-discard", { project: "App", qname: "App.ListItems" }],
		["code-set", { project: "App", target: "frontend", block: "App.formatLabel", code: "x" }],
		["flow-code-set", flowSource], ["flow-code-promote", flowSource], ["flow-block-code-set", { project: "App", name: "formatLabel" }],
		["flow-block-mock", { project: "App" }], ["flow-schema-reset", { project: "App" }], ["flow-sync-inputs", { project: "App" }],
		["flow-object-remove", { project: "App", qname: "App.Old" }], ["flow-fullsync-scaffold", { project: "App" }],
		["authoring-mutate", { project: "App", surface: "flow", mutation: {} }],
		["flow-resource-patch", { project: "App", path: "_flow/engine.yaml", content: "x" }],
		["flow-resource-patch", { project: "App", path: "_flow/resources/schema.json", content: "{}" }],
		["flow-resource-patch", { project: "App", path: "libs/src/com/example/Util.java", content: "x" }]
	],
	main: [
		["project-save", { project: "App" }], ["subagent-run", { profile: "verifier", task: "Prove" }], ["browser-verify", { url: "http://x/" }],
		["report-create", { summary: "x" }], ["flow-project-bootstrap", { project: "App", ui: true }], ["flow-project-remove", { project: "App" }],
		["marketplace-import", { project: "App" }], ["scheduler-apply", { name: "Nightly" }],
		["flow-resource-patch", { project: "App", path: "docs/generated/PROGRESS.md", content: "# Progress" }],
		["flow-resource-patch", { project: "App", path: "/docs/generated/PROGRESS.md", content: "# Progress" }],
		["flow-resource-patch", { project: "App", scope: "engine-internal", files: [] }]
	],
	neither: [
		["code-get", frontendSource], ["code-get", flowSource], ["code-rg", { project: "App", pattern: "items" }], ["code-run", flowSource],
		["code-check", frontendSource], ["flow-resource-get", { project: "App", path: "docs/generated/PROGRESS.md" }],
		["flow-resource-patch", { project: "App", path: "docs/backend-notes.md", content: "x" }], ["flow-project-reference", { project: "App", reference: "lib_flow_sql" }],
		["authoring-mutate", { project: "App", mutation: {} }], ["authoring-palette", { project: "App" }], ["requestable-execute", { requestable: "App.ListItems" }],
		["log-view", {}], ["tags-apply", { project: "App" }], ["flow-app-progress", { project: "App" }]
	]
};
for (var side in writes) {
	writes[side].forEach(function (entry) {
		var found = mcp._subagentCallSide(entry[0], entry[1]);
		assert(found === (side === "neither" ? "" : side), entry[0] + " " + JSON.stringify(entry[1]) + " writes " + side + ", not " + JSON.stringify(found));
	});
}

// Without the header, or with another value, nothing is refused.
[undefined, "", "both", "MistralAI-VibeCLI/3.0.3"].forEach(function (value) {
	headers = value === undefined ? {} : { "X-Convertigo-Subagent-Scope": value };
	assert(refusal("frontend-svelte-code-set", frontendSource) === null && refusal("project-save", { project: "App" }) === null,
		"no constructor scope, no refusal: " + value);
});

["backend", "Frontend"].forEach(function (header) {
	headers = { "X-Convertigo-Subagent-Scope": header, "X-Convertigo-Subagent-Run": "build-20261030-120000-0123abcd" };
	var scope = header.toLowerCase();
	var other = scope === "backend" ? "frontend" : "backend";
	writes[scope].concat(writes.neither).forEach(function (entry) {
		assert(refusal(entry[0], entry[1]) === null, scope + " constructor may call " + entry[0] + " " + JSON.stringify(entry[1]));
	});
	writes[other].forEach(function (entry) {
		var error = refusal(entry[0], entry[1]);
		assert(error && error.code === "SUBAGENT_SCOPE" && error.details.scope === scope && error.details.side === other &&
			new RegExp("owns the " + scope + " of the project: " + entry[0] + " writes the " + other).test(error.message),
			scope + " constructor is refused " + entry[0] + ": " + (error && error.message));
	});
	writes.main.forEach(function (entry) {
		var error = refusal(entry[0], entry[1]);
		assert(error && error.code === "SUBAGENT_SCOPE" && error.details.side === "main" && /belongs to the main agent/.test(error.message),
			scope + " constructor is refused the main agent's " + entry[0] + ": " + (error && error.message));
	});
	var hint = refusal(writes[other][0][0], writes[other][0][1]).hint;
	assert(scope === "frontend" ? /missing or wrong field .* openIssues/.test(hint) : /agreed inputs and output fields/.test(hint), "the hint fits the scope: " + hint);
});

// Through the dispatcher: the refusal is a tool error, no tool runs and nothing is relayed.
function dispatch(name, args, relayed) {
	var calls = [];
	var written = null;
	var ctx = {
		props: function (node) { return node.props; },
		lib: function () {
			return {
				requestValue: mcp.requestValue,
				toolError: mcp.toolError,
				subagentScopeRefusal: mcp.subagentScopeRefusal,
				legacyRelayTool: function () { return relayed === true; },
				legacyRelayCall: function () { calls.push("relay"); return { jsonrpc: "2.0", id: 9, result: { content: [], structuredContent: { ok: true } } }; }
			};
		},
		blockNames: function () { return relayed === true ? [] : ["mcp.tool.code.set", "mcp.tool.code.get"]; },
		convertigoContext: context,
		write: function (_path, value) { written = value; },
		callBlock: function (blockId) { calls.push(blockId); return mcp.jsonRpcResult(9, { content: [{ type: "text", text: "OK" }], structuredContent: { ok: true } }); }
	};
	var response = dispatcher.run(ctx, { props: { request: call(name, args) } });
	assert(written === response, "the dispatcher writes its answer");
	return { response: response, calls: calls };
}
headers = { "X-Convertigo-Subagent-Scope": "frontend" };
var refused = dispatch("code-set", flowSource, false);
assert(refused.calls.length === 0 && refused.response.result.structuredContent.error.code === "SUBAGENT_SCOPE" && refused.response.result.isError === true,
	"a frontend constructor writing a Flow gets a tool error and no tool runs: " + JSON.stringify(refused));
var allowed = dispatch("code-set", frontendSource, false);
assert(allowed.calls.length === 1 && allowed.response.result.structuredContent.ok === true, "its own side runs: " + JSON.stringify(allowed.calls));
var save = dispatch("project-save", { project: "App" }, true);
assert(save.calls.length === 0 && save.response.result.structuredContent.error.details.side === "main", "a relayed save is refused before the hop");
headers = {};
var mainSave = dispatch("project-save", { project: "App" }, true);
assert(mainSave.calls.join() === "relay", "the main agent saves through the relay");
var mainFlow = dispatch("code-set", flowSource, false);
assert(mainFlow.calls.length === 1, "the main agent writes either side");
print("subagent-scope-guard OK (" + count + " checks)");
