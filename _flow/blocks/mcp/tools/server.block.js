const _meta = {
  sourceVersion: 2, private: true, runtime: "rhino", uses: ["mcp"],
  description: "Server fallbacks for project save, requestable execution and scheduling when the legacy MCP is absent.",
  properties: { mode: { kind: "literal", type: "string", default: "list" }, request: { kind: "expression", type: "object" } },
  outputs: { out: { type: "unknown" } }
};

(function () {
  var names = ["project-save", "requestable-execute", "scheduler-list", "scheduler-apply"];
  function fail(code, message) { var e = new Error(message); e.code = code; throw e; }
  function enabled(engine) {
    return !!engine && typeof engine.isEngineMode === "function" && engine.isEngineMode() === true && !!engine.theApp &&
      !engine.theApp.databaseObjectsManager.existsProject("lib_ConvertigoMCP");
  }
  function descriptor(name, description, properties, required) {
    return { name: name, description: description, inputSchema: {
      type: "object", properties: properties, required: required || [], additionalProperties: false
    } };
  }
  function descriptors() {
    var project = { type: "string", description: "Loaded Convertigo project." };
    return [
      descriptor("project-save", "Save a loaded project's checked sources and declarations on the server.", { project: project }, ["project"]),
      descriptor("requestable-execute", "Execute a requestable internally on the server. Returns its result; application errors remain tool errors.", {
        project: project, requestable: { type: "string", description: "Project.Flow, Project.Connector.Transaction, or a Flow name relative to project." }, input: { type: "object", additionalProperties: true }
      }, ["requestable"]),
      descriptor("scheduler-list", "List server scheduled sequence jobs, optionally filtered by project.", { project: project }),
      descriptor("scheduler-apply", "Preview or upsert a project-owned private sequence job and its Quartz cron schedule. dryRun defaults to true. Names are scoped to the project; no deletion.", {
        project: project, sequence: { type: "string" }, name: { type: "string", description: "Project-local job name." },
        cron: { type: "string", description: "Quartz cron expression." }, enabled: { type: "boolean", default: true }, dryRun: { type: "boolean", default: true }
      }, ["project", "sequence", "name", "cron"])
    ];
  }
  function list(manager, project) {
    var jobs = [], iterator = manager.getSchedulerXML().getScheduledJobs().iterator();
    while (iterator.hasNext()) {
      var item = iterator.next(), job = item.getJob(), schedule = item.getSchedule();
      if (!job || typeof job.getProjectName !== "function" || (project && String(job.getProjectName()) !== project)) continue;
      jobs.push({ name: String(item.getName()), project: String(job.getProjectName()), sequence: typeof job.getSequenceName === "function" ? String(job.getSequenceName()) : "",
        cron: schedule && typeof schedule.getCron === "function" ? String(schedule.getCron()) : "", enabled: Boolean(item.isAllEnabled()) });
    }
    return { ok: true, jobs: jobs };
  }
  function target(engine, name) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) fail("PROJECT_REQUIRED", "A loaded project name is required.");
    var project = engine.theApp.databaseObjectsManager.getOriginalProjectByName(name, false);
    if (!project) fail("UNKNOWN_PROJECT", "Unknown project: " + name);
    return project;
  }
  function execute(ctx, engine, name, args) {
    var projectName = String(args.project || "").trim();
    if (name === "project-save") {
      var project = target(engine, projectName);
      ctx.lib("mcp").withProjectFlagLock(project, function () { engine.theApp.databaseObjectsManager.exportProject(project); });
      return { ok: true, project: projectName, saved: true };
    }
    if (name === "requestable-execute") {
      var requestable = String(args.requestable || "").trim(), note = "";
      // A bare Flow name is unique once the project is given: read it there and say so.
      if (projectName && /^[A-Za-z_][A-Za-z0-9_]*$/.test(requestable)) {
        note = "requestable \"" + requestable + "\" was read as \"" + projectName + "." + requestable + "\" (project " + projectName + ").";
        requestable = "." + requestable;
      }
      if (/^\.[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?$/.test(requestable)) { target(engine, projectName); requestable = projectName + requestable; }
      if (!/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*){1,2}$/.test(requestable)) {
        var bare = /^\.?([A-Za-z_][A-Za-z0-9_]*)$/.exec(requestable);
        fail("REQUESTABLE_REQUIRED", "Use Project.Flow or Project.Connector.Transaction" +
          (bare ? ": requestable \"<project>." + bare[1] + "\", or project with requestable \"" + bare[1] + "\"." : "."));
      }
      target(engine, requestable.split(".")[0]);
      var out = { ok: true, result: ctx.callBlock("requestable.call", { requestable: requestable, input: args.input || {} }, { trace: false }) };
      if (note) out.note = note;
      return out;
    }
    var manager = engine.theApp.schedulerManager;
    if (!manager) fail("SCHEDULER_UNAVAILABLE", "The server scheduler is unavailable.");
    if (name === "scheduler-list") return list(manager, projectName);
    var owner = target(engine, projectName), sequenceName = String(args.sequence || ""), localName = String(args.name || "");
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(sequenceName) || !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(localName)) fail("SCHEDULER_NAME_INVALID", "Use simple sequence and job names.");
    var sequence = owner.getSequenceByName(sequenceName);
    if (!sequence || !sequence.isPrivateAccessibility()) fail("SCHEDULER_PRIVATE_REQUIRED", "A scheduled job must target a private sequence or Flow.");
    var cron = String(args.cron || "");
    if (!Packages.org.quartz.CronExpression.isValidExpression(cron)) fail("SCHEDULER_CRON_INVALID", "Invalid Quartz cron expression.");
    ["enabled", "dryRun"].forEach(function (key) { if (args[key] !== undefined && typeof args[key] !== "boolean") fail("SCHEDULER_BOOLEAN_REQUIRED", key + " requires a boolean."); });
    var jobName = projectName + "." + localName, scheduleName = jobName + ".cron";
    var result = { ok: true, project: projectName, sequence: sequenceName, name: jobName, cron: cron, enabled: args.enabled !== false, dryRun: args.dryRun !== false, saved: false };
    if (result.dryRun) return result;
    // Work on a detached snapshot; failed validation/publication must not mutate the active scheduler model.
    var Manager = Packages.com.twinsoft.convertigo.engine.scheduler.SchedulerManager;
    var bytes = new Packages.java.io.ByteArrayOutputStream();
    Manager.writeSchedulerXML(manager.getSchedulerXML(), bytes);
    var model = Manager.readSchedulerXML(new Packages.java.io.ByteArrayInputStream(bytes.toByteArray()));
    var types = Packages.com.twinsoft.convertigo.beans.scheduler;
    var job = model.getJob(jobName), schedule = model.getSchedule(scheduleName);
    if (job && (typeof job.getSequenceName !== "function" || String(job.getProjectName()) !== projectName)) fail("SCHEDULER_OWNER_CONFLICT", "An incompatible job already owns this name.");
    if (schedule && typeof schedule.getCron !== "function") fail("SCHEDULER_OWNER_CONFLICT", "An incompatible schedule already owns this name.");
    if (!job) { job = new types.SequenceConvertigoJob(); job.setName(jobName); model.addJob(job); }
    job.setProjectName(projectName); job.setSequenceName(sequenceName); job.setContextName("scheduler_" + localName); job.setEnable(result.enabled); job.setWriteOutput(false);
    if (!schedule) { schedule = new types.ScheduleCron(); schedule.setName(scheduleName); model.addSchedule(schedule); }
    schedule.setCron(cron); schedule.setEnable(result.enabled);
    var scheduledName = jobName + "@" + scheduleName, scheduled = model.getScheduledJob(scheduledName);
    if (!scheduled) { scheduled = new types.ScheduledJob(); scheduled.setJob(job); scheduled.setSchedule(schedule); model.addScheduledJob(scheduled); }
    scheduled.setEnable(result.enabled);
    var previous = manager.getSchedulerXML();
    manager.setSchedulerXML(model);
    if (!manager.saveWithResult()) { manager.setSchedulerXML(previous); manager.saveWithResult(); fail("SCHEDULER_SAVE_FAILED", "Scheduler publication failed; previous configuration restored."); }
    manager.refreshJobs(); result.saved = true; return result;
  }
  return {
    descriptors: descriptors, enabled: enabled, execute: execute,
    run: function (ctx, node) {
      var props = ctx.props(node), engine = Packages.com.twinsoft.convertigo.engine.Engine;
      if (!enabled(engine)) return props.mode === "call" ? null : [];
      if (props.mode !== "call") return descriptors();
      var request = props.request, name = String(request.params && request.params.name || "");
      if (names.indexOf(name) < 0) return null;
      var mcp = ctx.lib("mcp");
      var lock = name === "scheduler-apply" ? Packages.com.twinsoft.convertigo.engine.util.LockRegistry.lock("flow-mcp-scheduler") : null;
      if (lock) lock.lock();
      try { var value = execute(ctx, engine, name, request.params.arguments || {}); mcp.stableToolCalled(name); return mcp.toolResponse(request, value, ctx); }
      catch (error) { return mcp.toolError(request, error, ctx); }
      finally { if (lock) lock.release(); }
    }
  };
}())
