const _meta = {
  sourceVersion: 2,
  version: 1,
  private: true,
  runtime: "rhino",
  uses: ["mcp", "experience"],
  icon: "mdi:school-outline",
  description: "Serves library ACE drawers and pushes bounded advice at the tools/call boundary.",
  properties: {
    request: { kind: "expression", type: "object", default: "input.request" },
    response: { kind: "expression", type: "object" },
    operation: { kind: "text", type: "string", default: "push" },
    out: { kind: "path", mode: "write", default: "local.response" },
  },
  outputs: { out: { type: "unknown" } },
}

(function () {
  var File = Packages.java.io.File, Files = Packages.java.nio.file.Files;
  var UTF8 = Packages.java.nio.charset.StandardCharsets.UTF_8;
  var CACHE = "lib_flow_mcp.experience.files.v1", SESSIONS = "lib_flow_mcp.experience.sessions.v1";
  var CONTROL = "lib_flow_mcp.experience.control.v1";

  function read(file) { return String(new Packages.java.lang.String(Files.readAllBytes(file.toPath()), UTF8)); }
  function path(file) { return String(file.getCanonicalPath()); }
  function lock(host) {
    var controls = host.sharedMap(CONTROL);
    controls.putIfAbsent("lock", new Packages.java.util.concurrent.locks.ReentrantLock());
    return controls.get("lock");
  }
  function cached(host, file, loader) {
    if (!file.isFile()) return null;
    var attrs = Files.readAttributes(file.toPath(), Packages.java.nio.file.attribute.BasicFileAttributes);
    var stamp = String(attrs.lastModifiedTime()) + ":" + attrs.size() + ":" + attrs.fileKey();
    var cache = host.sharedMap(CACHE), key = path(file), old = cache.get(key);
    var kept = old === null ? null : JSON.parse(String(old));
    if (kept && kept.stamp === stamp) return kept.value;
    var value = loader(read(file));
    if (cache.size() >= 512 && old === null) cache.clear();
    cache.put(key, new Packages.java.lang.String(JSON.stringify({ stamp: stamp, value: value })));
    var control = host.sharedMap(CONTROL);
    control.put("reads", new Packages.java.lang.Long(Number(control.get("reads") || 0) + 1));
    return value;
  }
  function manager() {
    try { return Packages.com.twinsoft.convertigo.engine.Engine.theApp.databaseObjectsManager; }
    catch (e) { return null; }
  }
  function project(name) {
    try { return manager().getOriginalProjectByName(String(name), false); }
    catch (e) { return null; }
  }
  function roots(host, request, all) {
    var args = request.method === "tools/call" ? request.params && request.params.arguments || {} : request.params || {};
    var found = {}, result = [];
    function add(name, dir, core) {
      if (!dir || found[path(new File(String(dir)))]) return;
      var root = new File(String(dir)).getCanonicalFile();
      found[path(root)] = true;
      result.push({ library: String(name || root.getName()), root: root, core: core === true });
      if (core) return;
      var live = project(name), references = [];
      if (live) {
        var refs = live.getReferenceList().toArray();
        for (var i = 0; i < refs.length; i++) {
          if (refs[i].getParser) references.push(String(refs[i].getParser().getProjectName() || ""));
        }
      } else {
        references = cached(host, new File(root, "c8oProject.yaml"), function (text) {
          var names = [], match, re = /^\s+projectName:\s*["']?([A-Za-z0-9_-]+)/gm;
          while ((match = re.exec(text))) names.push(match[1]);
          return names;
        }) || [];
      }
      references.forEach(function (ref) {
        var target = project(ref);
        var sibling = new File(root.getParentFile(), ref);
        if (target) add(ref, String(target.getDirPath()), ref === "lib_flow_engine");
        else if (sibling.isDirectory()) add(ref, path(sibling), ref === "lib_flow_engine");
      });
    }
    var core = project("lib_flow_engine");
    if (core) add("lib_flow_engine", String(core.getDirPath()), true);
    else if (host.engineDir) add("lib_flow_engine", path(new File(host.engineDir).getParentFile()), true);
    if (all) {
      host.targets().forEach(function (target) { add(target.project, target.projectDir, target.project === "lib_flow_engine"); });
      if (host.projectDir) add("lib_flow_mcp", host.projectDir, false);
    }
    var targetArgs = { project: args.project, projectDir: args.projectDir };
    if (!targetArgs.project && args.qname && String(args.qname).indexOf(".") > 0) targetArgs.project = String(args.qname).split(".")[0];
    try { host.resolveProject(targetArgs); } catch (e) { /* Unknown targets contribute no drawers. */ }
    if (targetArgs.projectDir) add(targetArgs.project, targetArgs.projectDir, false);
    return result;
  }
  function catalog(host, request, ace, all) {
    var drawers = [];
    roots(host, request, all).forEach(function (target) {
      var dir = new File(target.root, "_flow/resources/ace"), files = dir.listFiles();
      for (var i = 0; files && i < files.length; i++) {
        var match = /^([a-z][a-z0-9_-]*)\.md$/.exec(String(files[i].getName()));
        if (!match || target.core && match[1] !== "common") continue;
        var drawer = match[1], library = target.library;
        var loaded = cached(host, files[i], function (text) {
          return { text: text, entries: ace.parse(text, library, drawer) };
        });
        if (loaded) drawers.push({ library: library, drawer: drawer, text: loaded.text, entries: loaded.entries,
          uri: "flow://ace/" + library + "/" + drawer });
      }
    });
    return drawers.sort(function (a, b) { return a.uri.localeCompare(b.uri); });
  }
  function session(host) {
    var http = host.http, identity = "";
    function header(name) { var value = http && http.getHeader(name); return value === null || value === undefined ? "" : String(value); }
    if (http && host.caller === null) return null;
    identity = header("X-Convertigo-Conversation-Id") || header("Mcp-Session-Id") || String(host.session || "");
    if (!identity && http) {
      var servletSession = http.getSession(false);
      if (servletSession) identity = String(servletSession.getId());
    }
    // Stateless clients sharing a token cannot be distinguished without a conversation/session id.
    if (!identity) identity = String(host.caller || "internal");
    return host.hash(String(host.caller || "internal") + "\n" + identity + "\n" + header("X-Convertigo-Subagent-Run"));
  }
  function source(host, mcp, request, value) {
    var args = request.params && request.params.arguments || {}, name = String(request.params && request.params.name || "");
    if (!/^(?:code|flow-(?:block-)?code)-(set|patch|check)$/.test(name)) return "";
    if (/-(set)$/.test(name)) return String(args.code || args.flowScript || args.flowSource || "");
    // check ignores supplied backend code. patch/check inspect the resulting working copy, including Studio drafts.
    var target = { project: args.project, projectDir: args.projectDir };
    var qname = String(args.qname || args.flowQName || "");
    if (!target.project && qname.indexOf(".") > 0) target.project = qname.split(".")[0];
    try { host.resolveProject(target); } catch (e) { return ""; }
    if (!target.projectDir) return "";
    var block = String(args.block || args.blockName || "");
    var flow = String(args.name || args.flowName || qname.split(".").pop() || "");
    if (block && !/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(block) || !block && !/^[\w$-]+$/.test(flow)) return "";
    var file = new File(String(target.projectDir), block ? "_flow/blocks/" + block.replace(/\./g, "/") + ".block.js" : "_flow/flows/" + flow + ".flow.js");
    var store = mcp.sourceStore(target);
    return store.exists(file) ? store.read(file) : "";
  }
  function log(host, key, request, advice) {
    var workspace = "";
    try { workspace = String(Packages.com.twinsoft.convertigo.engine.Engine.USER_WORKSPACE_PATH || ""); } catch (e) {}
    // Standalone tests stay inside the MCP worktree, never in an unrelated runtime workspace.
    if (!manager() && host.projectDir) workspace = path(new File(host.projectDir, "_private"));
    if (!workspace) return;
    var file = new File(workspace, "ace/experience-push.jsonl");
    file.getParentFile().mkdirs();
    var writer = Files.newBufferedWriter(file.toPath(), UTF8,
      Packages.java.nio.file.StandardOpenOption.CREATE, Packages.java.nio.file.StandardOpenOption.APPEND);
    try {
      writer.write(JSON.stringify({ time: new Date().toISOString(), session: key, tool: String(request.params.name),
        reason: advice.experience.reason, drawer: advice.experience.drawer,
        ids: advice.experience.entries.map(function (entry) { return entry.id; }), sources: advice.sources,
        estimatedTokens: advice.estimatedTokens }));
      writer.newLine();
    } finally { writer.close(); }
  }
  function push(ctx, host, request, response, mcp, ace) {
    if (String(host.setting) === "off" || !response || !response.result) return response;
    var key = session(host);
    if (!key) return response;
    var sessions = host.sharedMap(SESSIONS), kept = sessions.get(key), now = Date.now();
    var state = kept === null ? null : JSON.parse(String(kept));
    if (!state || now - state.at > 86400000) state = { call: 0, drawers: {}, sent: {} };
    state.call++; state.at = now;
    // Bounded JVM state, with the least recently active session leaving first under pressure.
    if (kept === null && sessions.size() >= 1024) {
      var it = sessions.entrySet().iterator(), oldest = null;
      while (it.hasNext()) { var item = it.next(), at = JSON.parse(String(item.getValue())).at; if (!oldest || at < oldest.at) oldest = { key: item.getKey(), at: at }; }
      if (oldest) sessions.remove(oldest.key);
    }
    var data = response.result.structuredContent || {}, codes = ace.diagnosticCodes(data);
    var blocks = ace.domains(request, data, "");
    var isBackendCode = /^(?:code|flow-(?:block-)?code)-(set|patch|check)$/.test(String(request.params.name)) && !blocks.length;
    var advice = null;
    if (blocks.length || isBackendCode || Object.keys(codes).length) {
      var drawers = catalog(host, request, ace, false), entries = [];
      drawers.forEach(function (drawer) { entries = entries.concat(drawer.entries); });
      if (entries.length) {
        if (isBackendCode && String(host.setting) !== "errors-only") blocks = ace.domains(request, data, source(host, mcp, request, data));
        advice = ace.select(entries, blocks, codes, state, String(host.setting) === "errors-only" ? "errors-only" : "on");
      }
    }
    sessions.put(key, new Packages.java.lang.String(JSON.stringify(state)));
    if (!advice) return response;
    // Copy: stable caches and provider results must never acquire advice belonging to one session.
    var answer = JSON.parse(JSON.stringify(response));
    answer.result.structuredContent = answer.result.structuredContent || {};
    answer.result.structuredContent.experience = advice.experience;
    answer.result.content = (answer.result.content || []).concat([{ type: "text", text: advice.text }]);
    try { log(host, key, request, advice); }
    catch (e) { try { Packages.com.twinsoft.convertigo.engine.Engine.logEngine.warn("Flow ACE push log unavailable: " + String(e)); } catch (ignored) {} }
    return answer;
  }
  return {
    run: function (ctx, node) {
      var props = ctx.props(node), mcp = ctx.lib("mcp"), ace = ctx.lib("experience");
      var request = mcp.requestValue(ctx, props.request), response = props.response;
      if (typeof response === "string") response = ctx.expr(response);
      var host = mcp._experienceHost(ctx), operation = String(props.operation || "push"), value = response;
      host.setting = String(host.setting).trim().toLowerCase();
      var mutex = lock(host);
      mutex.lock();
      try {
        if (operation === "push") value = push(ctx, host, request, response, mcp, ace);
        else {
          var drawers = catalog(host, request, ace, true);
          if (operation === "list") value = [{ uri: "flow://ace", name: "Flow ACE", description: "Experience drawers, entry counts and diagnostic/block triggers.", mimeType: "text/markdown" }].concat(drawers.map(function (drawer) {
            return { uri: drawer.uri, name: drawer.library + " " + drawer.drawer,
              description: drawer.entries.length + " experience entries.", mimeType: "text/markdown" };
          }));
          else {
            var uri = String(request.params && request.params.uri || ""), text = null;
            if (uri === "flow://ace") text = "# Flow ACE\n\n" + drawers.map(function (drawer) {
              var codes = [], blocks = [];
              drawer.entries.forEach(function (entry) { codes = codes.concat(entry.codes); blocks = blocks.concat(entry.blocks); });
              return "- " + drawer.uri + ": " + drawer.entries.length + " entries; @codes: " + codes.join(", ") + "; @blocks: " + blocks.join(", ");
            }).join("\n");
            else drawers.forEach(function (drawer) { if (drawer.uri === uri) text = drawer.text; });
            value = mcp.finalizeResponse(ctx, request, text === null
              ? mcp.jsonRpcError(request.id, -32000, "Unknown Flow MCP resource: " + uri, { code: "FLOW_MCP_RESOURCE_ERROR" })
              : mcp.jsonRpcResult(request.id, { contents: [{ uri: uri, mimeType: "text/markdown", text: text }] }));
          }
        }
      } catch (error) {
        if (operation !== "push") throw error;
        // Advice is optional; a malformed or unreadable drawer must never change a tool's outcome.
        value = response;
      } finally { mutex.unlock(); }
      ctx.write(props.out || "local.response", value);
      return value;
    }
  };
}())
