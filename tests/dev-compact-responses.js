// Contract for successful dev actions: keep control fields and nonempty diagnostics.
// Failures and detail:"full" keep the complete response.
var root = new java.io.File(arguments.length > 0 ? arguments[0] : ".").getCanonicalFile();
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var mcp = eval(String(FileUtils.readFileToString(new java.io.File(root, "_flow/lib/mcp.js"), "UTF-8")));
var checks = 0;
function assert(ok, message) { checks++; if (!ok) throw new Error(message); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function answer(action, raw, detail) {
	var args = { project: "Shop", actionId: action };
	if (detail) args.detail = detail;
	return mcp.toolResponse({ id: 1, params: { name: "frontend-svelte-action", arguments: args } }, copy(raw), {}).result.structuredContent;
}
function canonical(value) {
	if (Array.isArray(value)) return value.map(canonical);
	if (value && typeof value === "object") {
		var out = {};
		Object.keys(value).sort().forEach(function (key) { out[key] = canonical(value[key]); });
		return out;
	}
	return value;
}
function same(actual, expected, message) {
	assert(JSON.stringify(canonical(actual)) === JSON.stringify(canonical(expected)), message + ": " + JSON.stringify(actual));
}
var verbose = {
	url: "http://localhost:1234/", localUrl: "http://localhost:5678/", port: 5678,
	projectRoot: "/workspace/projects/Shop", generatedRoot: "/workspace/projects/Shop/_private/svelte",
	logFile: "/workspace/projects/Shop/_private/svelte/vite-dev.log", pid: 12345,
	idlePolicy: { firstViewerTimeoutMs: 900000, noViewerTimeoutMs: 120000 },
	dependencyFingerprint: "f".repeat(64), startedAt: "2026-11-06T12:00:00Z",
	steps: [{ action: "generate", durationMs: 400, ok: true }]
};
var cases = [
	{
		action: "dev.ensure",
		raw: { ok: true, title: "Svelte dev mode", message: "Svelte dev mode prepared.", pending: true,
			details: Object.assign({ status: "prepared", setupKind: "app" }, verbose) },
		expected: { ok: true, pending: true, status: "prepared", setupKind: "app" }
	},
	{
		action: "dev.start",
		raw: { ok: true, title: "Svelte dev mode", message: "Svelte dev mode started.", pending: false,
			details: Object.assign({ status: "running", setupKind: "app" }, verbose) },
		expected: { ok: true, pending: false, status: "running", setupKind: "app" }
	},
	{
		action: "dev.sync",
		raw: { ok: true, title: "Svelte sync", message: "Svelte frontend synced.",
			openUrl: "http://localhost:1234/", generated: true, refresh: false, dependenciesChanged: false,
			smoke: { ok: true, complete: true, routes: [{ route: "/", httpStatus: 200, status: "passed" }],
				logTail: "", next: "Use a browser verifier", runtimeVerified: false },
			browser: { id: "viewer", url: "http://localhost:1234/" },
			dev: Object.assign({ status: "running" }, verbose), details: Object.assign({ action: "dev.sync" }, verbose) },
		expected: { ok: true, openUrl: "http://localhost:1234/", generated: true, refresh: false,
			dependenciesChanged: false, smoke: { ok: true, complete: true,
				routes: [{ route: "/", httpStatus: 200, status: "passed" }] } }
	},
	{
		action: "dev.open",
		raw: { ok: true, title: "Svelte dev mode", message: "Viewer opened.", openUrl: "http://localhost:1234/",
			browser: { id: "viewer", url: "http://localhost:1234/", kind: "frontbuilder.svelte.dev" },
			browserControlReady: true, next: "Verify the viewer", details: Object.assign({ status: "running" }, verbose) },
		expected: { ok: true, openUrl: "http://localhost:1234/",
			browser: { id: "viewer", url: "http://localhost:1234/", kind: "frontbuilder.svelte.dev" },
			browserControlReady: true, next: "Verify the viewer" }
	}
];
cases.forEach(function (item) {
	var compact = answer(item.action, item.raw);
	var full = answer(item.action, item.raw, "full");
	var expected = copy(item.expected);
	if (item.action === "dev.sync" || item.action === "dev.open") {
		expected.browserProof = full.browserProof;
		expected.handoff = full.handoff;
	}
	var before = JSON.stringify(full).length;
	var after = JSON.stringify(compact).length;
	assert(after < before, item.action + " size did not decrease: " + after + " >= " + before);
	same(compact, expected, item.action + " compact fields");
	Object.keys(item.raw).forEach(function (key) { same(full[key], item.raw[key], item.action + " full " + key); });
	var failed = copy(item.raw);
	failed.ok = false;
	failed.message = "Build failed";
	failed.error = { code: "BUILD_FAILED", message: "Build failed" };
	failed.logTail = "Error at src/routes/+page.svelte";
	failed.diagnostics = [{ severity: "error", message: "Invalid component" }];
	same(answer(item.action, failed), answer(item.action, failed, "full"), item.action + " error response");
	var warned = copy(item.raw);
	warned.warnings = [{ code: "SLOW_START", message: "Startup was slow" }];
	warned.diagnostics = [{ severity: "warning", message: "Check route" }];
	warned.details.warnings = [{ code: "RETRY", message: "A step was retried" }];
	warned.details.diagnostics = [{ severity: "warning", message: "Check generated output" }];
	var warningAnswer = answer(item.action, warned);
	same(warningAnswer.warnings, warned.warnings, item.action + " warnings");
	same(warningAnswer.diagnostics, warned.diagnostics, item.action + " diagnostics");
	same(warningAnswer.details.warnings, warned.details.warnings, item.action + " detail warnings");
	same(warningAnswer.details.diagnostics, warned.details.diagnostics, item.action + " detail diagnostics");
	print(item.action + ": " + before + " -> " + after);
});
// A dev viewer is a temporary proof URL. The handoff guidance must survive compaction.
["dev.sync", "dev.open"].forEach(function (action) {
	var item = cases.filter(function (candidate) { return candidate.action === action; })[0];
	var compact = answer(action, item.raw);
	assert(typeof compact.handoff === "string" && /openBuilt/.test(compact.handoff) &&
		/first URL|page URL/i.test(compact.handoff) && /2 min/.test(compact.handoff),
		"The dev response must explain the durable page handoff and viewer lifetime: " + JSON.stringify(compact));
});
print("dev-compact-responses OK (" + checks + " checks)");
