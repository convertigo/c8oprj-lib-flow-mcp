const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");

// Exercise the server tool up to its preview return without a Studio or a Quartz scheduler.
class CronExpression {
  static isValidExpression() { return true; }
  setTimeZone() {}
  getNextValidTimeAfter() { return null; }
}

const source = readFileSync(join(__dirname, "../_flow/blocks/mcp/tools/server.block.js"), "utf8");
const tools = runInNewContext(source, { Packages: {
  org: { quartz: { CronExpression } },
  java: {
    util: { TimeZone: { getDefault: () => ({ getID: () => "UTC" }) }, Date, Locale: { ROOT: {} } },
    text: { SimpleDateFormat: class { setTimeZone() {} } },
  },
} });
const engine = { theApp: {
  schedulerManager: {},
  databaseObjectsManager: {
    getOriginalProjectByName: () => ({ getSequenceByName: () => ({ isPrivateAccessibility: () => true }) }),
  },
} };
const plan = { project: "orders", sequence: "Job", name: "daily", cron: "0 0 6 * * ?" };
const preview = args => tools.execute({}, engine, "scheduler-apply", args);

test("scheduler preview tells callers how to save", () => {
  const result = preview(plan);
  assert.equal(result.dryRun, true);
  assert.equal(result.saved, false);
  assert.match(result.hint, /dryRun to false \(JSON boolean\) to save/);
});

test("scheduler name errors and help give the project-local job naming rule", () => {
  const rule = /start with an ASCII letter or _, followed by ASCII letters, digits or _.*64 characters/;
  assert.throws(() => preview({ ...plan, name: "daily-job" }), { code: "SCHEDULER_NAME_INVALID", message: rule });
  const tool = tools.descriptors().find(tool => tool.name === "scheduler-apply");
  assert.match(tool.inputSchema.properties.name.description, rule);
});
