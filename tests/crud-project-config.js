// flow-crud-upsert registers the connection, the sql provider of data and every generated data source once in the
// project config of _flow/engine.yaml, as flow://guide/crud tells business Flows: a Flow without config of its own reads
// them. The registration goes through the minimal edit of lib_flow_engine (comments and other keys of engine.yaml stay),
// once (a value already registered is not written again, a second apply leaves the file as it is); the model owns these
// paths: a value changed by hand is a conflict, a named configuration is not, and a source the model no longer
// generates is removed. Standalone: a fake runtime context, the real engine for the YAML edit and the business Flow run.
// Run with Rhino: java -cp <convertigo studio lib/*> ... tests/crud-project-config.js <repo> [<lib_flow_engine _flow dir>]
var root = new java.io.File(arguments.length > 0 ? arguments[0] : ".").getCanonicalFile();
var engineDir = String(new java.io.File(arguments.length > 1 ? arguments[1] : root + "/../lib_flow_engine/_flow").getCanonicalPath());
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var checks = [];
function check(value, name, detail) { if (!value) throw new Error(name + (detail === undefined ? "" : ": " + JSON.stringify(detail).substring(0, 1500))); checks.push(name); }
function read(file) { return String(FileUtils.readFileToString(file, "UTF-8")); }
var __flowEngineDir = engineDir, __flowProjectDir = "";
var engine = eval(read(new java.io.File(engineDir, "Engine.js")));
var libs = {};
function lib(name) {
	if (name === "mcp") return { registerFlowDbo: function () {} };
	if (!libs[name]) libs[name] = eval(read(new java.io.File(root, "_flow/lib/" + name + ".js")));
	return libs[name];
}
function reference(name, index) { return "  ↓project" + index + " [references.ProjectSchemaReference]:\n    projectName: " + name + "\n"; }
var dir = java.nio.file.Files.createTempDirectory("crud-project-config-").toFile();
FileUtils.writeStringToFile(new java.io.File(dir, "c8oProject.yaml"), "convertigo: 8.5.0.m006\n↓CrudConfig [core.Project]:\n  version: 1.0.0\n" +
	reference("lib_flow_engine", 0) + reference("lib_flow_crud_data", 1) + reference("lib_flow_sql", 2), "UTF-8");
FileUtils.writeStringToFile(new java.io.File(dir, ".httpignore"), "/_flow/\n", "UTF-8");
// The application settings, with the sql provider already registered by hand as the guide said before.
var engineFile = new java.io.File(dir, "_flow/engine.yaml");
FileUtils.writeStringToFile(engineFile, "version: 1\nengineQName: lib_flow_engine.Engine\n# application settings\nbindings: {}\nconfig:\n" +
	"  app:\n    title: Desk # shown in the shell\n  data:\n    providers:\n      sql:\n        implementation: sql.table\n", "UTF-8");
function engineYaml() { return read(engineFile); }
function writeEngineYaml(text) { FileUtils.writeStringToFile(engineFile, text, "UTF-8"); }

// A fake runtime: the SQL plan creates the tables once, the initializer applies them.
var database = { version: null };
var ctx = { calls: [], lib: lib, cacheClear: function () {} };
ctx.runFlowSource = function () { return { ok: true, result: { plan: { statements: database.version === null ? ["CREATE TABLE tasks"] : [] }, previousVersion: database.version } }; };
ctx.callBlock = function (name, props) {
	ctx.calls.push({ block: name, props: props });
	if (name === "requestable.call") database.version = 1;
	return { ok: true, result: {} };
};
ctx.flowCodeSet = function (args) {
	FileUtils.writeStringToFile(new java.io.File(args.projectDir, "_flow/flows/" + args.name + ".flow.js"), args.code, "UTF-8");
	return { ok: true, revision: "r-" + args.name };
};
ctx.flowCodePromote = function () { return { ok: true }; };
ctx.applyMutationSource = function (request) { ctx.calls.push({ block: "engine.mutate", mutations: request.mutations }); return JSON.parse(engine.applyMutation(JSON.stringify(request))); };
var crud = lib("crud-fastpath");
var spec = { facade: { prefix: "desk" }, ui: { generate: "none" }, security: { principals: { ada: "agent" } }, entities: [
	{ name: "teams", generate: "data", fields: [{ name: "Id", type: "INTEGER", primary: true }, { name: "Label", type: "VARCHAR(80)", required: true }] },
	{ name: "tasks", generate: "schema", fields: [{ name: "Id", type: "INTEGER", primary: true }, { name: "Title", type: "VARCHAR(80)", required: true }] }] };
function preview(model) { return crud.applyUnlocked(ctx, { project: "CrudConfig", projectDir: String(dir), spec: model || spec, dryRun: true }); }
function apply(model, planHash) { return crud.applyUnlocked(ctx, { project: "CrudConfig", projectDir: String(dir), spec: model || spec, planHash: planHash }); }
var generated = crud.compile(spec, "CrudConfig", { model: lib("crud-model"), legacy: lib("crud-legacy"), ui: lib("crud-ui") }).config;
var connection = Object.keys(generated.sql.connections)[0];

// 1. The preview names what apply registers; the provider registered by hand with the same value is not written again.
var first = preview();
check(first.status === "pending" && first.applicable === true && first.changed.indexOf("_flow/engine.yaml") >= 0, "the preview says engine.yaml changes", first);
var wanted = ["config.sql.connections." + connection, "config.data.sources.teams_read", "config.data.sources.teams_write", "config.data.sources.tasks_read", "config.data.sources.tasks_write"];
check(first.projectConfig && first.projectConfig.path === "_flow/engine.yaml" && first.projectConfig.set.slice().sort().join(",") === wanted.slice().sort().join(",")
	&& first.projectConfig.entries === 6 && first.projectConfig.remove.length === 0, "it registers the connection and every generated source, not the provider already there", first.projectConfig);
check(/registers the connection and the data sources once in the project config of _flow\/engine.yaml/.test(first.next), "next says apply registers them", first.next);
check(engineYaml().indexOf("connections") < 0, "a preview writes nothing");

// 2. Apply writes them through the minimal edit: the other lines stay, every value is the generated one.
var applied = apply(spec, first.planHash);
check(applied.applied === true && applied.projectConfig && applied.projectConfig.persisted === "saved" && applied.projectConfig.set.length === 5, "apply registers the project configuration", applied.projectConfig);
var text = engineYaml();
check(text.indexOf("# application settings") >= 0 && text.indexOf("title: Desk # shown in the shell") >= 0, "comments and other settings of engine.yaml are kept", text);
check(text.split("tasks_read:").length === 2 && text.split("implementation:").length === 2, "each path is registered once", text);
var manifest = JSON.parse(read(new java.io.File(dir, "_flow/resources/sql/crud/manifest.json")));
check(manifest.pending === false && Object.keys(manifest.projectConfig).length === 6 && manifest.projectConfig["data.sources.tasks_write"].writableFields.indexOf("title") >= 0,
	"the manifest records the paths the model owns", manifest.projectConfig);
var lean = read(new java.io.File(dir, "_flow/flows/desk_teams_read.flow.js"));
check(lean.indexOf('"tasks_read"') < 0, "a generated Flow still carries only the configuration its body names");

// 3. A business Flow without config of its own reads the generated sources and their connection from the project.
var business = "const _flow = {\n  sourceVersion: 2,\n}\n\nfunction Board({ input, config, result }) {\n" +
	"  result.table = config.data.sources.tasks_write.table\n  result.connection = config.data.sources.tasks_read.connection\n" +
	"  result.dialect = config.sql.connections." + connection + ".dialect\n  result.provider = config.data.providers.sql.implementation\n  result.title = config.app.title\n}\n";
// A standalone run reads the project of __flowProjectDir, as the server reads the project of the Flow.
__flowProjectDir = String(dir);
var run = JSON.parse(engine.run(JSON.stringify({ flowSource: business, input: {}, includeTrace: false })));
var out = run.result || {};
check(run.ok !== false && out.table === "tasks" && out.connection === connection && out.dialect === generated.sql.connections[connection].dialect
	&& out.provider === "sql.table" && out.title === "Desk", "a business Flow inherits the generated sources and connection", run);

// 4. Once: the next preview is applied, and applying again leaves engine.yaml byte for byte.
var again = preview();
check(again.status === "applied" && again.projectConfig.set.length === 0 && again.changed.length === 0, "the next preview has nothing to register", again);
var proof = crud.proof(ctx, { project: "CrudConfig", projectDir: String(dir), spec: spec });
check(proof.checks.some(function (c) { return c.kind === "project-config" && c.ok === true; }), "flow-crud-proof checks the registration", proof.checks.filter(function (c) { return c.kind; }));
var mutationsBefore = ctx.calls.filter(function (c) { return c.block === "engine.mutate"; }).length;
apply(spec, again.planHash);
check(engineYaml() === text && ctx.calls.filter(function (c) { return c.block === "engine.mutate"; }).length === mutationsBefore, "a second apply does not touch engine.yaml");

// 5. The model owns its paths: a value changed by hand blocks the plan, a named configuration does not.
writeEngineYaml(text.replace(/(tasks_read:\n(?:.*\n)*?\s+table: )"?tasks"?/, "$1\"tasks_v2\""));
var changed = preview();
var conflict = changed.diagnostics.filter(function (d) { return d.code === "FLOW_CRUD_CONFIG_CONFLICT"; })[0];
check(changed.status === "blocked" && conflict && conflict.configPath === "config.data.sources.tasks_read" && conflict.path === "_flow/engine.yaml"
	&& /configs\.<name>/.test(conflict.fix), "a hand-changed value is a conflict with its fix", changed.diagnostics);
writeEngineYaml(text + "configs:\n  production:\n    sql:\n      connections:\n        " + connection + ":\n          url: \"jdbc:postgresql://db:5432/desk\"\n");
var named = preview();
check(named.status === "applied" && !named.diagnostics.length, "a named configuration overriding the connection is not a conflict", named.diagnostics);
var production = engineYaml();

// 6. A source the model no longer generates (tasks becomes read-only) is removed, the rest kept.
var readOnly = JSON.parse(JSON.stringify(spec)); readOnly.entities[1].readOnly = true;
var shrink = preview(readOnly);
check(shrink.status === "pending" && shrink.projectConfig.remove.join(",") === "config.data.sources.tasks_write" && shrink.projectConfig.set.length === 0
	&& shrink.changed.indexOf("_flow/engine.yaml") >= 0, "the preview removes the source no longer generated", shrink.projectConfig);
apply(readOnly, shrink.planHash);
var after = engineYaml();
check(after.indexOf("tasks_write:") < 0 && after.indexOf("tasks_read:") > 0 && after.indexOf("jdbc:postgresql://db:5432/desk") > 0 && after.indexOf("# application settings") >= 0,
	"apply removes it and keeps the named configuration and the comments", after);
check(!JSON.parse(read(new java.io.File(dir, "_flow/resources/sql/crud/manifest.json"))).projectConfig["data.sources.tasks_write"], "the manifest no longer owns it");
check(production !== after, "engine.yaml changed only for the removal");
FileUtils.deleteQuietly(dir);
print(JSON.stringify({ passed: true, count: checks.length, checks: checks }));
