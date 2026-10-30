// The Flow MCP relays a fixed list of Convertigo MCP (lib_ConvertigoMCP) tools: tools/list adds their descriptors,
// tools/call forwards the call with the client headers and the request id, and nothing else goes through.
var directory = new java.io.File(arguments[0]).getCanonicalFile();
var source = String(Packages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(directory, "_flow/lib/mcp.js"), "UTF-8"));
var mcp = eval(source);
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }

var seen = [];
var consent = false, unavailable = false, reports = 0;
var feedback = { status: "queued", reportId: "fixture-report", argumentWarning: "Ignored argument extra.", operatorNote: "Check the fixture." };
var server = com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1", 0), 0);
server.createContext("/convertigo/api/mcp", new com.sun.net.httpserver.HttpHandler({
	handle: function (exchange) {
		var body = JSON.parse(String(new java.lang.String(exchange.getRequestBody().readAllBytes(), "UTF-8")));
		seen.push({
			query: String(exchange.getRequestURI().getQuery()),
			userAgent: String(exchange.getRequestHeaders().getFirst("User-Agent")),
			authorization: String(exchange.getRequestHeaders().getFirst("Authorization")),
			guidance: String(exchange.getRequestHeaders().getFirst("X-Convertigo-Guidance-Version")),
			provider: exchange.getRequestHeaders().getFirst("X-Convertigo-Agent-Provider"),
			cookie: exchange.getRequestHeaders().getFirst("Cookie"),
			conversation: String(exchange.getRequestHeaders().getFirst("X-Convertigo-Conversation-Id")),
			body: body
		});
		var answer = body.method === "tools/list"
			? { jsonrpc: "2.0", id: body.id, result: { tools: [
				{ name: "scheduler-apply", description: "Schedules.", inputSchema: { type: "object" } },
				{ name: "databaseobject-tree-apply", description: "Mutates.", inputSchema: { type: "object" } },
				{ name: "code-set", description: "Not the Flow one.", inputSchema: { type: "object" } }
			] } }
			: { jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "ok" }], structuredContent: { echoed: body.params } } };
		// Model the legacy endpoint's live consent check, including a different caller.
		var allowed = consent && seen[seen.length - 1].authorization === "Bearer client-token";
		if (body.method === "tools/list" && allowed) {
			answer.result.tools.push({ name: "report-create", description: "Feedback.", inputSchema: { type: "object" },
				outputSchema: { type: "object", properties: { status: { type: "string" } } } });
			answer.result.tools.push({ name: "nocode-report-create", description: "Different authentication.", inputSchema: { type: "object" } });
		}
		if (body.method === "tools/call" && body.params.name === "report-create") {
			var value = allowed ? feedback : { error: { message: "Reporting is disabled" } };
			if (allowed) reports++;
			answer.result = { isError: !allowed, content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value };
		}
		// lib_ConvertigoMCP answers a jsonOnly=true call with structuredContent only.
		if (body.method === "tools/call" && body.params.arguments.structuredOnly) {
			answer = { jsonrpc: "2.0", id: body.id, result: { structuredContent: { ok: true, name: "Saved", project: "P" } } };
		}
		if(body.method==='tools/call' && body.params.arguments.fail) {
            answer={jsonrpc:'2.0',id:body.id,result:{isError:!/^MistralAI-VibeCLI\//.test(seen[seen.length-1].userAgent),content:[{type:'text',text:'Legacy failure'}],structuredContent:{error:{code:'LEGACY_FAIL',message:'Legacy failure',details:{context:'string'}}}}};
        }
		var bytes = new java.lang.String(JSON.stringify(answer)).getBytes("UTF-8");
		if (unavailable) bytes = new java.lang.String("unavailable").getBytes("UTF-8");
		exchange.sendResponseHeaders(unavailable ? 503 : 200, bytes.length);
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
	assert(mcp.legacyRelayTools(ctx).length === 1 && seen.length === 2, "each list refreshes caller-dependent descriptors");

	assert(mcp.legacyRelayTool("scheduler-apply") && mcp.legacyRelayTool("requestable-execute"), "relayed tools");
	assert(mcp.legacyRelayTool("browser-verify"), "the visual verifier is relayed for models without vision");
	["databaseobject-tree-apply", "batch-call", "project-delete", "mobile-builder-open", "code-set", "nocode-report-create", ""].forEach(function (name) {
		assert(!mcp.legacyRelayTool(name), name + " is not relayed");
	});

	var answer = mcp.legacyRelayCall(ctx, { jsonrpc: "2.0", id: 42, method: "tools/call", params: { name: "scheduler-apply", arguments: { action: "upsert" } } });
	var call = seen[seen.length - 1];
	assert(answer.id === 42 && answer.result.structuredContent.echoed.arguments.action === "upsert", "the answer keeps the request id and the result");
	assert(call.body.method === "tools/call" && call.body.params.name === "scheduler-apply", "tools/call forwarded");
	assert(call.authorization === "Bearer client-token" && call.guidance === "g1", "client token and guidance version forwarded");
	assert(call.cookie === null, "cookies are not forwarded");
	// A CallToolResult requires content: the MCP Python SDK (Vibe) rejects a structuredContent-only answer.
	var structuredOnly = mcp.legacyRelayCall(ctx, { jsonrpc: "2.0", id: 43, method: "tools/call", params: { name: "project-save", arguments: { structuredOnly: true } } });
	assert(structuredOnly.result.content && structuredOnly.result.content.length === 1 && structuredOnly.result.content[0].type === "text",
		"a structuredContent-only answer gets a text content: " + JSON.stringify(structuredOnly));
	assert(/^OK\. Saved\. .*structuredContent/.test(structuredOnly.result.content[0].text), "the text summarizes the result: " + structuredOnly.result.content[0].text);
	assert(structuredOnly.result.structuredContent.project === "P" && structuredOnly.id === 43, "the structured result and the id stay intact");

	headers["X-Convertigo-Agent-Provider"] = "claude";
	var claudeTools = mcp.legacyRelayTools(ctx);
	assert(String(seen[seen.length - 1].provider) === "claude" && claudeTools !== tools, "the catalog uses the current provider");
	delete headers["X-Convertigo-Agent-Provider"];

    headers['User-Agent']='MistralAI-VibeCLI/1.0';
    var beforeVibe=seen.length, vibeTools=mcp.legacyRelayTools(ctx);
    assert(seen.length===beforeVibe+1 && seen[seen.length-1].userAgent===headers['User-Agent'],'Vibe catalog must get its forwarded User-Agent');
    assert(vibeTools!==tools,'Ordinary and Vibe descriptors must not be shared');
    [false,true].forEach(function(vibe){
        headers['User-Agent']=vibe?'MistralAI-VibeCLI/1.0':'ordinary';
        var errorAnswer=mcp.legacyRelayCall(ctx,{jsonrpc:'2.0',id:44,method:'tools/call',params:{name:'scheduler-apply',arguments:{fail:true}}});
        var expected={jsonrpc:'2.0',id:44,result:{isError:!vibe,content:[{type:'text',text:'Legacy failure'}],structuredContent:{error:{code:'LEGACY_FAIL',message:'Legacy failure',details:{context:'string'}}}}};
        assert(JSON.stringify(errorAnswer)===JSON.stringify(expected),'Legacy tool error changed during relay');
    });
	assert(mcp.legacyRelayTool("report-create"), "report-create belongs to the fixed relay list");
	var reportRequest = { jsonrpc: "2.0", id: 51, method: "tools/call", params: { name: "report-create", arguments: { area: "tool", subjectId: "fixture", severity: "low", summary: "Missing capability", extra: true } } };
	assert(mcp.legacyRelayCall(ctx, reportRequest).result.isError === true && reports === 0, "a direct call cannot bypass withdrawn consent");
	consent = true;
	var enabled = mcp.legacyRelayTools(ctx).filter(function (t) { return t.name === "report-create"; });
	assert(enabled.length === 1 && enabled[0].outputSchema.properties.status.type === "string", "consent appears immediately with the legacy schema");
	headers["X-Convertigo-Conversation-Id"] = "fixture-conversation";
	var beforeReport = seen.length;
	var created = mcp.legacyRelayCall(ctx, reportRequest);
	assert(seen.length === beforeReport + 1 && reports === 1, "report call makes one hop without a catalog preflight");
	assert(created.id === 51 && JSON.stringify(created.result.structuredContent) === JSON.stringify(feedback), "feedback metadata stays intact");
	assert(created.result.content[0].text === JSON.stringify(feedback), "legacy text stays intact");
	assert(seen[seen.length - 1].conversation === "fixture-conversation", "conversation context reaches the legacy endpoint");
	headers.Authorization = "Bearer other-client";
	assert(mcp.legacyRelayTools(ctx).length === 1, "another caller does not inherit consent-sensitive descriptors");
	assert(mcp.legacyRelayCall(ctx, reportRequest).result.isError === true && reports === 1, "another caller cannot create a report");
	headers.Authorization = "Bearer client-token";
	consent = false;
	assert(mcp.legacyRelayTools(ctx).length === 1, "revoked consent disappears on the next list");
	assert(mcp.legacyRelayCall(ctx, reportRequest).result.isError === true && reports === 1, "revocation is checked again at execution");
	unavailable = true;
	assert(mcp.legacyRelayTools(ctx).length === 0, "an unavailable endpoint cannot reuse a stale descriptor");
	unavailable = false;
	assert(mcp.legacyRelayTools(ctx).length === 1, "endpoint recovery is immediately visible");
	java.lang.System.setProperty("convertigo.flow.mcp.legacyRelay", "false");
	assert(!mcp.legacyRelayTool("scheduler-apply"), "the relay can be disabled");
	java.lang.System.clearProperty("convertigo.flow.mcp.legacyRelay");
} finally {
	server.stop(0);
}

var down = mcp.legacyRelayCall({ convertigoContext: function () { return {}; } }, { jsonrpc: "2.0", id: 7, params: { name: "log-view" } });
assert(JSON.stringify(down).indexOf("relay failed for log-view") !== -1, "an unreachable relay answers a tool error: " + JSON.stringify(down));
print("legacy-relay-contract OK (" + count + " checks)");
