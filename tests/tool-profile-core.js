// The default tools/list of an HTTP client is the core profile: the tools the agents use, the ones their answers send
// them to, and tools-more for the others; no generic outputSchema and no repeated property description. A tool outside
// it stays callable by its name and through tools-more, with the same answer. Arguments: this project, then
// lib_flow_engine/_flow.
var projectDir = String(arguments[0]), engineDir = String(arguments[1]);
var io = Packages.org.apache.commons.io.FileUtils;
var __flowProjectDir = String(new java.io.File(projectDir).getCanonicalPath());
var __flowEngineDir = String(new java.io.File(engineDir).getCanonicalPath());
var checks = 0;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
function read(path) { return String(io.readFileToString(new java.io.File(projectDir, path), "UTF-8")); }
var engine = eval(String(io.readFileToString(new java.io.File(engineDir, "Engine.js"), "UTF-8")));
var mcp = eval(read("_flow/lib/mcp.js"));
var router = read("_flow/flows/McpServer.flow.js");

function run(source, input) {
	var execution = JSON.parse(engine.run(JSON.stringify({ flowSource: source, includeTrace: false, input: input || {} })));
	assert(execution.ok === true, "Flow failed: " + JSON.stringify(execution).substring(0, 2000));
	return execution.result;
}
function available(profile) {
	return run("const _flow={sourceVersion:2}\nfunction T({input,config,result}) {\n local.tools=mcp.tools.available({profile:\"" +
		profile + "\"})\n return({value:local.tools})\n}\n");
}
function rpc(id, method, params) {
	return run(router, { request: JSON.stringify({ jsonrpc: "2.0", id: id, method: method, params: params || {} }) });
}
function call(id, name, args) { return rpc(id, "tools/call", { name: name, arguments: args }).result; }
function names(tools) { return tools.map(function (tool) { return tool.name; }); }
function has(list, name) { return list.indexOf(name) !== -1; }
function wire(tools) { return JSON.stringify({ jsonrpc: "2.0", id: 1, result: { tools: tools } }).length; }
function text(result) { return (result.content || []).map(function (block) { return block.text || ""; }).join("\n"); }

// 1. The profile: core for an HTTP client, all on its header or without an HTTP request; an explicit one wins.
function fakeCtx(headers) {
	return { convertigoContext: function () {
		return headers === null ? null : { httpServletRequest: { getHeader: function (name) { return headers[name] === undefined ? null : headers[name]; } } };
	} };
}
assert(mcp.toolProfile(fakeCtx(null)) === "all", "a call without an HTTP request keeps the complete catalog");
assert(mcp.toolProfile(fakeCtx({})) === "core", "an HTTP client gets the core profile by default");
assert(mcp.toolProfile(fakeCtx({ "X-Convertigo-Mcp-Tools": " All " })) === "all", "X-Convertigo-Mcp-Tools: all lists every tool");
assert(mcp.toolProfile(fakeCtx({ "X-Convertigo-Mcp-Tools": "other" })) === "core", "an unknown header value keeps core");
assert(mcp.toolProfile(fakeCtx({ "X-Convertigo-Mcp-Tools": "all" }), "core") === "core", "an explicit profile wins");

// 2. The core list: every core tool, tools-more, nothing else.
var CORE = ["authoring-mutate", "authoring-palette", "authoring-tree", "code-check", "code-discard", "code-get", "code-patch",
	"code-promote", "code-rg", "code-run", "code-set", "flow-app-progress", "flow-block-get", "flow-block-mock", "flow-block-mock-list",
	"flow-catalog", "flow-list", "flow-project-bootstrap", "flow-requestable-list", "flow-resource-get", "flow-resource-search",
	"flow-search", "flow-test", "frontend-svelte-action", "frontend-svelte-mutate", "tools-more"];
var HIDDEN = ["flow-entity-model-set", "flow-crud-upsert", "flow-fullsync-scaffold", "tags-apply", "flow-cache-info",
	"flow-resource-patch", "flow-object-remove", "frontend-svelte-tree", "code-analyze"];
var core = available("core"), coreNames = names(core);
CORE.forEach(function (name) { assert(has(coreNames, name), "core profile lacks " + name + ": " + coreNames.join(" ")); });
coreNames.forEach(function (name) { assert(mcp.coreTool(name), "core profile lists " + name + ", which is not a core tool"); });
HIDDEN.forEach(function (name) { assert(!has(coreNames, name), "core profile lists " + name); });

// 3. The complete list keeps every public tool, without tools-more.
var all = available("all"), allNames = names(all);
assert(all.length >= 50, "the complete profile lost public tools: " + all.length);
CORE.concat(HIDDEN).forEach(function (name) {
	if (name !== "tools-more") assert(has(allNames, name), "the complete profile lacks " + name);
});
assert(!has(allNames, "tools-more"), "the complete profile needs no tools-more");
assert(JSON.stringify(names(rpc(2, "tools/list").result.tools)) === JSON.stringify(allNames),
	"tools/list without an HTTP request is the complete profile");

// 4. No generic outputSchema, no short property description repeated within one list.
var generic = JSON.stringify(mcp.toolOutputSchema());
[core, all].forEach(function (tools) {
	var seen = {};
	tools.forEach(function (tool) {
		assert(!tool.outputSchema || JSON.stringify(tool.outputSchema) !== generic, tool.name + " declares the generic outputSchema");
		var properties = tool.inputSchema && tool.inputSchema.properties || {};
		Object.keys(properties).forEach(function (key) {
			var description = properties[key] && properties[key].description;
			if (typeof description !== "string" || description.length > 300) return; // a format contract stays on each tool
			assert(!seen[key + "\u0000" + description], tool.name + "." + key + " repeats its description");
			seen[key + "\u0000" + description] = true;
		});
	});
});
assert(core.filter(function (tool) { return tool.name === "flow-search"; })[0].inputSchema.properties.project.type === "string",
	"a property keeps its schema when its description is not repeated");

// 5. The witness: the core answer is at most half of the complete one as it was (generic schemas included).
var before = wire(all) + (all.length - 1) * generic.length; // every tool but flow-resource-get declared it
var after = wire(core);
print("tools/list wire chars: core " + after + " (" + core.length + " tools), all " + wire(all) + " (" + all.length +
	" tools), all with the generic outputSchema " + before + "; core/before " + Math.round(after * 100 / before) + "%");
assert(after * 2 <= before, "the core tools/list is not at most half of the previous complete one: " + after + " / " + before);

// 6. tools-more lists the other tools and gives one complete descriptor.
var listed = call(10, "tools-more", {});
assert(!listed.isError && listed.structuredContent.tools.length === all.length - core.length + 1,
	"tools-more({}) lists the tools outside core: " + JSON.stringify(listed).substring(0, 800));
var moreNames = names(listed.structuredContent.tools);
HIDDEN.forEach(function (name) { assert(has(moreNames, name), "tools-more({}) lacks " + name); });
assert(!has(moreNames, "code-run"), "tools-more({}) lists a core tool");
var described = call(11, "tools-more", { name: "flow-entity-model-set" }).structuredContent;
assert(described.tool && described.tool.name === "flow-entity-model-set" && described.tool.inputSchema.required.indexOf("expectedRevision") !== -1 &&
	/Format version 2/.test(described.tool.inputSchema.properties.model.description) && described.tool.inputSchema.properties.project.description,
	"tools-more({name}) returns the complete descriptor: " + JSON.stringify(described).substring(0, 800));
assert(call(12, "tools-more", { name: "code-run" }).structuredContent.listed === true, "a core tool is called directly");
var unknown = call(13, "tools-more", { name: "no-such-tool" });
assert(unknown.isError === true && unknown.structuredContent.error.code === "UNKNOWN_TOOL", "an unknown tool name is refused");
var badArguments = call(14, "tools-more", { name: "flow-cache-info", arguments: "{not json" });
assert(badArguments.isError === true && badArguments.structuredContent.error.code === "INVALID_ARGUMENT", "arguments must be an object");

// 6b. The natural forms (benchmark runs of 06/11): a name with _ or a host prefix, a list of names, {arguments:{}} without
// a name; an unknown name gives the closest tools and the exact form; a relayed tool absent here says how to prove instead.
var underscored = call(15, "tools-more", { name: "flow_cache_info" });
assert(!underscored.isError && underscored.structuredContent.tool && underscored.structuredContent.tool.name === "flow-cache-info",
	"tools-more accepts a name written with _: " + JSON.stringify(underscored).substring(0, 600));
var prefixed = call(16, "tools-more", { name: "mcp__convertigo-flow__flow-cache-info" });
assert(!prefixed.isError && prefixed.structuredContent.tool.name === "flow-cache-info", "tools-more accepts a host-prefixed name");
var several = call(17, "tools-more", { name: ["flow-cache-info", "flow_entity_model_set", "code-run", "no-such-tool"] });
assert(!several.isError && names(several.structuredContent.tools).join() === "flow-cache-info,flow-entity-model-set" &&
	several.structuredContent.listed.join() === "code-run" && several.structuredContent.unknown[0].name === "no-such-tool",
	"tools-more accepts a list of names: " + JSON.stringify(several).substring(0, 800));
var emptyArguments = call(18, "tools-more", { arguments: {} });
assert(!emptyArguments.isError && emptyArguments.structuredContent.tools.length === listed.structuredContent.tools.length,
	"tools-more({arguments:{}}) lists the tools: " + JSON.stringify(emptyArguments).substring(0, 600));
var namelessArguments = call(19, "tools-more", { arguments: { project: "App" } });
assert(namelessArguments.isError === true && /name/.test(namelessArguments.structuredContent.error.message) &&
	/tools-more\(\{name:"[a-z-]+", arguments:/.test(namelessArguments.structuredContent.error.hint),
	"arguments without a name ask for the name with the exact form: " + JSON.stringify(namelessArguments).substring(0, 600));
var close = call(60, "tools-more", { name: "flow-cache-infos" });
assert(close.isError === true && close.structuredContent.error.code === "UNKNOWN_TOOL" &&
	close.structuredContent.error.details.closest[0] === "flow-cache-info" &&
	/tools-more\(\{name:"flow-cache-info"\}\)/.test(close.structuredContent.error.hint),
	"an unknown name gives the closest tools and the exact form: " + JSON.stringify(close).substring(0, 800));
var browser = call(61, "tools-more", { name: "browser-verify" });
assert(browser.isError === true && browser.structuredContent.error.code === "UNKNOWN_TOOL" &&
	/not offered/.test(browser.structuredContent.error.message) && /Playwright/.test(browser.structuredContent.error.hint),
	"a relayed tool absent here says how to prove the page instead: " + JSON.stringify(browser).substring(0, 800));
var underscoredRun = mcp.parseRequest({ jsonrpc: "2.0", id: 62, method: "tools/call",
	params: { name: "tools-more", arguments: { name: "flow_cache_info", arguments: {} } } }, {});
assert(underscoredRun.params.name === "flow-cache-info", "tools-more runs a tool named with _: " + JSON.stringify(underscoredRun));

// 7. A tool outside core stays callable by its name, and tools-more runs it with the same answer.
function comparable(result) {
	var structured = result.structuredContent || {};
	return JSON.stringify({ isError: result.isError === true, keys: Object.keys(structured).sort(),
		code: structured.error && structured.error.code || null });
}
[["flow-entity-model-get", { project: "NoSuchProjectP1" }], ["flow-cache-info", {}]].forEach(function (entry, index) {
	var direct = call(20 + index, entry[0], entry[1]);
	assert(!/Unknown Flow MCP tool/.test(text(direct)), entry[0] + " is no longer callable: " + text(direct));
	var proxied = call(30 + index, "tools-more", { name: entry[0], arguments: entry[1] });
	assert(comparable(proxied) === comparable(direct), "tools-more answered " + entry[0] + " differently: " +
		comparable(proxied) + " / " + comparable(direct));
	var serialized = call(40 + index, "tools-more", { name: entry[0], arguments: JSON.stringify(entry[1]) });
	assert(comparable(serialized) === comparable(direct), "arguments serialized as JSON text are accepted for " + entry[0]);
});

// 8. The rewrite happens before the token guard and the trace, for a single request and in a batch.
var single = mcp.parseRequest({ jsonrpc: "2.0", id: 50, method: "tools/call",
	params: { name: "tools-more", arguments: { name: "flow-cache-info", arguments: { a: 1 } } } }, {});
assert(single.params.name === "flow-cache-info" && single.params.arguments.a === 1 && single.__flowMcpVia === "tools-more",
	"tools-more({name, arguments}) becomes the call of that tool: " + JSON.stringify(single));
var batch = mcp.parseRequest([{ jsonrpc: "2.0", id: 51, method: "tools/call", params: { name: "tools-more", arguments: { name: "tags-get", arguments: {} } } },
	{ jsonrpc: "2.0", id: 52, method: "tools/call", params: { name: "tools-more", arguments: {} } }], {});
assert(batch[0].params.name === "tags-get" && batch[1].params.name === "tools-more", "a batch rewrites only the calls that run a tool");

print("tool-profile-core OK (" + checks + " checks, core " + core.length + " tools)");
