// requestable-execute (relayed from lib_ConvertigoMCP) keeps the first 12 items of each list of the payload. Its text
// said "result keys: requestable, status, truncated, totalItems, payload, before": an agent read 12 test cases of 17 as
// the whole suite. The relayed answer now starts with what is shown and how to read the rest.
// Stub only the HTTP transport, as legacy-relay-proxy.js does.
var project = new java.io.File(arguments[0]).getCanonicalFile(), realPackages = Packages, checks = 0, answerBody = null;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
var client = { send: function () { return { statusCode: function () { return 200; }, body: function () { return JSON.stringify(answerBody); } }; } };
var Packages = { java: { io: realPackages.java.io, nio: realPackages.java.nio, lang: realPackages.java.lang, util: realPackages.java.util, time: realPackages.java.time,
	net: { URI: realPackages.java.net.URI, http: {
		HttpRequest: { newBuilder: function (uri) { var request = { url: String(uri), headers: {} }; var builder = { timeout: function () { return builder; },
			header: function (name, value) { request.headers[name] = String(value); return builder; }, POST: function (body) { request.body = String(body); return builder; },
			build: function () { return request; } }; return builder; }, BodyPublishers: { ofString: function (text) { return text; } } },
		HttpClient: { newBuilder: function () { var builder = { connectTimeout: function () { return builder; }, build: function () { return client; } }; return builder; } },
		HttpResponse: { BodyHandlers: { ofString: function () { return {}; } } } } } }, org: realPackages.org, com: realPackages.com };
var mcp = eval(String(realPackages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(project, "_flow/lib/mcp.js"), "UTF-8")));
var ctx = { convertigoContext: function () { return { httpServletRequest: { getScheme: function () { return "http"; }, getLocalPort: function () { return 28080; },
	getContextPath: function () { return "/convertigo"; }, getHeader: function () { return null; } } }; } };
var request = { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "requestable-execute", arguments: { requestable: "Sample.runChecks" } } };
function relayed(result) {
	answerBody = { jsonrpc: "2.0", id: 7, result: { isError: false, structuredContent: { result: result } } };
	return mcp.legacyRelayCall(ctx, request).result;
}
var cases = [];
for (var index = 0; index < 12; index++) cases.push({ name: "case" + index, ok: true });

// 12 items shown of 17: the text starts with it, and structuredContent.truncation says it too.
var cut = relayed({ requestable: "Sample.runChecks", status: "ok", truncated: true, truncatedField: "cases", totalItems: 17, payload: { passed: 17, cases: cases } });
var text = String(cut.content[0].text);
assert(text.indexOf("TRUNCATED: 12 of 17 items of result.payload.cases are shown (requestable-execute keeps the first 12 items of each list). Do not count or judge the list from them.") === 0,
	"the text starts with the truncation: " + text);
assert(/code-run\(\{ qname: "<project>\.<Flow>", input: \{\.\.\.\} \}\)/.test(text) && /by pages \(offset and limit inputs\)/.test(text), "the text says how to read the rest: " + text);
assert(/result keys: requestable, status, truncated/.test(text), "the summary of the keys follows: " + text);
var truncation = cut.structuredContent.truncation;
assert(truncation && truncation.path === "result.payload.cases" && truncation.shown === 12 && truncation.total === 17 && /code-run/.test(truncation.next),
	"structuredContent.truncation names the list, the shown and the total counts: " + JSON.stringify(truncation));

// totalItems counts the last list of the payload only: a cut list followed by another one has no total.
var other = relayed({ requestable: "Sample.runChecks", status: "ok", truncated: true, truncatedField: "cases", totalItems: 2, payload: { cases: cases, failures: [1, 2] } });
assert(String(other.content[0].text).indexOf("TRUNCATED: only the first 12 items of result.payload.cases are shown") === 0 && other.structuredContent.truncation.total === undefined,
	"a total that counts another list is not shown: " + other.content[0].text);

// A payload over 24 000 characters comes as a preview.
var preview = relayed({ requestable: "Sample.runChecks", status: "ok", truncated: true, payloadPreview: "{\"rows\":[1,2", payloadBytes: 30000 });
assert(String(preview.content[0].text).indexOf("TRUNCATED: result.payloadPreview holds the first 12 of 30000 characters of the payload") === 0,
	"a preview is said in the text: " + preview.content[0].text);

// A complete answer is left as it was.
var whole = relayed({ requestable: "Sample.runChecks", status: "ok", truncated: false, totalItems: 3, payload: { cases: [1, 2, 3] } });
assert(String(whole.content[0].text).indexOf("TRUNCATED") === -1 && whole.structuredContent.truncation === undefined, "no truncation note on a complete answer: " + whole.content[0].text);
print("requestable-truncation-1109 OK (" + checks + " checks)");
