// Exercise the source-sync block and the real FlowScript compiler offline.
var File = java.io.File, files = Packages.org.apache.commons.io.FileUtils;
var mcpDir = String(arguments[0] || new File(".").getCanonicalPath());
var __flowEngineDir = String(arguments[1] || new File("../lib_flow_engine/_flow").getCanonicalPath());
var __flowProjectDir = mcpDir;
var project = java.nio.file.Files.createTempDirectory("flow-source-sync-").toFile().getCanonicalFile();
var attributes = new java.util.concurrent.ConcurrentHashMap();
Packages.com.twinsoft.convertigo.engine.Engine.initServletContext(new Packages.jakarta.servlet.ServletContext({
	getAttribute: function (name) { return attributes.get(name); },
	setAttribute: function (name, value) { attributes.put(name, value); },
	removeAttribute: function (name) { attributes.remove(name); }
}));
var engine = eval(String(files.readFileToString(new File(__flowEngineDir, "Engine.js"), "UTF-8")));
var path = "_flow/flows/Example.flow.js";
var file = new File(project, path);
var good = "function Example({ input, result }) { result.value = 42 }\n";
var bad = "function Example({ input, result }) {\n  result.value =\n}\n";
var draft = good.replace("42", "99");
var failures = [];
function assert(value, message) { if (!value) failures.push(message); }
function write(text) { files.writeStringToFile(file, text, "UTF-8"); }
function tool(name, args) {
	var block = name === "flow-source-sync" ? "mcp.tool.flow.source.sync" : "mcp.tools.call";
	var executed = JSON.parse(engine.run(JSON.stringify({
		flowSource: "function Probe({ input, result }) { result.response = " + block + "({ request: input.request }) }",
		input: { request: { jsonrpc: "2.0", id: 1, method: "tools/call",
			params: { name: name, arguments: Object.assign({ projectDir: String(project) }, args) } } }
	})));
	if (!executed.ok) throw new Error(JSON.stringify(executed));
	return executed.result.response.result;
}
function sync(dryRun) { return tool("flow-source-sync", { paths: [path], dryRun: dryRun }); }
function entry(response) { return response.structuredContent.results[0]; }
function noIgnoredArguments(response) { return JSON.stringify(response).indexOf("Ignored arguments") === -1; }
function diagnosticLocations(response) {
	var error = response.structuredContent.error;
	return (error && error.details && error.details.diagnostics || []).map(function (diagnostic) {
		return { code: diagnostic.code, line: diagnostic.line, sourcePath: diagnostic.sourcePath, path: diagnostic.path };
	});
}
function unchangedAfterSync() {
	var next = tool("flow-source-sync", { dryRun: false });
	return !next.isError && next.structuredContent.summary.checked === 0;
}

try {
	write(good);
	var edit = tool("code-set", { name: "Example", code: draft }).structuredContent;
	if (!edit.ok || !edit.workingCopy) throw new Error("Expected a valid working copy: " + JSON.stringify(edit));
	write(bad);
	var direct = tool("code-check", { name: "Example", code: bad });
	assert(!direct.isError && direct.structuredContent.revision === edit.revision && !noIgnoredArguments(direct),
		"Public code-check should still ignore inline source and check the working copy");
	var invalid = sync(true);
	assert(invalid.isError && entry(invalid).response.result.isError && !entry(invalid).applied,
		"Dry-run should refuse invalid disk bytes even when the working copy is valid");
	assert(noIgnoredArguments(invalid), "Invalid disk check should have no ignored-argument warning");
	var refusedSave = sync(false);
	assert(refusedSave.isError && !entry(refusedSave).applied &&
		JSON.stringify(entry(refusedSave).response.result) === JSON.stringify(entry(invalid).response.result),
		"Sync should refuse the same source at the check step, before promotion");
	assert(String(files.readFileToString(file, "UTF-8")) === bad, "Refusing sync should preserve disk bytes");
	write(" \n");
	assert(sync(true).isError, "A blank disk source should not fall back to the working copy");
	write(good);
	var valid = sync(true);
	var checked = entry(valid).response.result.structuredContent;
	assert(!valid.isError && !entry(valid).applied && checked.ok && checked.revision === edit.oldRevision,
		"Dry-run should accept valid disk bytes and report their revision");
	assert(noIgnoredArguments(valid), "Valid disk check should have no ignored-argument warning");
	assert(tool("code-check", { name: "Example" }).structuredContent.revision === edit.revision,
		"Dry-run should preserve the working copy");
	assert(String(files.readFileToString(file, "UTF-8")) === good, "Dry-run should preserve disk bytes");
	var saved = sync(false);
	assert(!saved.isError && entry(saved).applied && noIgnoredArguments(saved), "Sync should save valid disk bytes");
	assert(String(files.readFileToString(file, "UTF-8")) !== good, "The v2 fixture should be reformatted");
	assert(entry(saved).rewritten && saved.structuredContent.summary.rewritten === 1,
		"Sync should report promotion formatting as normalization");
	assert(unchangedAfterSync(), "The reformatted v2 source should not remain pending");
	var ran = tool("code-run", { name: "Example" });
	assert(!ran.isError && ran.structuredContent.result.value === 42, "Sync should save the file's program");

	var v3 = "const _flow = { sourceVersion: 3 }\n\nfunction Example({ result }) { result.value = 43 }\n\n";
	write(v3);
	var savedV3 = sync(false);
	assert(!savedV3.isError && entry(savedV3).applied && savedV3.structuredContent.summary.rewritten === 0,
		"Sync should save v3 without reporting normalization");
	assert(String(files.readFileToString(file, "UTF-8")) === v3, "The v3 source should be preserved byte for byte");
	assert(unchangedAfterSync(), "The unchanged v3 source should not remain pending");

	// Keep valid code on disk so the public check can only reject the invalid working copy.
	tool("code-set", { name: "Example", code: bad });
	var checkedDraft = tool("code-check", { name: "Example" });
	var expectedLocations = diagnosticLocations(checkedDraft);
	assert(checkedDraft.isError && expectedLocations.length && expectedLocations[0].code && expectedLocations[0].line > 0,
		"The independent draft check should report a diagnostic code and line");
	assert(JSON.stringify(diagnosticLocations(entry(invalid).response.result)) === JSON.stringify(expectedLocations),
		"Dry-run should preserve the diagnostic codes and locations from code-check on the same text");

	// Place the editor write after the real promotion and before source-sync reads the file back.
	write(v3.replace("43", "44"));
	var validation = entry(sync(true)).response;
	var adapter = eval(String(files.readFileToString(new File(mcpDir, "_flow/lib/source-sync.js"), "UTF-8")));
	var raced = adapter.sync({
		lib: function () { return {
			runToolBlock: function () { return validation; },
			stableToolCalled: function () {},
			jsonRpcResult: function (id, result) { return { id: id, result: result }; }
		}; },
		callBlock: function (block, props) {
			var promoted = tool(props.request.params.name, props.request.params.arguments);
			if (promoted.structuredContent.promoted) write(v3);
			return { result: promoted };
		}
	}, { id: 1 }, { projectDir: String(project), paths: [path] }).result;
	assert(!raced.isError && entry(raced).applied && /Changed on disk/.test(entry(raced).note) && !entry(raced).rewritten,
		"An edit after promotion should remain pending rather than count as normalization");
	var retry = tool("flow-source-sync", { dryRun: false });
	assert(!retry.isError && retry.structuredContent.summary.applied === 1 && unchangedAfterSync(),
		"The next sync should apply the edit even when it restores the previous snapshot");

	var sourceA = v3.replace("43", "45"), sourceB = v3.replace("43", "46");
	write(sourceA);
	var promoteSource = String(files.readFileToString(new File(mcpDir, "_flow/blocks/mcp/tool/flow/code/promote.block.js"), "UTF-8"));
	var promote = eval(promoteSource.substring(promoteSource.indexOf("(function")));
	var mcp = eval(String(files.readFileToString(new File(mcpDir, "_flow/lib/mcp.js"), "UTF-8")));
	var engineWrite, registered;
	mcp.registerFlowDbo = function (args, value) { registered = value; return { registered: true }; };
	var ctx = {
		lib: function (name) { return name === "mcp" ? mcp : { assertWritable: function () {} }; },
		props: function (node) { return node; },
		write: function () {},
		callBlock: function (block, props) { return promote.run(ctx, props); },
		flowCodeCheck: function (args) { return JSON.parse(engine.flowCodeCheck(JSON.stringify(args))); },
		flowCodePromote: function (args) {
			var value = JSON.parse(engine.flowCodePromote(JSON.stringify(args)));
			if (value.ok) {
				engineWrite = value;
				// The editor writes B before any MCP flowGet can run.
				write(sourceB);
			}
			return value;
		},
		flowGet: function (name) {
			return tool("code-get", { name: name }).structuredContent;
		}
	};
	var racedInside = adapter.sync(ctx, { id: 1 }, { projectDir: String(project), paths: [path] }).result;
	var promotedInside = entry(racedInside).response.result.structuredContent;
	assert(engineWrite && engineWrite.saved.code === sourceA, "The engine should write A before the editor writes B");
	assert(engineWrite && promotedInside.revision === engineWrite.saved.codeRevision,
		"Promotion should return the revision the engine wrote even if the editor has already written B");
	assert(registered && registered.code === sourceA && registered.source === engineWrite.saved.source,
		"Flow registration should receive the engine's saved code and source for A");
	assert(!racedInside.isError && entry(racedInside).applied &&
		/Changed on disk/.test(entry(racedInside).note) && !entry(racedInside).rewritten,
		"An edit between engine promotion and the MCP reread should remain pending");
	var retryInside = tool("flow-source-sync", { dryRun: false });
	var ranB = tool("code-run", { name: "Example" });
	assert(!retryInside.isError && retryInside.structuredContent.summary.applied === 1 &&
		!ranB.isError && ranB.structuredContent.result.value === 46 && unchangedAfterSync(),
		"The next sync should apply B and leave no changes pending");
	if (failures.length) throw new Error(failures.join("\n"));
	print("source-sync-disk-check OK");
} finally {
	files.deleteDirectory(project);
}
