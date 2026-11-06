// The answers of code-run, code-promote, flow-project-bootstrap and the frontend build are compact by default: what an
// agent needs to continue (status, qname, revision, result, URL, next step), at most half of what they answered before
// on the same inputs (fixtures/compact-responses.json: answers of the light bench of 06/11, before the compaction).
// detail:"full" still returns every field.
// Run with Rhino: java -cp <rhino:commons-io> org.mozilla.javascript.tools.shell.Main tests/compact-responses.js <lib_flow_mcp dir>
var root = new java.io.File(arguments.length > 0 ? arguments[0] : ".").getCanonicalFile();
var FileUtils = Packages.org.apache.commons.io.FileUtils;
function read(path) { return String(FileUtils.readFileToString(new java.io.File(root, path), "UTF-8")); }
var mcp = eval(read("_flow/lib/mcp.js"));
var fixtures = JSON.parse(read("tests/fixtures/compact-responses.json"));
var checks = 0;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function size(value) { return JSON.stringify(value).length; }
function answer(tool, args, raw) {
	return mcp.toolResponse({ id: 1, params: { name: tool, arguments: args } }, copy(raw), {}).result.structuredContent;
}
function withDetail(args) { var out = copy(args); out.detail = "full"; return out; }

// FLOW_COMPACT_MEASURE=1 only prints the default answer size of each case: run it on another mcp.js to measure "before".
if (java.lang.System.getenv("FLOW_COMPACT_MEASURE")) {
	fixtures.cases.forEach(function (fixture) {
		print("MEASURE " + fixture.tool + " (" + fixture.label + "): " + size(answer(fixture.tool, fixture.arguments, fixture.raw)));
	});
	java.lang.System.exit(0);
}

var lines = [];
fixtures.cases.forEach(function (fixture) {
	var label = fixture.tool + " (" + fixture.label + ")";
	var compact = answer(fixture.tool, fixture.arguments, fixture.raw);
	var full = answer(fixture.tool, withDetail(fixture.arguments), fixture.raw);
	lines.push(label + ": before " + fixture.before + ", compact " + size(compact) + " (" +
		Math.round(100 * (size(compact) - fixture.before) / fixture.before) + " %), full " + size(full));
	assert(size(compact) <= fixture.before / 2, label + " is not at most half of its former answer: " + size(compact) + " > " + fixture.before / 2 + " " + JSON.stringify(compact));
	assert(compact.ok === true && typeof compact.next === "string" && compact.next.length > 0, label + " keeps ok and a next step: " + JSON.stringify(compact));
	// detail:"full" returns every field of the raw answer
	Object.keys(fixture.raw).forEach(function (key) {
		if (key === "draft") return; // a code-run draft is named workingCopy and unsaved, as before
		assert(full[key] !== undefined, label + " detail:'full' lost " + key + ": " + JSON.stringify(full));
		if (key === "registration") {
			Object.keys(fixture.raw.registration).forEach(function (field) {
				assert(full.registration[field] !== undefined, label + " detail:'full' lost registration." + field);
			});
		}
	});
	if (fixture.tool === "code-run") {
		assert(compact.result !== undefined && JSON.stringify(compact.result) === JSON.stringify(fixture.raw.result), label + " keeps the result unchanged");
		assert(compact.qname === fixture.raw.qname && compact.revision === fixture.raw.revision && compact.unsaved === true,
			label + " names the draft to resume (qname, revision, unsaved): " + JSON.stringify(compact));
		assert(JSON.stringify(compact).split(fixture.raw.revision).length === 2, label + " gives the revision once: " + JSON.stringify(compact));
		assert(/code-promote/.test(compact.next) && !compact.warnings && compact.inputDefinitions === undefined && compact.name === undefined,
			label + " points to code-promote without the unsaved warning or the inputs echo: " + JSON.stringify(compact));
		var unsaved = (full.warnings || []).filter(function (warning) { return warning.code === "FLOW_CODE_UNSAVED_WORKING_COPY"; })[0];
		assert(unsaved && unsaved.revision === fixture.raw.revision && full.workingCopy === true && /PASSED ON DRAFT/.test(full.next),
			label + " detail:'full' keeps the unsaved warning and the long next: " + JSON.stringify(full));
	} else if (fixture.tool === "code-promote") {
		assert(compact.promoted === true && compact.qname === fixture.raw.qname && compact.revision === fixture.raw.revision,
			label + " keeps promoted, qname and revision: " + JSON.stringify(compact));
		assert(compact.registration === undefined && compact.warnings === undefined && compact.responseDetail === undefined,
			label + " drops a successful registration and empty fields: " + JSON.stringify(compact));
		assert(full.registration.flagsAfterFastSaveClean && full.registration.studioRefresh, label + " detail:'full' keeps the registration flags");
	} else if (fixture.tool === "flow-project-bootstrap") {
		assert(compact.project === "Shop" && compact.created === true && compact.saved === true && /bootstrap again/.test(compact.next),
			label + " keeps what was done: " + JSON.stringify(compact));
		assert(compact.templateUrl === undefined && compact.projectDir === undefined && compact.ui === undefined && compact.force === undefined,
			label + " drops the echo of its arguments: " + JSON.stringify(compact));
		assert(compact.demoLogin && compact.demoLogin.symbol === "Shop.demo.login" && compact.demoLogin.value === false && !compact.demoLogin.note,
			label + " names the demo-login switch without its note: " + JSON.stringify(compact));
		if (fixture.raw.ui) {
			assert(compact.configuredSvelte === true && compact.studioTarget && compact.studioTarget.sourcePath === fixture.raw.studioTarget.sourcePath,
				label + " keeps the initial Page of a UI project: " + JSON.stringify(compact));
		} else {
			assert(compact.studioTarget === undefined, label + " has no Page to point at: " + JSON.stringify(compact));
		}
	} else if (fixture.tool === "frontend-svelte-action") {
		assert(compact.openUrl === fixture.raw.openUrl && compact.details.action === "build" && compact.details.durationMs === fixture.raw.details.durationMs,
			label + " keeps the URL and the duration: " + JSON.stringify(compact));
		assert(compact.details.steps.length === fixture.raw.details.steps.filter(function (step) { return !step.skipped; }).length &&
			compact.details.production.status === "current", label + " keeps the steps it ran and the production status: " + JSON.stringify(compact.details));
		assert(compact.acceptance === undefined && /openBuilt/.test(compact.next) && JSON.stringify(compact).indexOf("/workspace/") === -1,
			label + " points to the browser plan without paths: " + JSON.stringify(compact));
		assert(full.acceptance && full.acceptance.calls.length === fixture.raw.acceptance.calls.length, label + " detail:'full' keeps the browser plan");
	}
});

// A failed registration stays complete; a session note stays with its timeout.
var promoteFixture = fixtures.cases.filter(function (fixture) { return fixture.tool === "code-promote"; })[0];
var failedRaw = copy(promoteFixture.raw);
failedRaw.registration.studioRefresh.status = "error";
failedRaw.registration.studioRefresh.message = "java.lang.IllegalStateException: no display";
var failed = answer("code-promote", promoteFixture.arguments, failedRaw);
assert(failed.registration && failed.registration.studioRefresh.status === "error" && failed.registration.registered === true,
	"A failed Studio refresh keeps the registration: " + JSON.stringify(failed));
var lockedRaw = copy(promoteFixture.raw);
lockedRaw.registration.projectFlagLock = { acquired: false, error: "timeout" };
assert(answer("code-promote", promoteFixture.arguments, lockedRaw).registration.projectFlagLock.error === "timeout", "A flag lock not acquired keeps the registration");
var notedRaw = copy(promoteFixture.raw);
notedRaw.registration.httpSessionTimeout = 60;
notedRaw.registration.sessionNote = "Project Shop closes an HTTP session idle for 60 s (httpSessionTimeout).";
var noted = answer("code-promote", promoteFixture.arguments, notedRaw);
assert(noted.registration.sessionNote === notedRaw.registration.sessionNote && noted.registration.sessionsReset === false &&
	noted.registration.httpSessionTimeout === 60 && noted.registration.flagsAfterFastSaveClean === undefined,
	"A session note stays with its timeout, without the flags: " + JSON.stringify(noted));

// A failed build or another action is answered whole.
var buildFixture = fixtures.cases.filter(function (fixture) { return fixture.tool === "frontend-svelte-action"; })[0];
var failedBuild = copy(buildFixture.raw);
failedBuild.ok = false;
failedBuild.details.steps[3].ok = false;
assert(answer("frontend-svelte-action", buildFixture.arguments, failedBuild).details.projectRoot !== undefined, "A failed build keeps its details");
assert(answer("frontend-svelte-action", { project: "Shop", actionId: "openBuilt" }, { ok: true, openUrl: "http://localhost/x", acceptance: { calls: [1] } }).acceptance.calls.length === 1,
	"openBuilt still returns the browser plan");

// The revision of the home Page a UI bootstrap created stays, for its first code-set.
var uiFixture = fixtures.cases.filter(function (fixture) { return fixture.tool === "flow-project-bootstrap" && fixture.raw.ui; })[0];
var revisedRaw = copy(uiFixture.raw);
revisedRaw.frontbuilderModelRevision = "home-page-revision";
assert(answer("flow-project-bootstrap", uiFixture.arguments, revisedRaw).frontbuilderModelRevision === "home-page-revision", "A UI bootstrap keeps the revision of its home Page");

// A saved Flow run says to stop.
var savedRun = answer("code-run", { project: "Shop", name: "catalog_list" }, { ok: true, qname: "Shop.catalog_list", name: "catalog_list", result: { count: 3 } });
assert(savedRun.unsaved === undefined && !/code-promote/.test(savedRun.next) && savedRun.name === undefined, "A saved Flow run has nothing to promote: " + JSON.stringify(savedRun));

print(lines.join("\n"));
print("compact-responses OK (" + checks + " checks)");
