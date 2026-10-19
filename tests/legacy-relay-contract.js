// The Flow MCP relays a fixed list of Convertigo MCP (lib_ConvertigoMCP) tools: tools/list adds their descriptors,
// tools/call forwards the call with the client headers and the request id, and nothing else goes through.
var directory = new java.io.File(arguments[0]).getCanonicalFile();
var source = String(Packages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(directory, "_flow/lib/mcp.js"), "UTF-8"));
var mcp = eval(source);
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }

var seen = [];
var server = com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1", 0), 0);
server.createContext("/convertigo/api/mcp", new com.sun.net.httpserver.HttpHandler({
	handle: function (exchange) {
		var body = JSON.parse(String(new java.lang.String(exchange.getRequestBody().readAllBytes(), "UTF-8")));
		seen.push({
			query: String(exchange.getRequestURI().getQuery()),
			authorization: String(exchange.getRequestHeaders().getFirst("Authorization")),
			guidance: String(exchange.getRequestHeaders().getFirst("X-Convertigo-Guidance-Version")),
			cookie: exchange.getRequestHeaders().getFirst("Cookie"),
			body: body
		});
		var answer = body.method === "tools/list"
			? { jsonrpc: "2.0", id: body.id, result: { tools: [
				{ name: "scheduler-apply", description: "Schedules.", inputSchema: { type: "object" } },
				{ name: "databaseobject-tree-apply", description: "Mutates.", inputSchema: { type: "object" } },
				{ name: "code-set", description: "Not the Flow one.", inputSchema: { type: "object" } }
			] } }
			: { jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "ok" }], structuredContent: { echoed: body.params } } };
		var bytes = new java.lang.String(JSON.stringify(answer)).getBytes("UTF-8");
		exchange.sendResponseHeaders(200, bytes.length);
		exchange.getResponseBody().write(bytes);
		exchange.close();
	}
}));
server.start();
try {
	var headers = { "Authorization": "Bearer client-token", "X-Convertigo-Guidance-Version": "g1", "Cookie": "JSESSIONID=secret" };
	var ctx = { convertigoContext: function () { return { httpServletRequest: {
		getScheme: function () { return "http"; },
		getLocalPort: function () { return server.getAddress().getPort(); },
		getContextPath: function () { return "/convertigo"; },
		getHeader: function (name) { return headers[name] === undefined ? null : headers[name]; }
	} }; } };

	var tools = mcp.legacyRelayTools(ctx);
	assert(tools.length === 1 && tools[0].name === "scheduler-apply", "only listed relay tools are kept: " + JSON.stringify(tools));
	assert(/Relayed to the Convertigo MCP/.test(tools[0].description), "relayed tools say so");
	assert(seen[0].query === "jsonOnly=true" && seen[0].body.method === "tools/list", "tools/list on the Convertigo MCP endpoint");
	assert(mcp.legacyRelayTools(ctx) === tools && seen.length === 1, "the relayed catalog is cached");

	assert(mcp.legacyRelayTool("scheduler-apply") && mcp.legacyRelayTool("requestable-execute"), "relayed tools");
	["databaseobject-tree-apply", "batch-call", "project-delete", "mobile-builder-open", "code-set", ""].forEach(function (name) {
		assert(!mcp.legacyRelayTool(name), name + " is not relayed");
	});

	var answer = mcp.legacyRelayCall(ctx, { jsonrpc: "2.0", id: 42, method: "tools/call", params: { name: "scheduler-apply", arguments: { action: "upsert" } } });
	var call = seen[1];
	assert(answer.id === 42 && answer.result.structuredContent.echoed.arguments.action === "upsert", "the answer keeps the request id and the result");
	assert(call.body.method === "tools/call" && call.body.params.name === "scheduler-apply", "tools/call forwarded");
	assert(call.authorization === "Bearer client-token" && call.guidance === "g1", "client token and guidance version forwarded");
	assert(call.cookie === null, "cookies are not forwarded");

	java.lang.System.setProperty("convertigo.flow.mcp.legacyRelay", "false");
	assert(!mcp.legacyRelayTool("scheduler-apply"), "the relay can be disabled");
	java.lang.System.clearProperty("convertigo.flow.mcp.legacyRelay");
} finally {
	server.stop(0);
}

var down = mcp.legacyRelayCall({ convertigoContext: function () { return {}; } }, { jsonrpc: "2.0", id: 7, params: { name: "log-view" } });
assert(JSON.stringify(down).indexOf("relay failed for log-view") !== -1, "an unreachable relay answers a tool error: " + JSON.stringify(down));
print("legacy-relay-contract OK (" + count + " checks)");
