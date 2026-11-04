// The stable results of the Flow MCP (mcp.js stableLookup / stableToolLookup): tools/list with its relayed part, the
// guides and skills, flow-catalog and authoring-palette are answered again from the store only to an authenticated
// caller of the same kind, scope, identity and headers, while what they depend on stays the same; the envelope carries
// the id of the new request and the result is the one computed. Runs McpServer end to end on a copy of this project
// (its guide is edited), with a disposable JWT store and workspace and a model of the legacy endpoint of the server.
// Arguments: this project, then lib_flow_engine/_flow (default: next to this project).
var File = java.io.File, Files = java.nio.file.Files, System = java.lang.System;
// The palette renders icons: without a display, AWT would keep the JVM alive for minutes after the script on macOS.
System.setProperty("java.awt.headless", "true");
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var projectDir = new File(arguments.length > 0 ? arguments[0] : ".").getCanonicalFile();
var engineDir = new File(arguments.length > 1 ? arguments[1] : new File(projectDir.getParentFile(), "lib_flow_engine/_flow").getPath()).getCanonicalFile();
var checks = 0;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
function json(value) { return JSON.stringify(value); }

var temporary = Files.createTempDirectory("flow-mcp-stable-").toFile().getCanonicalFile();
var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
var previousWorkspace = Engine.USER_WORKSPACE_PATH;
var previousJwt = System.getProperty("flow.mcp.jwt.path");
var context; // the Convertigo context the Flow engine reads while a request runs
var server = null;
try {
	// This project as served (a copy: its guide is edited), a neutral application project, a workspace, a JWT store.
	var mcpDir = new File(temporary, "lib_flow_mcp");
	FileUtils.copyDirectory(new File(projectDir, "_flow"), new File(mcpDir, "_flow"));
	FileUtils.copyFile(new File(projectDir, "c8oProject.yaml"), new File(mcpDir, "c8oProject.yaml"));
	var target = new File(temporary, "Notes");
	FileUtils.writeStringToFile(new File(target, "c8oProject.yaml"), "↑convertigo: 8.5.0\nproject: Notes\n", "UTF-8");
	FileUtils.writeStringToFile(new File(target, "_flow/flows/Hello.flow.js"), [
		"const _flow = { sourceVersion: 2, inputs: { name: { type: \"string\", default: \"friend\" } } }",
		"",
		"function Hello({ input, result }) {",
		"  result.message = \"Hello \" + input.name",
		"}",
		""].join("\n"), "UTF-8");
	var workspace = new File(temporary, "workspace");
	new File(workspace, "agents/feedback").mkdirs();
	Engine.USER_WORKSPACE_PATH = String(workspace.getPath());
	System.setProperty("flow.mcp.jwt.path", String(new File(temporary, "jwt").getPath()));
	// The Flow runtimes of a server share the servlet context: the stored results are read there.
	var attributes = new java.util.concurrent.ConcurrentHashMap();
	Engine.initServletContext(new Packages.jakarta.servlet.ServletContext({
		getAttribute: function (name) { return attributes.get(name); },
		setAttribute: function (name, value) { attributes.put(name, value); },
		removeAttribute: function (name) { attributes.remove(name); }
	}));
	assert(Engine.getServletContext() !== null, "the servlet context of the test is not installed");
	function stored() {
		var map = attributes.get("lib_flow_mcp.stableResults.v1");
		var entries = {};
		if (map != null) {
			var iterator = map.entrySet().iterator();
			while (iterator.hasNext()) {
				var entry = iterator.next();
				entries[String(entry.getKey())] = Number(entry.getValue().getKey().getKey()) + ":" + String(entry.getValue().getValue()).length;
			}
		}
		return entries;
	}
	function storedText() {
		var map = attributes.get("lib_flow_mcp.stableResults.v1");
		var text = "";
		if (map != null) {
			var iterator = map.entrySet().iterator();
			while (iterator.hasNext()) {
				var entry = iterator.next();
				text += String(entry.getKey()) + "\n" + String(entry.getValue().getValue()) + "\n";
			}
		}
		return text;
	}
	function count(kind) {
		return Object.keys(stored()).filter(function (key) { return key.indexOf(kind + ":") === 0; }).length;
	}

	var jwt = eval(String(FileUtils.readFileToString(new File(projectDir, "_flow/lib/jwt.js"), "UTF-8")));
	var signingKey = jwt._test.signingKey();
	function token(sub, claims) {
		var now = Math.floor(System.currentTimeMillis() / 1000);
		var payload = { iss: "lib_ConvertigoMCP", aud: "ConvertigoMCP", sub: sub, jti: String(java.util.UUID.randomUUID()), kind: "managed",
			label: "Stable results test", scope: "mcp:full", iat: now, nbf: now, exp: now + 3600 };
		Object.keys(claims || {}).forEach(function (key) { payload[key] = claims[key]; });
		return jwt._test.buildToken({ alg: "HS256", typ: "JWT", kid: (claims && claims.kid) || "stable-test" }, payload, signingKey);
	}
	var bearerA = token("agent-a"), bearerB = token("agent-b"), bearerNarrow = token("agent-a", { scope: "mcp:narrow" });
	var leasedId = "managed_" + String(java.util.UUID.randomUUID()).replace(/-/g, "");
	var bearerLeased = jwt._test.buildToken({ alg: "HS256", typ: "JWT", kid: leasedId }, { iss: "lib_ConvertigoMCP", aud: "ConvertigoMCP",
		sub: "agent-a", jti: "leased", kind: "managed", lease: "turn", scope: "mcp:full", iat: 0, nbf: 0, exp: 4102444800 }, signingKey);
	var validBearers = [bearerA, bearerB, bearerNarrow, bearerLeased].map(function (raw) { return "Bearer " + raw; });

	// The legacy endpoint: its catalog follows the caller (its bearer), the provider (no gateway tool for Claude) and the
	// feedback consent of agents/feedback/settings.json (report-create), as lib_ConvertigoMCP does.
	var legacyLists = 0;
	server = com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1", 0), 0);
	server.createContext("/convertigo/api/mcp", new com.sun.net.httpserver.HttpHandler({ handle: function (exchange) {
		var body = JSON.parse(String(new java.lang.String(exchange.getRequestBody().readAllBytes(), "UTF-8")));
		var headers = exchange.getRequestHeaders();
		var answer = { jsonrpc: "2.0", id: body.id, error: { code: -32001, message: "Bearer required" } };
		if (body.method === "tools/list" && validBearers.indexOf(String(headers.getFirst("Authorization"))) !== -1) {
			legacyLists++;
			var tools = [{ name: "scheduler-list", description: "Lists the scheduled jobs.", inputSchema: { type: "object" } }];
			if (String(headers.getFirst("X-Convertigo-Agent-Provider") || "") !== "claude") {
				tools.push({ name: "image-describe", description: "Describes an image with a gateway model.", inputSchema: { type: "object" } });
			}
			var settings = new File(workspace, "agents/feedback/settings.json");
			if (settings.isFile() && /"mode"\s*:\s*"(?:ask|auto)"/.test(String(FileUtils.readFileToString(settings, "UTF-8")))) {
				tools.push({ name: "report-create", description: "Reports friction.", inputSchema: { type: "object" } });
			}
			answer = { jsonrpc: "2.0", id: body.id, result: { tools: tools } };
		}
		var bytes = new java.lang.String(JSON.stringify(answer)).getBytes("UTF-8");
		exchange.sendResponseHeaders(200, bytes.length);
		exchange.getResponseBody().write(bytes);
		exchange.close();
	} }));
	server.start();

	var __flowEngineDir = String(engineDir.getPath());
	var __flowProjectDir = String(mcpDir.getPath());
	var engine = eval(String(FileUtils.readFileToString(new File(engineDir, "Engine.js"), "UTF-8")));
	var serverFlow = String(FileUtils.readFileToString(new File(mcpDir, "_flow/flows/McpServer.flow.js"), "UTF-8"));
	var serverStore = new Packages.com.twinsoft.convertigo.engine.util.SimpleMap();
	serverStore.set("lib_ConvertigoMCP.managedTokenLeases", new java.util.concurrent.ConcurrentHashMap());

	// One HTTP request to /api/flow-mcp: its headers, then what the guard and the Flow wrote on it.
	function serve(payload, bearer, extraHeaders) {
		var headers = { "User-Agent": "stable-test/1.0" };
		if (bearer) headers.Authorization = "Bearer " + bearer;
		Object.keys(extraHeaders || {}).forEach(function (name) { headers[name] = extraHeaders[name]; });
		var state = { status: 0, attributes: {} };
		context = {
			server: serverStore,
			httpServletRequest: {
				getHeader: function (name) { return headers[name] === undefined ? null : headers[name]; },
				getSession: function () { return null; },
				getScheme: function () { return "http"; },
				getLocalPort: function () { return server.getAddress().getPort(); },
				getContextPath: function () { return "/convertigo"; },
				getAttribute: function (name) { return state.attributes[name] === undefined ? null : state.attributes[name]; },
				setAttribute: function (name, value) { state.attributes[name] = value; },
				removeAttribute: function (name) { delete state.attributes[name]; }
			},
			httpServletResponse: {
				setStatus: function (value) { state.status = Number(value); },
				setHeader: function () {}
			}
		};
		try {
			var execution = JSON.parse(engine.run(JSON.stringify({ flowSource: serverFlow, includeTrace: false, input: { request: JSON.stringify(payload) } })));
			assert(execution.ok === true, "McpServer failed: " + json(execution).substring(0, 2000));
			state.response = execution.result;
			return state;
		} finally {
			context = undefined;
		}
	}
	function list(id, bearer, headers) { return serve({ jsonrpc: "2.0", id: id, method: "tools/list" }, bearer, headers); }
	function names(state) { return state.response.result.tools.map(function (tool) { return tool.name; }); }
	function call(id, name, args, bearer) {
		return serve({ jsonrpc: "2.0", id: id, method: "tools/call", params: { name: name, arguments: args } }, arguments.length > 3 ? bearer : bearerA);
	}
	function read(id, uri, bearer) {
		return serve({ jsonrpc: "2.0", id: id, method: "resources/read", params: { uri: uri } }, arguments.length > 2 ? bearer : bearerA);
	}

	// 1. tools/list: computed once (one relayed list), then answered from the store with the id of each request.
	var first = list(1, bearerA);
	assert(first.status === 0 && first.response.id === 1 && legacyLists === 1, "the first tools/list was not computed: " + json(first.response).substring(0, 500));
	assert(names(first).indexOf("code-set") !== -1 && names(first).indexOf("scheduler-list") !== -1 && names(first).indexOf("image-describe") !== -1,
		"the list lacks the Flow or the relayed tools: " + names(first));
	assert(names(first).indexOf("report-create") === -1, "report-create was listed without consent");
	assert(count("tools/list") === 1, "the list was not kept: " + json(stored()));
	var keptAt = json(stored());
	[["two", "two"], [0, 0], [null, null]].forEach(function (ids) {
		var again = list(ids[0], bearerA);
		assert(again.response.id === ids[1] && legacyLists === 1, "a kept tools/list did not carry the id " + json(ids[0]) + ": " + json(again.response.id));
		assert(json(again.response.result) === json(first.response.result), "the kept tools/list differs from the computed one");
		assert(json(again.response).indexOf("__flow") === -1 && again.response.jsonrpc === "2.0" && Object.keys(again.response).join() === "jsonrpc,id,result",
			"the kept envelope is not a plain JSON-RPC result: " + Object.keys(again.response));
	});
	assert(json(stored()) === keptAt, "answering from the store wrote it");
	var batch = serve([{ jsonrpc: "2.0", id: 7, method: "tools/list" }, { jsonrpc: "2.0", id: 8, method: "tools/list" }], bearerA);
	assert(batch.response.length === 2 && batch.response[0].id === 7 && batch.response[1].id === 8 && legacyLists === 1 &&
		json(batch.response[1].result) === json(first.response.result), "a batch did not get the kept list with its own ids");
	assert(storedText().indexOf(bearerA) === -1 && storedText().indexOf("agent-a") === -1, "the store holds a token or a caller in clear");

	// 2. Never to a request without authentication, or with a refused token.
	[null, "forged." + bearerA.split(".")[1] + ".signature", token("agent-a", { aud: "Other" })].forEach(function (bearer, index) {
		var refused = list(100 + index, bearer);
		assert(refused.status === 401 && refused.response.error && refused.response.error.code === -32001 && !refused.response.result,
			"an unauthenticated tools/list got an answer: " + json(refused.response).substring(0, 300));
		var refusedCall = call(110 + index, "flow-catalog", { projectDir: String(target.getPath()), query: "list" }, bearer);
		assert(refusedCall.status === 401 && refusedCall.response.error && !refusedCall.response.result, "an unauthenticated flow-catalog got an answer: " + refusedCall.status + " " + json(refusedCall.response).substring(0, 400));
		var refusedRead = read(120 + index, "flow://guide/start", bearer);
		assert(refusedRead.status === 401 && !refusedRead.response.result, "an unauthenticated guide read got an answer");
	});
	assert(legacyLists === 1, "a refused request reached the relay");

	// 3. Another caller, another scope or another provider get their own list.
	var other = list(200, bearerB);
	assert(legacyLists === 2 && other.response.id === 200, "another caller was answered with the list of the first one");
	var narrow = list(201, bearerNarrow);
	assert(legacyLists === 3, "a token of another scope was answered with the list of the full scope");
	var claude = list(202, bearerA, { "X-Convertigo-Agent-Provider": "claude" });
	assert(legacyLists === 4 && names(claude).indexOf("image-describe") === -1 && names(claude).indexOf("scheduler-list") !== -1,
		"a Claude caller got the gateway tools of another provider: " + names(claude));
	var ordinary = list(203, bearerA);
	assert(legacyLists === 4 && names(ordinary).indexOf("image-describe") !== -1, "the ordinary list was lost or recomputed");
	var vibe = list(204, bearerA, { "User-Agent": "MistralAI-VibeCLI/1.0" });
	assert(legacyLists === 5 && vibe.response.id === 204, "a Vibe caller was answered with the list of another client");

	// 4. Consent: report-create appears and leaves at the next list.
	FileUtils.writeStringToFile(new File(workspace, "agents/feedback/settings.json"), "{\"mode\":\"ask\"}", "UTF-8");
	var consented = list(300, bearerA);
	assert(legacyLists === 6 && names(consented).indexOf("report-create") !== -1, "the consent did not list report-create: " + names(consented));
	FileUtils.writeStringToFile(new File(workspace, "agents/feedback/settings.json"), "{\"mode\":\"off\"}", "UTF-8");
	var withdrawn = list(301, bearerA);
	assert(legacyLists === 7 && names(withdrawn).indexOf("report-create") === -1, "a withdrawn consent kept report-create: " + names(withdrawn));
	assert(list(302, bearerA).response.id === 302 && legacyLists === 7, "the list after the withdrawal was not kept");

	// 5. flow-cache-clear drops everything: the list computed again is the one kept before.
	var cleared = call(400, "flow-cache-clear", {});
	assert(cleared.response.result && !cleared.response.result.isError, "flow-cache-clear failed: " + json(cleared.response).substring(0, 500));
	assert(count("tools/list") === 0, "flow-cache-clear kept results");
	var recomputed = list(401, bearerA);
	assert(legacyLists === 8 && json(recomputed.response.result) === json(withdrawn.response.result), "the list computed again differs from the kept one");

	// 6. Guides and skills: the same text for the same content, again after an edit of the guide.
	var guide = read(500, "flow://guide/start");
	assert(guide.response.result.contents[0].uri === "flow://guide/start" && count("resource") === 1, "the guide was not kept");
	var guideAgain = read(501, "flow://guide/start");
	assert(guideAgain.response.id === 501 && json(guideAgain.response.result) === json(guide.response.result), "the kept guide differs");
	var guideFile = new File(mcpDir, "_flow/resources/guide/start.md");
	var edited = String(FileUtils.readFileToString(guideFile, "UTF-8")) + "\nOne more line for the test.\n";
	FileUtils.writeStringToFile(guideFile, edited, "UTF-8");
	var guideEdited = read(502, "flow://guide/start");
	assert(guideEdited.response.result.contents[0].text === edited, "an edited guide was answered from the store");
	var skill = read(503, "flow://skills/convertigo-flow-mcp/SKILL");
	assert(/convertigo-flow-mcp/.test(skill.response.result.contents[0].text) && read(504, "flow://skills/convertigo-flow-mcp/SKILL").response.id === 504,
		"the skill was not read");
	var viaTool = call(505, "flow-resource-get", { uri: "flow://guide/start" });
	assert(viaTool.response.id === 505 && viaTool.response.result.structuredContent.text === edited, "flow-resource-get lost the guide");
	assert(/Resource text is in text/.test(viaTool.response.result.structuredContent.content), "cached guide has no duplicate alias");
 var plainGuide = call(509, "flow-resource-get", {uri:"flow://guide/start", format:"text"});
 assert(!plainGuide.response.result.structuredContent && plainGuide.response.result.content[0].text === edited,
  "text format must not reuse the structured presentation");
 assert(call(510, "flow-resource-get", {uri:"flow://guide/start"}).response.result.structuredContent.text === edited,
  "text format must not mutate the cached document");
 var unknown = read(506, "flow://guide/missing-guide");
	assert(unknown.response.error && unknown.response.id === 506 && read(507, "flow://guide/missing-guide").response.error, "an unknown guide was answered");
	assert(read(508, "flow://guide/start", bearerB).response.id === 508 && count("resource") >= 4, "the guide of another caller shared an entry");

	// 7. flow-catalog and authoring-palette: kept for the same arguments, dropped by a write and by a notified change.
	var catalogArgs = { projectDir: String(target.getPath()), query: "list sort" };
	var catalog = call(600, "flow-catalog", catalogArgs);
	assert(catalog.response.result.structuredContent.ok !== false && count("tool") === 1, "flow-catalog was not kept: " + json(catalog.response).substring(0, 500));
	var toolKeptAt = json(stored());
	var catalogAgain = call(601, "flow-catalog", catalogArgs);
	assert(catalogAgain.response.id === 601 && json(catalogAgain.response.result) === json(catalog.response.result) && json(stored()) === toolKeptAt,
		"flow-catalog was not answered from the store");
	assert(call(602, "flow-catalog", { projectDir: String(target.getPath()), query: "json" }).response.id === 602 && count("tool") === 2,
		"another query shared the entry of the first one");
	var paletteArgs = { projectDir: String(target.getPath()), parentPath: "configs" };
	var palette = call(603, "authoring-palette", paletteArgs);
	assert(palette.response.result.structuredContent.ok === true && count("tool") === 3, "authoring-palette was not kept");
	var paletteAgain = call(604, "authoring-palette", paletteArgs);
	assert(paletteAgain.response.id === 604 && json(paletteAgain.response.result) === json(palette.response.result), "the kept palette differs");
	assert(count("tool") === 3 && call(605, "authoring-palette", paletteArgs, bearerB).response.id === 605 && count("tool") === 4,
		"the palette of another caller shared an entry");
	// A read changes nothing; a write through this endpoint drops the project answers (not the list nor the guides).
	call(606, "code-get", { projectDir: String(target.getPath()), name: "Hello" });
	assert(count("tool") === 4, "a read dropped the kept project answers");
	var lists = count("tools/list"), resources = count("resource");
	var write = call(607, "code-set", { projectDir: String(target.getPath()), name: "Hello",
		code: String(FileUtils.readFileToString(new File(target, "_flow/flows/Hello.flow.js"), "UTF-8")).replace("Hello ", "Hi ") });
	assert(write.response.result.structuredContent.ok === true, "code-set failed: " + json(write.response).substring(0, 800));
	assert(count("tool") === 0 && count("tools/list") === lists && count("resource") === resources, "a write did not drop exactly the project answers");
	var catalogAfter = call(608, "flow-catalog", catalogArgs);
	assert(count("tool") === 1 && json(catalogAfter.response.result) === json(catalog.response.result), "flow-catalog was not computed again after a write");
	// A change Convertigo is told about (a Studio edit, a deployment) changes the revision of the project.
	var keptBefore = json(stored());
	Packages.com.twinsoft.convertigo.engine.flow.FlowEngineBridge.invalidateProjectDataCaches(String(target.getPath()));
	call(609, "flow-catalog", catalogArgs);
	assert(json(stored()) !== keptBefore && count("tool") === 2, "a notified change of the project did not compute flow-catalog again");
	// A deadline of the caller is its own: such a call is not kept.
	call(610, "flow-catalog", { projectDir: String(target.getPath()), query: "list sort", answerBefore: System.currentTimeMillis() + 4000 });
	assert(count("tool") === 2, "a call with its own deadline was kept");

	// 8. A leased token whose lease ended opens its session but gets no kept answer.
	var expired = call(700, "flow-catalog", catalogArgs, bearerLeased);
	assert(expired.response.id === 700 && expired.response.result.isError === true &&
		/expired/i.test(json(expired.response.result.structuredContent.error)), "an expired leased token got a kept answer: " + json(expired.response).substring(0, 500));
	assert(list(701, bearerLeased).status === 401, "an expired leased token listed the tools");

	// 9. A run drops the project answers and is never kept; neither is a failure.
	var run = call(800, "code-run", { projectDir: String(target.getPath()), name: "Hello", input: { name: "Ada" } });
	assert(run.response.result.structuredContent.result.message === "Hi Ada" && count("tool") === 0, "a run was kept or kept the project answers");
	var failed = call(801, "authoring-palette", { projectDir: String(target.getPath()), parentPath: "nowhere" });
	assert(failed.response.result.isError === true && count("tool") === 0, "a failed palette was kept: " + json(failed.response).substring(0, 300));

	// 10. Bounded: at most 256 entries and 8M characters, the oldest leaving first; a single huge result is not kept.
	var mcp = eval(String(FileUtils.readFileToString(new File(mcpDir, "_flow/lib/mcp.js"), "UTF-8")));
	var unitCtx = { blocks: {} };
	Object.defineProperty(unitCtx.blocks, "__flowCatalogFingerprint", { value: "unit catalog", enumerable: false });
	function keep(query, text) {
		var request = { jsonrpc: "2.0", id: query, method: "tools/call", params: { name: "flow-catalog", arguments: { query: query } } };
		var lookup = mcp.stableToolLookup(unitCtx, request, "block.list", { projectDir: String(target.getPath()), query: String(query) });
		mcp.stableKeep(unitCtx, request, lookup, { jsonrpc: "2.0", id: query, result: { content: [{ type: "text", text: "OK" }], structuredContent: { ok: true, text: text } } });
		return lookup;
	}
	mcp._stableClear();
	for (var q = 0; q < 300; q++) keep(q, "small");
	assert(mcp._stableSize() === 256, "the count is not bounded: " + mcp._stableSize());
	assert(keep(299, "small").response && !keep(0, "small").response, "the oldest entry did not leave first");
	mcp._stableClear();
	var large = new Array(400001).join("x");
	for (q = 0; q < 30; q++) keep("large" + q, large);
	var characters = 0;
	Object.keys(stored()).forEach(function (key) { characters += Number(stored()[key].split(":")[1]); });
	assert(mcp._stableSize() < 30 && characters <= 8 * 1024 * 1024, "the size is not bounded: " + mcp._stableSize() + " entries, " + characters);
	keep("huge", new Array(1100001).join("x"));
	assert(!keep("huge", "x").response, "a huge result was kept");
	assert(keep("large29", large).response.id === "large29", "the newest large entry left");

	print("stable-results-cache OK (" + checks + " checks)");
} finally {
	if (server !== null) server.stop(0);
	Engine.USER_WORKSPACE_PATH = previousWorkspace;
	if (previousJwt === null) System.clearProperty("flow.mcp.jwt.path");
	else System.setProperty("flow.mcp.jwt.path", previousJwt);
	FileUtils.deleteDirectory(temporary);
}
