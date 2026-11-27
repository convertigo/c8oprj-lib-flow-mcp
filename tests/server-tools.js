// Server tools use real scheduler beans, with an in-memory manager and no server, network or filesystem writes.
var root = new java.io.File(arguments[0]), files = Packages.org.apache.commons.io.FileUtils;
var text = String(files.readFileToString(new java.io.File(root, "_flow/blocks/mcp/tools/server.block.js"), "UTF-8"));
var tools = eval(text.substring(text.indexOf("(function ()")));
function assert(ok, message) { if (!ok) throw new Error(message); }
function refuses(code, fn) { var seen = ""; try { fn(); } catch (error) { seen = String(error.code); } assert(seen === code, "Expected " + code + ", got " + seen); }
var exported = 0, calls = [], persisted = 0, refreshed = 0;
var model = new Packages.com.twinsoft.convertigo.beans.scheduler.SchedulerXML();
var owner = { getSequenceByName: function (name) { return { isPrivateAccessibility: function () { return name === "Job"; } }; } };
var manager = { getSchedulerXML: function () { return model; }, setSchedulerXML: function (value) { model = value; }, saveWithResult: function () { persisted++; return true; }, refreshJobs: function () { refreshed++; } };
var engine = { isEngineMode: function () { return true; }, theApp: { schedulerManager: manager, databaseObjectsManager: {
  existsProject: function () { return false; }, getOriginalProjectByName: function (name) { return name === "orders" ? owner : null; }, exportProject: function (project) { assert(project === owner, "Exact project saved"); exported++; }
} } };
var ctx = { lib: function () { return { withProjectFlagLock: function (_, fn) { return fn(); } }; }, callBlock: function (name, args) { calls.push({ name: name, args: args }); return { answer: 42 }; } };
assert(tools.enabled(engine), "Server without legacy MCP enables fallbacks");
assert(!tools.enabled({}), "Standalone tests do not enable server tools");
assert(!tools.enabled({ isEngineMode: function () { return false; } }), "Studio keeps its relay");
var descriptors = tools.descriptors();
assert(descriptors.length === 4 && descriptors.every(function (d) { return d.inputSchema.type === "object" && d.inputSchema.additionalProperties === false; }), "Four bounded object schemas");
assert(tools.execute(ctx, engine, "project-save", { project: "orders" }).saved && exported === 1, "Project saved through manager");
refuses("PROJECT_REQUIRED", function () { tools.execute(ctx, engine, "project-save", { project: "../other" }); });
refuses("UNKNOWN_PROJECT", function () { tools.execute(ctx, engine, "project-save", { project: "unknown" }); });
var result = tools.execute(ctx, engine, "requestable-execute", { project: "orders", requestable: ".Hello", input: { name: "Ada" } });
assert(result.result.answer === 42 && calls[0].args.requestable === "orders.Hello" && calls[0].args.input.name === "Ada", "Execution uses the standard requestable boundary");
refuses("REQUESTABLE_REQUIRED", function () { tools.execute(ctx, engine, "requestable-execute", { requestable: "../orders" }); });
// A bare Flow name is read in the given project: the answer is the result alone, as for a qualified name.
var bare = tools.execute(ctx, engine, "requestable-execute", { project: "orders", requestable: "catalog_list" });
assert(bare.result.answer === 42 && calls[1].args.requestable === "orders.catalog_list", "Bare Flow name resolves in the given project");
assert(JSON.stringify(Object.keys(bare)) === '["ok","result"]', "The answer does not repeat how the name was read: " + JSON.stringify(bare));
var bareError = null;
try { tools.execute(ctx, engine, "requestable-execute", { requestable: "catalog_list" }); } catch (error) { bareError = error; }
assert(bareError && bareError.code === "REQUESTABLE_REQUIRED" && /<project>\.catalog_list/.test(String(bareError.message) + " " + String(bareError.hint || "")),
  "Without a project, the refusal gives the exact qualified form");
var plan = { project: "orders", sequence: "Job", name: "daily", cron: "0 0 6 * * ?" };
var timeZone = java.util.TimeZone.getDefault();
var beforeScheduling = Number(java.lang.System.currentTimeMillis());
function assertDailyFireTimes(response, times) {
  assert(response.timeZone === String(timeZone.getID()), "Scheduler reports the JVM default time zone");
  assert(Array.isArray(times) && times.length === 3, "Scheduler reports three future fire times");
  var previous = beforeScheduling;
  times.forEach(function (value) {
    var date = java.time.OffsetDateTime.parse(value);
    var instant = Number(date.toInstant().toEpochMilli());
    assert(date.getHour() === 6 && date.getMinute() === 0 && date.getSecond() === 0, "Cron fires at 06:00 local time");
    assert(date.getOffset().getTotalSeconds() * 1000 === timeZone.getOffset(instant), "Fire time uses the JVM zone offset at that instant");
    assert(instant > previous, "Fire times are strictly increasing and in the future");
    previous = instant;
  });
}
var preview = tools.execute(ctx, engine, "scheduler-apply", plan);
assert(preview.dryRun && persisted === 0 && model.getJobs().isEmpty(), "Preview has no side effects");
assertDailyFireTimes(preview, preview.nextFireTimes);
refuses("SCHEDULER_PRIVATE_REQUIRED", function () { tools.execute(ctx, engine, "scheduler-apply", Object.assign({}, plan, { sequence: "Public" })); });
refuses("SCHEDULER_CRON_INVALID", function () { tools.execute(ctx, engine, "scheduler-apply", Object.assign({}, plan, { cron: "bad" })); });
refuses("SCHEDULER_BOOLEAN_REQUIRED", function () { tools.execute(ctx, engine, "scheduler-apply", Object.assign({}, plan, { enabled: "true" })); });
var applied = tools.execute(ctx, engine, "scheduler-apply", Object.assign({}, plan, { dryRun: false }));
assert(applied.saved && persisted === 1 && refreshed === 1, "Application persists and refreshes");
assertDailyFireTimes(applied, applied.nextFireTimes);
tools.execute(ctx, engine, "scheduler-apply", Object.assign({}, plan, { dryRun: false, enabled: false }));
var listed = tools.execute(ctx, engine, "scheduler-list", { project: "orders" });
assert(listed.jobs.length === 1 && !listed.jobs[0].enabled && model.getJobs().size() === 1, "Reapply updates a single owned job");
assertDailyFireTimes(listed, listed.jobs[0].nextFireTimes);
assert(tools.execute(ctx, engine, "scheduler-list", { project: "other" }).jobs.length === 0, "List respects project filter");
var before = model, attempts = 0;
manager.saveWithResult = function () { return ++attempts > 1; };
refuses("SCHEDULER_SAVE_FAILED", function () { tools.execute(ctx, engine, "scheduler-apply", Object.assign({}, plan, { dryRun: false, name: "failure" })); });
assert(model === before && model.getJobs().size() === 1 && attempts === 2, "Failed publication restores previous state");
// Exercise the real entry point twice: the shared LockRegistry handle must be released even on preview calls.
var testEngine = engine;
var entry = eval(text.substring(text.indexOf("(function ()")).replace("engine = Packages.com.twinsoft.convertigo.engine.Engine", "engine = testEngine"));
ctx.props = function (node) { return node.props; };
ctx.lib = function () { return { stableToolCalled: function () {}, toolResponse: function (_, value) { return value; }, toolError: function (_, error) { throw error; } }; };
for (var pass = 0; pass < 2; pass++) assert(entry.run(ctx, { props: { mode: "call", request: { params: { name: "scheduler-apply", arguments: plan } } } }).dryRun, "Entry point releases scheduler lock");
print("server-tools OK");
