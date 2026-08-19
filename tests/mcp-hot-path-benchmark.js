var engineDir = arguments.length > 0 ? arguments[0] : "../lib_flow_engine/libs/flow";
var projectDir = arguments.length > 1 ? arguments[1] : ".";
var iterations = arguments.length > 2 ? Math.max(3, Number(arguments[2])) : 7;
var profileMode = arguments.length > 3 && String(arguments[3]) === "deep" ? true : "envelope";
var engineSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
	new java.io.File(engineDir, "Engine.js"), "UTF-8"));
var mcpFlowSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
	new java.io.File(projectDir, "libs/flows/McpServer.flow.js"), "UTF-8"));
var __flowEngineDir = String(new java.io.File(engineDir).getAbsolutePath());
var __flowProjectDir = String(new java.io.File(projectDir).getAbsolutePath());
var engine = eval(engineSource);

function percentile(values, ratio) {
	var sorted = values.slice().sort(function (left, right) { return left - right; });
	return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
}

function elapsedMs(started) {
	return Number(java.lang.System.nanoTime() - started) / 1000000;
}

function assertTrue(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

function runRequest(request) {
	var started = java.lang.System.nanoTime();
	var response = JSON.parse(engine.run(JSON.stringify(request)));
	return { elapsedMs: elapsedMs(started), response: response };
}

function mcpRequest(payload) {
	return {
		flowQName: "lib_flow_mcp.McpServer",
		flowSource: mcpFlowSource,
		includeTrace: false,
		profile: profileMode,
		input: { request: JSON.stringify(payload) }
	};
}

function benchmark(name, factory, validate) {
	var cold = runRequest(factory(-1));
	if (validate) {
		validate(cold.response);
	}
	for (var warm = 0; warm < 2; warm++) {
		runRequest(factory(warm));
	}
	var timings = [];
	var last = null;
	for (var index = 0; index < iterations; index++) {
		last = runRequest(factory(index));
		if (validate) {
			validate(last.response);
		}
		timings.push(last.elapsedMs);
	}
	var profile = last && last.response && last.response.profile || {};
	var hotP95Ms = percentile(timings, 0.95);
	return {
		name: name,
		iterations: iterations,
		coldMs: cold.elapsedMs,
		minMs: Math.min.apply(Math, timings),
		p50Ms: percentile(timings, 0.50),
		p95Ms: hotP95Ms,
		maxMs: Math.max.apply(Math, timings),
		thresholds: {
			coldMs: 2000,
			hotMs: 500,
			coldExceeded: cold.elapsedMs > 2000,
			hotExceeded: hotP95Ms > 500
		},
		coldProfile: cold.response && cold.response.profile || {},
		profile: profile
	};
}

var results = [];
results.push(benchmark("engine-empty", function () {
	return {
		flowQName: "Benchmark.Empty",
		flowSource: "function Empty({ result }) {\n result.ok = true\n return result\n}",
		includeTrace: false,
		profile: profileMode
	};
}));
results.push(benchmark("mcp-tools-list", function (index) {
	return mcpRequest({ jsonrpc: "2.0", id: 1000 + index, method: "tools/list" });
}, function (response) {
	var tools = response && response.result && response.result.result && response.result.result.tools;
	assertTrue(response && response.ok === true && Array.isArray(tools),
		"tools/list benchmark did not return an MCP tool array");
	assertTrue(tools.some(function (tool) { return tool.name === "flow-list"; }),
		"tools/list benchmark lost the flow-list descriptor");
}));
results.push(benchmark("mcp-flow-list", function (index) {
	return mcpRequest({
		jsonrpc: "2.0",
		id: 2000 + index,
		method: "tools/call",
		params: { name: "flow-list", arguments: { projectDir: __flowProjectDir } }
	});
}, function (response) {
	var result = response && response.result && response.result.result;
	assertTrue(response && response.ok === true && result && !result.error,
		"flow-list benchmark did not return a successful MCP result");
}));

print(JSON.stringify({
	engineDir: String(new java.io.File(engineDir).getAbsolutePath()),
	projectDir: __flowProjectDir,
	results: results
}));
