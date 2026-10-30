// The text content of a tool result summarizes its structuredContent, filtered once (toolResult): filtering it again
// for the summary changed nothing but the time a large answer (an authoring tree) took. The text is the one of two
// passes; the structuredContent is computed as before.
var project = new java.io.File(arguments[0]).getCanonicalFile();
var mcp = eval(String(Packages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(project, "_flow/lib/mcp.js"), "UTF-8")));
var checks = 0;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
var ctx = {};
var samples = [
	{ ok: true, name: "Tree", children: [{ name: "engine", kind: "engine", type: "", summary: "Flow engine", file: "/tmp/x/_flow/engine.yaml" }],
		token: "secret", operatorNote: "Check the tree.", argumentWarning: "Ignored argument extra.", __flowTraceStart: 1 },
	{ ok: true, blocks: [{ block: "list.sort", properties: { password: { kind: "text", type: "string", "default": "p", label: "" },
		apiKey: { type: "", label: "" } } }], count: 1, nextCursor: "1", hints: true, info: "{\"token\":\"t\",\"a\":1}" },
	{ ok: false, error: { code: "UNKNOWN_BLOCK", message: "Unknown block", details: { authorization: "Bearer x" } } },
	{ matches: [{ kind: "node", flow: "P.F", nodeId: "n1", path: "/nodes/0", summary: "set" }], query: "set",
		warnings: [{ code: "W", hint: "Do this.", message: "Warned." }], description: "", sourceFile: "relative/x.flow.js" },
	{ result: { value: new java.lang.String("java text"), cookie: "c", nested: { secretValue: 2 } }, definition: "{\"nodes\":[]}" },
	{ ok: true, resources: [{ uri: "flow://guide/start", path: "_flow/resources/guide/start.md" }], total: 1 },
	"plain text", 42, null
];
samples.forEach(function (value, index) {
	// toolResult of a filtered value summarizes it filtered twice, as the text content was built before.
	var once = JSON.stringify(mcp.toolResult(value, ctx).content);
	var twice = JSON.stringify(mcp.toolResult(mcp.sanitizeForMcp(value, ctx), ctx).content);
	assert(once === twice, "sample " + index + " is summarized differently after one pass: " + once + " / " + twice);
});
var tree = { ok: true, children: [] };
for (var i = 0; i < 400; i++) {
	tree.children.push({ name: "node" + i, kind: "block", summary: "set local.x" + i, props: { token: "t" + i, value: i, file: "/tmp/p/_flow/flows/F" + i + ".flow.js" },
		children: [{ name: "child", kind: "slot", __flowInternal: true }] });
}
var result = mcp.toolResult(tree, ctx);
assert(result.content[0].text === "OK. 400 children: node0, node1, node2, node3, node4, node5, node6, node7. Use structuredContent for data.",
	"the summary of a large tree changed: " + result.content[0].text);
assert(JSON.stringify(result.structuredContent).indexOf("__flow") === -1 && result.structuredContent.children[3].props.token === "[redacted]",
	"the structured content is not filtered");
print("text-summary-single-pass OK (" + checks + " checks)");
