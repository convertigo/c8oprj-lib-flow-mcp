// Leased managed tokens (lease: "turn"): the contract lib_ConvertigoMCP and the Agent Bridge share with this endpoint.
// The lease lives in the server store (lib_ConvertigoMCP.managedTokenLeases, a ConcurrentHashMap from the managed_ id to
// a JSON string {idleMs, expiresAt, maxAt}); each authenticated call slides it, only over its exact previous string.
// Uses a disposable JWT store and a fresh server store; no existing token, key or lease is read.
var projectDir = arguments.length > 0 ? arguments[0] : ".";
var File = java.io.File, Files = java.nio.file.Files, System = java.lang.System, UTF8 = java.nio.charset.StandardCharsets.UTF_8;
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var ConcurrentHashMap = java.util.concurrent.ConcurrentHashMap;
var temporary = Files.createTempDirectory("flow-mcp-jwt-lease-").toFile();
var previous = System.getProperty("flow.mcp.jwt.path");
System.setProperty("flow.mcp.jwt.path", String(temporary.getAbsolutePath()));

var LEASES = "lib_ConvertigoMCP.managedTokenLeases";
var MINUTE = 60000, WEEK = 7 * 86400000;
var checks = 0;
var context; // the Convertigo context the Flow engine reads, only while the end-to-end part runs
function assert(value, message) { checks++; if (!value) throw new Error(message); }

try {
  var jwt = eval(String(FileUtils.readFileToString(new File(projectDir, "_flow/lib/jwt.js"), "UTF-8")));
  var mcp = eval(String(FileUtils.readFileToString(new File(projectDir, "_flow/lib/mcp.js"), "UTF-8")));
  var signingKey = jwt._test.signingKey();

  function hex32() { return String(java.util.UUID.randomUUID()).replace(/-/g, ""); }
  function nowSeconds() { return Math.floor(System.currentTimeMillis() / 1000); }
  function token(kid, claims) {
    var now = nowSeconds();
    var payload = { iss: "lib_ConvertigoMCP", aud: "ConvertigoMCP", sub: "lease-test", jti: hex32(), kind: "managed",
      label: "Convertigo Assistant", scope: "mcp:full", iat: now, nbf: now, exp: now + 7 * 86400 };
    Object.keys(claims || {}).forEach(function (key) {
      if (claims[key] === undefined) delete payload[key]; else payload[key] = claims[key];
    });
    return jwt._test.buildToken({ alg: "HS256", typ: "JWT", kid: kid }, payload, signingKey);
  }
  // The same token with one claim changed and its signature kept: a forgery.
  function altered(raw) {
    var parts = raw.split(".");
    var payload = JSON.parse(String(new java.lang.String(java.util.Base64.getUrlDecoder().decode(parts[1]), UTF8)));
    payload.sub = "someone-else";
    var encoded = String(java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(new java.lang.String(JSON.stringify(payload)).getBytes(UTF8)));
    return parts[0] + "." + encoded + "." + parts[2];
  }
  // The server store of Convertigo (Context.server) when the engine jar is on the classpath.
  function newServer() {
    try { return new Packages.com.twinsoft.convertigo.engine.util.SimpleMap(); }
    catch (_noEngineJar) {
      var map = new java.util.HashMap();
      return { get: function (key) { return map.get(key); }, set: function (key, value) { map.put(key, value); } };
    }
  }
  function leaseText(idleMs, expiresAt, maxAt) { return JSON.stringify({ idleMs: idleMs, expiresAt: expiresAt, maxAt: maxAt }); }
  function readLease(leases, id) { var text = leases.get(id); return text === null ? null : JSON.parse(String(text)); }
  // An HTTP MCP request: what the guard sets on the response and the request is recorded in state.
  function http(server, bearer, userAgent) {
    var state = { status: 0, headers: {}, attributes: {} };
    state.ctx = { convertigoContext: function () { return {
      server: server,
      httpServletRequest: {
        getHeader: function (name) {
          if (name === "Authorization") return bearer ? "Bearer " + bearer : null;
          if (name === "User-Agent") return userAgent || null;
          return null;
        },
        getSession: function () { return null; },
        setAttribute: function (name, value) { state.attributes[name] = String(value); }
      },
      httpServletResponse: {
        setStatus: function (value) { state.status = Number(value); },
        setHeader: function (name, value) { state.headers[name] = String(value); }
      }
    }; } };
    return state;
  }
  function call(method, id, name) {
    var request = { jsonrpc: "2.0", method: method };
    if (id !== undefined) request.id = id;
    if (method === "tools/call") request.params = { name: name || "flow-list", arguments: {} };
    return request;
  }
  function untouched(state) {
    return state.status === 0 && !state.headers["WWW-Authenticate"] && Object.keys(state.attributes).length === 0;
  }
  function refused401(state, guarded, code) {
    return state.status === 401 && String(state.headers["WWW-Authenticate"] || "").indexOf("Bearer") === 0 &&
      guarded.__flowMcpAuthenticationError && guarded.__flowMcpAuthenticationError.code === code;
  }

  var server = newServer();
  var leases = new ConcurrentHashMap();
  server.set(LEASES, leases);
  var id = "managed_" + hex32();
  var leased = token(id, { lease: "turn" });

  // 1. A live lease is accepted and slid to now + its idle time, within its cap.
  var before = System.currentTimeMillis();
  leases.put(id, leaseText(5 * MINUTE, before + MINUTE, before + WEEK));
  var accepted = jwt.validate(leased, http(server).ctx);
  var slid = readLease(leases, id);
  assert(accepted.authenticated === true && accepted.kind === "managed" && accepted.tokenId === id && accepted.user === "lease-test",
    "A leased token with a live lease was refused: " + JSON.stringify(accepted));
  assert(slid.expiresAt >= before + 5 * MINUTE && slid.expiresAt <= System.currentTimeMillis() + 5 * MINUTE,
    "The call did not slide the lease to now + its idle time: " + JSON.stringify(slid));
  assert(slid.idleMs === 5 * MINUTE && slid.maxAt === before + WEEK, "The slide changed the idle time or the cap: " + JSON.stringify(slid));
  var justSlid = String(leases.get(id));
  assert(jwt.validate(leased, http(server).ctx).authenticated === true && String(leases.get(id)) === justSlid,
    "A lease slid less than 30 s ago was written again");
  leases.put(id, leaseText(5 * MINUTE, before + MINUTE, before + 2 * MINUTE));
  assert(jwt.validate(leased, http(server).ctx).authenticated === true && readLease(leases, id).expiresAt === before + 2 * MINUTE,
    "The slide went past the cap of the lease: " + leases.get(id));
  leases.put(id, leaseText(5 * MINUTE, System.currentTimeMillis() + MINUTE, System.currentTimeMillis() + WEEK));
  var liveCall = http(server, leased);
  var liveRequest = call("tools/call", 3);
  assert(jwt.guardRequest(liveCall.ctx, liveRequest) === liveRequest && liveCall.status === 0 &&
      liveCall.attributes["com.convertigo.flow.principal"] === "mcp:lease-test" && liveRequest.__flowMcpTokenExpired === undefined,
    "The guard did not let a live leased token call its tool: " + JSON.stringify(liveCall.attributes));
  var forgedMarker = call("tools/call", 4);
  forgedMarker.__flowMcpTokenExpired = { code: "expired_token", message: "sent by the client" };
  assert(jwt.guardRequest(http(server, leased).ctx, forgedMarker) === forgedMarker && forgedMarker.__flowMcpTokenExpired === undefined,
    "A marker sent by the client survived the guard");

  // 2. An ended lease is refused as expired, with what happened and what to do.
  var endedAt = System.currentTimeMillis() - 1000;
  leases.put(id, leaseText(5 * MINUTE, endedAt, endedAt + WEEK));
  var endedText = String(leases.get(id));
  var ended = jwt.validate(leased, http(server).ctx);
  assert(ended.authenticated === false && ended.error.code === "expired_token" && ended.error.handshake === true,
    "An ended lease was not refused as an expired token: " + JSON.stringify(ended));
  assert(/^MCP token expired: its conversation used it last at \d{4}-\d\d-\d\dT[\d:.]+Z and a token stays valid 5 min without a turn using it\.$/.test(ended.error.message),
    "The refusal of an ended lease does not say what happened: " + ended.error.message);
  assert(ended.error.hint === "Send a new message in the Tigo panel: it renews the authorization. The work done so far is kept.",
    "The refusal of an ended lease does not say what to do: " + ended.error.hint);

  // 3. An ended lease is never revived, and a removed (revoked) one never comes back.
  for (var again = 0; again < 3; again++) {
    assert(jwt.validate(leased, http(server).ctx).error.code === "expired_token", "An ended lease was accepted again");
  }
  assert(String(leases.get(id)) === endedText, "An ended lease was rewritten: " + leases.get(id));
  leases.remove(id);
  for (again = 0; again < 3; again++) {
    var revoked = jwt.validate(leased, http(server).ctx);
    assert(revoked.error.code === "expired_token" && /no lease for it any more/.test(revoked.error.message), "A revoked lease was accepted");
  }
  assert(!leases.containsKey(id), "A removed lease came back");

  // 4. A missing lease is refused: no entry, no lease map, no server store, a kid that cannot hold one, an unreadable lease.
  var noEntry = jwt.validate(token("managed_" + hex32(), { lease: "turn" }), http(server).ctx);
  assert(noEntry.error.code === "expired_token" && noEntry.error.handshake === true &&
      noEntry.error.message === "MCP token expired: this engine holds no lease for it any more (revoked, or the engine restarted since it was issued).",
    "A leased token without its lease was accepted: " + JSON.stringify(noEntry));
  assert(jwt.validate(leased, http(newServer()).ctx).error.code === "expired_token", "A leased token was accepted after an engine restart");
  assert(jwt.validate(leased, http(undefined).ctx).error.code === "expired_token", "A leased token was accepted without a server store");
  leases.put("flow_managed_lease", leaseText(5 * MINUTE, System.currentTimeMillis() + MINUTE, System.currentTimeMillis() + WEEK));
  assert(jwt.validate(token("flow_managed_lease", { lease: "turn" }), http(server).ctx).error.code === "expired_token",
    "A leased token without a managed_ id was accepted");
  leases.put(id, "{not json");
  assert(jwt.validate(leased, http(server).ctx).error.code === "expired_token" && String(leases.get(id)) === "{not json",
    "An unreadable lease was accepted or rewritten");
  leases.remove(id);
  // The signature is checked before the dates: a forged leased token is refused for it, without a session.
  leases.put(id, leaseText(5 * MINUTE, System.currentTimeMillis() + MINUTE, System.currentTimeMillis() + WEEK));
  var forged = jwt.validate(altered(leased), http(server).ctx);
  assert(forged.error.code === "invalid_token_signature" && forged.error.handshake === undefined, "A forged leased token was not refused for its signature");
  var capped = token(id, { lease: "turn", iat: nowSeconds() - 7 * 86400, nbf: nowSeconds() - 7 * 86400, exp: nowSeconds() - 1 });
  var cappedRefusal = jwt.validate(capped, http(server).ctx);
  assert(cappedRefusal.error.code === "expired_token" && cappedRefusal.error.handshake === true &&
      /^MCP token expired: it reached its expiry date \(/.test(cappedRefusal.error.message),
    "A leased token past the cap of its JWT was accepted: " + JSON.stringify(cappedRefusal));
  assert(jwt.validate(altered(capped), http(server).ctx).error.code === "invalid_token_signature",
    "The dates of a leased token were read before its signature");

  // The endpoint: an expired leased token opens its session (initialize, notifications, ping), then reads why on its tools/call.
  leases.remove(id);
  ["initialize", "notifications/initialized", "ping"].forEach(function (method) {
    var state = http(server, leased);
    var request = call(method, method === "notifications/initialized" ? undefined : 1);
    assert(jwt.guardRequest(state.ctx, request) === request && untouched(state) && request.__flowMcpTokenExpired === undefined,
      method + " was not answered for an expired leased token, or ran under a principal");
  });
  ["tools/list", "resources/read"].forEach(function (method) {
    var state = http(server, leased);
    assert(refused401(state, jwt.guardRequest(state.ctx, call(method, 2)), "expired_token"), method + " ran with an expired leased token");
  });
  var expiredCall = http(server, leased);
  var toolCall = call("tools/call", 7, "project-list");
  assert(jwt.guardRequest(expiredCall.ctx, toolCall) === toolCall && untouched(expiredCall), "The tools/call of an expired leased token got a 401");
  var expectedText = "MCP token expired: this engine holds no lease for it any more (revoked, or the engine restarted since it was issued)." +
    " Send a new message in the Tigo panel: it renews the authorization. The work done so far is kept." +
    " Do not call Convertigo tools again in this turn: tell the user.";
  assert(toolCall.__flowMcpTokenExpired.code === "expired_token" && toolCall.__flowMcpTokenExpired.message === expectedText &&
      /Tigo panel/.test(toolCall.__flowMcpTokenExpired.hint), "The tools/call does not carry what to do: " + JSON.stringify(toolCall.__flowMcpTokenExpired));
  var noId = http(server, leased);
  assert(refused401(noId, jwt.guardRequest(noId.ctx, call("tools/call", undefined)), "expired_token"), "A tools/call without id was let through");
  var batch = http(server, leased);
  assert(refused401(batch, jwt.guardRequest(batch.ctx, [call("tools/call", 8)]), "expired_token"), "A batch was let through with an expired leased token");
  var forgedHandshake = http(server, altered(leased));
  assert(refused401(forgedHandshake, jwt.guardRequest(forgedHandshake.ctx, call("initialize", 1)), "invalid_token_signature"),
    "A forged leased token opened a session");

  // mcp.tools.call answers it as the tool error, in the per-client shape, without running any tool or relay.
  var dispatcherSource = String(FileUtils.readFileToString(new File(projectDir, "_flow/blocks/mcp/tools/call.block.js"), "UTF-8"));
  var dispatcher = eval(dispatcherSource.substring(dispatcherSource.indexOf("\n(function () {")));
  function dispatch(userAgent) {
    var ctx = http(server, leased, userAgent).ctx;
    var written = null;
    ctx.props = function (node) { return node.props; };
    ctx.lib = function () {
      return { requestValue: mcp.requestValue, toolError: mcp.toolError,
        legacyRelayTool: function () { throw new Error("The relay was asked"); },
        legacyRelayCall: function () { throw new Error("The call was relayed"); } };
    };
    ctx.write = function (_path, value) { written = value; };
    ctx.blockNames = function () { throw new Error("The tool catalog was read"); };
    ctx.callBlock = function () { throw new Error("A tool ran"); };
    var response = dispatcher.run(ctx, { props: { request: toolCall } });
    assert(written === response, "The tool error was not written to its output");
    return response;
  }
  [["codex_cli_rs/0.1", true], ["claude-code/2", true], ["MistralAI-VibeCLI/1.0", false]].forEach(function (client) {
    var response = dispatch(client[0]);
    var error = response.result && response.result.structuredContent && response.result.structuredContent.error;
    assert(response.id === 7 && !response.error && response.result.isError === client[1],
      client[0] + ": the expired token is not the tool error of this client: " + JSON.stringify(response));
    assert(error.code === "expired_token" && error.message === expectedText && /Tigo panel/.test(error.hint),
      client[0] + ": the tool error lost what to do: " + JSON.stringify(error));
    assert(response.result.content[0].type === "text" && response.result.content[0].text.indexOf(expectedText) >= 0,
      client[0] + ": a text client cannot read what to do: " + response.result.content[0].text);
    assert(JSON.stringify(response).indexOf("__flowMcpTokenExpired") < 0, client[0] + ": the internal marker leaked");
  });

  // 5. A managed token without a lease keeps exactly its behaviour: no lookup, its exp, its order and its 401.
  leases.put(id, endedText);
  var plain = token(id, {});
  var plainAccepted = jwt.validate(plain, http(server).ctx);
  assert(plainAccepted.authenticated === true && plainAccepted.tokenId === undefined &&
      Object.keys(plainAccepted).join(",") === "status,authenticated,kind,scope,user,payload",
    "A managed token without lease changed: " + JSON.stringify(plainAccepted));
  assert(jwt.validate(token(id, { lease: "session" }), http(server).ctx).authenticated === true, "An unknown lease kind was read as a lease");
  assert(String(leases.get(id)) === endedText, "A token without lease touched a lease");
  var plainExpired = token(id, { exp: nowSeconds() - 1 });
  var plainRefusal = jwt.validate(plainExpired, http(server).ctx);
  assert(plainRefusal.error.code === "expired_token" && plainRefusal.error.message === "The Flow MCP bearer token has expired." &&
      plainRefusal.error.hint === undefined && plainRefusal.error.handshake === undefined,
    "The expiry of a managed token without lease changed: " + JSON.stringify(plainRefusal));
  assert(jwt.validate(altered(plainExpired), http(server).ctx).error.code === "expired_token",
    "A managed token without lease no longer has its dates read before its signature");
  ["initialize", "tools/call"].forEach(function (method) {
    var state = http(server, plainExpired);
    var guarded = jwt.guardRequest(state.ctx, call(method, 5));
    assert(refused401(state, guarded, "expired_token") && guarded.__flowMcpTokenExpired === undefined,
      method + " with an expired managed token without lease is no longer a 401");
  });
  var noCode = token(id, { iss: "C8Oforms", lease: "turn" });
  var noCodeState = http(server, noCode);
  assert(refused401(noCodeState, jwt.guardRequest(noCodeState.ctx, call("initialize", 1)), "invalid_token_claims"),
    "A No Code token is no longer refused for its claims");
  leases.remove(id);

  // 6. A durable token keeps exactly its behaviour, a lease claim in its payload included.
  var durableId = "mcp_" + hex32(), durableJti = hex32();
  var active = new File(temporary, "tokens/active/" + durableId + ".json");
  active.getParentFile().mkdirs();
  var jtiHash = String(java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
    java.security.MessageDigest.getInstance("SHA-256").digest(new java.lang.String(durableJti).getBytes(UTF8))));
  Files.write(active.toPath(), new java.lang.String(JSON.stringify({ id: durableId, name: "lease-test", kind: "durable", scope: "mcp:full",
    jtiHash: jtiHash, createdAt: "", expiresAt: "", lastUsedAt: "", revokedAt: "", createdBy: "durable-test" })).getBytes(UTF8));
  [{}, { lease: "turn" }].forEach(function (extra) {
    var claims = { kind: "durable", jti: durableJti };
    Object.keys(extra).forEach(function (key) { claims[key] = extra[key]; });
    var durable = jwt.validate(token(durableId, claims), http(server).ctx);
    assert(durable.authenticated === true && durable.kind === "durable" && durable.tokenId === durableId && durable.user === "durable-test",
      "A durable token changed: " + JSON.stringify(durable));
  });
  assert(!leases.containsKey(durableId), "A durable token wrote a lease");
  var durableExpired = token(durableId, { kind: "durable", jti: durableJti, lease: "turn", exp: nowSeconds() - 1 });
  var durableRefusal = jwt.validate(durableExpired, http(server).ctx);
  assert(durableRefusal.error.code === "expired_token" && durableRefusal.error.message === "The Flow MCP bearer token has expired." &&
      durableRefusal.error.handshake === undefined, "The expiry of a durable token changed: " + JSON.stringify(durableRefusal));
  var durableCall = http(server, durableExpired);
  assert(refused401(durableCall, jwt.guardRequest(durableCall.ctx, call("tools/call", 6)), "expired_token"),
    "An expired durable token is no longer a 401");

  // 7. Concurrent slides: an update only replaces the exact string it read.
  function interleaved(backing, between) {
    var pending = true, outcomes = [];
    return {
      outcomes: outcomes,
      get: function (key) {
        var text = backing.get(key);
        if (pending && text !== null) { pending = false; between(backing, key, text); }
        return text;
      },
      replace: function (key, oldText, newText) { var done = backing.replace(key, oldText, newText); outcomes.push(done); return done; }
    };
  }
  // The Agent Bridge slides the lease between the read of the call and its write: the call keeps the Bridge's lease.
  var raceServer = newServer(), raceBacking = new ConcurrentHashMap(), raceAt = System.currentTimeMillis(), bridgeText = "";
  raceBacking.put(id, leaseText(5 * MINUTE, raceAt + MINUTE, raceAt + WEEK));
  var bridged = interleaved(raceBacking, function (backing, key, text) {
    var lease = JSON.parse(String(text));
    lease.expiresAt = System.currentTimeMillis() + lease.idleMs + 10000;
    bridgeText = JSON.stringify(lease);
    backing.replace(key, text, bridgeText);
  });
  raceServer.set(LEASES, bridged);
  assert(jwt.validate(leased, http(raceServer).ctx).authenticated === true, "A lease slid concurrently was refused");
  assert(bridged.outcomes.length === 1 && bridged.outcomes[0] === false && String(raceBacking.get(id)) === bridgeText,
    "A stale slide overwrote the concurrent one: " + JSON.stringify(bridged.outcomes) + " " + raceBacking.get(id));
  // Revoked between the read and the write: the slide does not bring it back.
  var revokedBacking = new ConcurrentHashMap();
  revokedBacking.put(id, leaseText(5 * MINUTE, raceAt + MINUTE, raceAt + WEEK));
  var revoking = interleaved(revokedBacking, function (backing, key) { backing.remove(key); });
  raceServer.set(LEASES, revoking);
  var revokedMeanwhile = jwt.validate(leased, http(raceServer).ctx);
  assert(revokedMeanwhile.error.code === "expired_token" && /no lease for it any more/.test(revokedMeanwhile.error.message) &&
      revoking.outcomes.length === 1 && revoking.outcomes[0] === false && !revokedBacking.containsKey(id),
    "A lease revoked during a slide came back or stayed valid: " + JSON.stringify(revokedMeanwhile));

  // Real threads: calls and the Bridge slide one lease together, then a revocation wins over all of them.
  function runThreads(count, body) {
    var start = new java.util.concurrent.CountDownLatch(1), threads = [], errors = new java.util.concurrent.ConcurrentLinkedQueue();
    for (var t = 0; t < count; t++) {
      (function (index) {
        var thread = new java.lang.Thread(new java.lang.Runnable({ run: function () {
          try { start["await"](); body(index); } catch (e) { errors.add(String(e)); }
        } }));
        threads.push(thread);
        thread.start();
      })(t);
    }
    start.countDown();
    threads.forEach(function (thread) { thread.join(60000); });
    return errors;
  }
  function bridgeSlide(map, key) {
    var current = map.get(key);
    if (current === null) return false;
    var lease = JSON.parse(String(current));
    if (!(System.currentTimeMillis() < lease.expiresAt)) return false;
    lease.expiresAt = Math.min(System.currentTimeMillis() + lease.idleMs, lease.maxAt);
    return map.replace(key, current, JSON.stringify(lease));
  }
  var stressServer = newServer(), stress = new ConcurrentHashMap(), stressAt = System.currentTimeMillis();
  stressServer.set(LEASES, stress);
  stress.put(id, leaseText(10 * MINUTE, stressAt + 1000, stressAt + WEEK));
  var refusals = new java.util.concurrent.atomic.AtomicInteger(0);
  var errors = runThreads(9, function (index) {
    for (var n = 0; n < 25; n++) {
      if (index === 8) bridgeSlide(stress, id);
      else if (jwt.validate(leased, http(stressServer).ctx).authenticated !== true) refusals.incrementAndGet();
    }
  });
  var stressed = readLease(stress, id);
  assert(errors.isEmpty() && refusals.get() === 0, "Concurrent slides refused a live lease: " + errors + " / " + refusals.get());
  assert(stressed.expiresAt >= stressAt + 10 * MINUTE && stressed.expiresAt <= System.currentTimeMillis() + 10 * MINUTE &&
      stressed.idleMs === 10 * MINUTE && stressed.maxAt === stressAt + WEEK, "Concurrent slides broke the lease: " + stress.get(id));
  stress.put(id, leaseText(10 * MINUTE, System.currentTimeMillis() + 1000, System.currentTimeMillis() + WEEK));
  errors = runThreads(8, function (index) {
    if (index === 0) { java.lang.Thread.sleep(10); stress.remove(id); return; }
    for (var n = 0; n < 40; n++) {
      jwt.validate(leased, http(stressServer).ctx);
      bridgeSlide(stress, id);
    }
  });
  assert(errors.isEmpty() && !stress.containsKey(id), "A concurrent slide revived a revoked lease: " + errors);
  assert(jwt.validate(leased, http(stressServer).ctx).error.code === "expired_token", "A revoked lease was accepted after concurrent slides");

  // 8. End to end through the public McpServer Flow (mcp.request, mcp.handle, mcp.tools.call) when lib_flow_engine is
  // given as the second argument or sits next to this project. The engine reads the Convertigo context from `context`.
  var engineDir = arguments.length > 1 ? new File(arguments[1]) : new File(new File(projectDir).getAbsoluteFile().getParentFile(), "lib_flow_engine/_flow");
  var endToEnd = "skipped (no lib_flow_engine)";
  if (new File(engineDir, "Engine.js").isFile()) {
    var __flowEngineDir = String(engineDir.getAbsolutePath());
    var __flowProjectDir = String(new File(projectDir).getAbsolutePath());
    var flowEngine = eval(String(FileUtils.readFileToString(new File(engineDir, "Engine.js"), "UTF-8")));
    var serverFlow = String(FileUtils.readFileToString(new File(projectDir, "_flow/flows/McpServer.flow.js"), "UTF-8"));
    var e2eServer = newServer(), e2eLeases = new ConcurrentHashMap();
    e2eServer.set(LEASES, e2eLeases);
    var serve = function (request) {
      var state = http(e2eServer, leased, "codex_cli_rs/0.1");
      context = state.ctx.convertigoContext();
      context.httpServletRequest.getAttribute = function () { return null; };
      try {
        var execution = JSON.parse(flowEngine.run(JSON.stringify({ flowSource: serverFlow, includeTrace: false, input: { request: JSON.stringify(request) } })));
        assert(execution.ok === true, "McpServer crashed: " + JSON.stringify(execution));
        state.response = execution.result;
        return state;
      } finally {
        context = undefined;
      }
    };
    var e2eAt = System.currentTimeMillis();
    e2eLeases.put(id, leaseText(5 * MINUTE, e2eAt + MINUTE, e2eAt + WEEK));
    var liveList = serve({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    assert(liveList.status === 0 && liveList.response.result.tools.length > 0 && readLease(e2eLeases, id).expiresAt >= e2eAt + 5 * MINUTE,
      "End to end: a live leased token did not list the tools and slide its lease");
    e2eLeases.remove(id);
    var expiredInit = serve({ jsonrpc: "2.0", id: 2, method: "initialize", params: {} });
    assert(expiredInit.status === 0 && expiredInit.response.result.serverInfo.name === "convertigo-flow-mcp",
      "End to end: an expired leased token could not open its session: " + JSON.stringify(expiredInit.response));
    var expiredList = serve({ jsonrpc: "2.0", id: 3, method: "tools/list" });
    assert(expiredList.status === 401 && expiredList.response.error.code === -32001 && expiredList.response.error.data.code === "expired_token",
      "End to end: an expired leased token listed the tools: " + JSON.stringify(expiredList.response));
    var expiredTool = serve({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "flow-list", arguments: {} } });
    assert(expiredTool.status === 0 && expiredTool.response.id === 4 && expiredTool.response.result.isError === true &&
        expiredTool.response.result.structuredContent.error.message === expectedText &&
        expiredTool.response.result.content[0].text.indexOf(expectedText) >= 0,
      "End to end: the tools/call of an expired leased token is not the readable tool error: " + JSON.stringify(expiredTool.response));
    assert(!e2eLeases.containsKey(id), "End to end: a revoked lease came back");
    endToEnd = "McpServer end to end";
  }

  print("mcp-jwt-lease OK (" + checks + " checks, " + endToEnd + ")");
} finally {
  if (previous === null) System.clearProperty("flow.mcp.jwt.path");
  else System.setProperty("flow.mcp.jwt.path", previous);
  FileUtils.deleteDirectory(temporary);
}
