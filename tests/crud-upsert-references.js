// flow-crud-upsert names the workspace libraries the generated code needs, adds them on apply, and never hides the
// cause of a failed SQL plan behind FLOWSCRIPT_CANONICAL_INVALID. Standalone: a fake runtime context, a temporary
// project. Run with Rhino: java -cp <convertigo studio lib/*> ... tests/crud-upsert-references.js <repo>
var root = new java.io.File(arguments.length > 0 ? arguments[0] : ".").getCanonicalFile();
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var checks = [];
function check(value, name, detail) { if (!value) throw new Error(name + (detail === undefined ? "" : ": " + JSON.stringify(detail).substring(0, 1500))); checks.push(name); }
function read(file) { return String(FileUtils.readFileToString(file, "UTF-8")); }
var libs = {};
function lib(name) {
	if (name === "mcp") return { registerFlowDbo: function () {} };
	if (!libs[name]) libs[name] = eval(read(new java.io.File(root, "_flow/lib/" + name + ".js")));
	return libs[name];
}
var spec = { facade: { prefix: "desk" }, security: { principals: { ada: "agent", max: "manager" }, demoLogin: true },
	entities: [{ name: "tickets", fields: [{ name: "Id", type: "INTEGER", primary: true }, { name: "Title", type: "VARCHAR(80)", required: true }] }] };
var projectYaml = "convertigo: 8.5.0.m006\n↓CrudSmokeRefs [core.Project]:\n  version: 1.0.0\n" +
	"  ↓project [references.ProjectSchemaReference]:\n    projectName: lib_flow_engine=https://github.com/convertigo/c8oprj-lib-flow-engine/archive/main.zip\n";
function reference(name, index) { return "  ↓project" + index + " [references.ProjectSchemaReference]:\n    projectName: " + name + "\n"; }
function project(yaml) {
	var dir = java.nio.file.Files.createTempDirectory("crud-upsert-references-").toFile();
	FileUtils.writeStringToFile(new java.io.File(dir, "c8oProject.yaml"), yaml, "UTF-8");
	FileUtils.writeStringToFile(new java.io.File(dir, ".httpignore"), "/_flow/\n", "UTF-8");
	return dir;
}
function context(dir, runFlowSource) {
	var ctx = { calls: [], sqlRuns: 0, lib: lib, cacheClear: function () { ctx.calls.push({ block: "cache.clear" }); } };
	ctx.runFlowSource = function (source, config, options) { ctx.sqlRuns++; return runFlowSource(source, config, options); };
	ctx.callBlock = function (name, props) {
		ctx.calls.push({ block: name, props: props });
		if (name === "project.reference") {
			var text = read(new java.io.File(dir, "c8oProject.yaml"));
			FileUtils.writeStringToFile(new java.io.File(dir, "c8oProject.yaml"), text + reference(props.reference, ctx.calls.length), "UTF-8");
			return { ok: true, project: props.project, reference: props.reference, created: true, saved: true };
		}
		return { ok: true, result: {} };
	};
	ctx.flowCodeSet = function (args) {
		FileUtils.writeStringToFile(new java.io.File(args.projectDir, "_flow/flows/" + args.name + ".flow.js"), args.code, "UTF-8");
		return { ok: true, revision: "r-" + args.name };
	};
	ctx.flowCodePromote = function () { return { ok: true }; };
	return ctx;
}
var newDatabasePlan = function () { return { ok: true, result: { plan: { statements: ["CREATE TABLE tickets"] }, previousVersion: null } }; };
var crud = lib("crud-fastpath");

// 1. References missing: the preview lists them, does not run a SQL plan that cannot compile, and says what apply does.
var dir = project(projectYaml), ctx = context(dir, newDatabasePlan);
var preview = crud.applyUnlocked(ctx, { project: "CrudSmokeRefs", projectDir: String(dir), spec: spec, dryRun: true });
check(preview.status === "pending" && preview.applicable === true, "missing references keep the plan applicable", preview);
check(preview.references && preview.references.missing.join(",") === "lib_flow_sql,lib_flow_crud_data,lib_flow_frontbuilder_svelte",
	"preview lists the missing references", preview.references);
check(preview.sql.skipped === true && ctx.sqlRuns === 0, "no SQL plan without lib_flow_sql", preview.sql);
check(/planHash/.test(preview.next) && /adds the references lib_flow_sql/.test(preview.next), "next names the apply call and the references", preview.next);
check(preview.names && preview.names.length === 1 && preview.names[0].entity === "tickets" && preview.names[0].flows.indexOf("desk_tickets_list") === 0
	&& !/renamed/.test(preview.next), "preview reports the generated names, no rename", preview.names);
// The preview is compact by default (the model was repeated in studio, the files in generated); detail "full" keeps them.
check(preview.studio === undefined && preview.generated === undefined && preview.generatedFiles > 0 && preview.detail === "compact"
	&& /detail:"full"/.test(preview.next) && JSON.stringify(preview).length < 20000, "the preview is compact", Object.keys(preview));
var fullPreview = crud.applyUnlocked(ctx, { project: "CrudSmokeRefs", projectDir: String(dir), spec: spec, dryRun: true, detail: "full" });
check(fullPreview.studio && fullPreview.studio.entities && fullPreview.generated.length === preview.generatedFiles && fullPreview.planHash === preview.planHash,
	"detail full keeps studio and the generated files, same plan", Object.keys(fullPreview));
var renamedSpec = JSON.parse(JSON.stringify(spec)); renamedSpec.entities[0].name = "ticket";
var renamedPreview = crud.applyUnlocked(ctx, { project: "CrudSmokeRefs", projectDir: String(dir), spec: renamedSpec, dryRun: true });
check(renamedPreview.names[0].given === "ticket" && renamedPreview.names[0].entity === "tickets" && /renamed by the plural rule: ticket -> tickets/.test(renamedPreview.next),
	"preview says which entity the plural rule renamed", [renamedPreview.names, renamedPreview.next]);

// 2. Apply adds them, plans the new database and applies.
var applied = crud.applyUnlocked(ctx, { project: "CrudSmokeRefs", projectDir: String(dir), spec: spec, planHash: preview.planHash });
var added = ctx.calls.filter(function (c) { return c.block === "project.reference"; }).map(function (c) { return c.props.reference; });
check(applied.applied === true && applied.addedReferences.join(",") === "lib_flow_sql,lib_flow_crud_data,lib_flow_frontbuilder_svelte" &&
	added.join(",") === applied.addedReferences.join(","), "apply adds the listed references", applied);
check(ctx.sqlRuns === 1 && new java.io.File(dir, "_flow/flows/desk_tickets_list.flow.js").isFile() && new java.io.File(dir, "_flow/data/model.yaml").isFile(),
	"then plans the SQL and writes the model and the Flows");
var again = crud.applyUnlocked(ctx, { project: "CrudSmokeRefs", projectDir: String(dir), dryRun: true });
check(again.references.missing.length === 0, "the stored model previews with every reference present", again.references);

// 3. References present, SQL plan Flow invalid: the underlying diagnostics come back with code, line, block and fix.
var dir2 = project(projectYaml + reference("lib_flow_frontbuilder_svelte", 1) + reference("lib_flow_crud_data", 2) + reference("lib_flow_sql", 3));
var ctx2 = context(dir2, function () {
	var error = new Error("Canonical FlowScript is invalid for Flow Flow.");
	error.code = "FLOWSCRIPT_CANONICAL_INVALID";
	error.details = [{ code: "UNKNOWN_BLOCK", severity: "error", message: "Unknown Flow block: sql.configCheck", line: 3, hint: "Use flow-catalog or blockList to list supported blocks." },
		{ code: "FLOWSCRIPT_STYLE", severity: "warning", message: "ignored" }];
	error.hint = "Fix the .flow.js file or regenerate it from a valid Flow model.";
	throw error;
});
var blocked = crud.applyUnlocked(ctx2, { project: "CrudSmokeRefs", projectDir: String(dir2), spec: spec, dryRun: true });
var unknown = blocked.diagnostics.filter(function (d) { return d.code === "UNKNOWN_BLOCK"; })[0];
check(blocked.status === "blocked" && unknown && unknown.block === "sql.configCheck" && unknown.line === 3 && unknown.stage === "sql-plan",
	"the real cause is a diagnostic with its block and line", blocked.diagnostics);
check(unknown.reference === "lib_flow_sql" && unknown.fix.indexOf('flow-project-reference({project:"CrudSmokeRefs", reference:"lib_flow_sql"})') >= 0,
	"an unknown library block names the reference to add", unknown);
check(!blocked.diagnostics.some(function (d) { return d.code === "FLOWSCRIPT_CANONICAL_INVALID"; }) && unknown.via === "FLOWSCRIPT_CANONICAL_INVALID",
	"the wrapper code is context, not the diagnostic", blocked.diagnostics);
check(!blocked.diagnostics.some(function (d) { return d.code === "FLOWSCRIPT_STYLE"; }), "warnings of the plan Flow are not blocking diagnostics");
check(/Fix each error diagnostic/.test(blocked.next), "a blocked preview says what to do", blocked.next);
// A runtime error returned (not thrown) keeps its details too.
var ctx3 = context(dir2, function () { return { ok: false, error: { code: "SQL_CONFIG_INVALID", message: "Connection crud is not usable",
	details: [{ code: "SQL_CONNECTION_FAILED", severity: "error", message: "Database refused the connection", fix: "Check the JDBC URL" }] } }; });
var refused = crud.applyUnlocked(ctx3, { project: "CrudSmokeRefs", projectDir: String(dir2), spec: spec, dryRun: true });
check(refused.diagnostics.some(function (d) { return d.code === "SQL_CONNECTION_FAILED" && d.fix === "Check the JDBC URL" && d.via === "SQL_CONFIG_INVALID"; }),
	"returned runtime errors keep their details", refused.diagnostics);
FileUtils.deleteQuietly(dir);
FileUtils.deleteQuietly(dir2);
print(JSON.stringify({ passed: true, count: checks.length, checks: checks }));
