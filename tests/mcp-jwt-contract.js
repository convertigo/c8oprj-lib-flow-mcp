var projectDir = arguments.length > 0 ? arguments[0] : ".";
var File = Packages.java.io.File;
var Files = Packages.java.nio.file.Files;
var StandardCharsets = Packages.java.nio.charset.StandardCharsets;
var System = Packages.java.lang.System;
var temporary = Files.createTempDirectory("flow-mcp-jwt-contract-").toFile();
System.setProperty("flow.mcp.jwt.path", String(temporary.getAbsolutePath()));

function assertTrue(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  var source = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
    new File(projectDir, "libs/flow/lib/jwt.js"), "UTF-8"));
  var jwt = eval(source);
  var now = Math.floor(System.currentTimeMillis() / 1000);
  var token = jwt._test.buildToken(
    { alg: "HS256", typ: "JWT", kid: "flow_managed_contract" },
    {
      iss: "lib_flow_mcp",
      aud: "ConvertigoFlowMCP",
      sub: "contract-test",
      jti: "contract-test-jti",
      kind: "managed",
      scope: "flow:mcp:full",
      iat: now,
      nbf: now,
      exp: now + 300
    },
    jwt._test.signingKey()
  );
  var valid = jwt.validate(token);
  assertTrue(valid.authenticated === true && valid.kind === "managed",
    "A correctly signed managed Flow MCP token was rejected: " + JSON.stringify(valid));

  var tampered = token.substring(0, token.length - 1) + (token.charAt(token.length - 1) === "a" ? "b" : "a");
  var rejected = jwt.validate(tampered);
  assertTrue(rejected.authenticated === false && rejected.error.code === "invalid_token_signature",
    "A token with a modified signature was accepted: " + JSON.stringify(rejected));

  var missing = jwt.validate("");
  assertTrue(missing.authenticated === false && missing.error.code === "missing_token",
    "A missing Flow MCP bearer token was not rejected");

  var statusCode = 0;
  var challenge = "";
  var guarded = jwt.guardRequest({
    convertigoContext: function () {
      return {
        httpServletRequest: {
          getHeader: function () { return null; },
          getSession: function () { return null; }
        },
        httpServletResponse: {
          setStatus: function (value) { statusCode = Number(value); },
          setHeader: function (_name, value) { challenge = String(value); }
        }
      };
    }
  }, { jsonrpc: "2.0", id: 7, method: "initialize" });
  assertTrue(statusCode === 401 && challenge.indexOf("Bearer") === 0 &&
      guarded.__flowMcpAuthenticationError.code === "missing_token",
    "An unauthenticated HTTP MCP request did not produce the bearer challenge");

  var internal = { jsonrpc: "2.0", id: 8, method: "initialize" };
  assertTrue(jwt.guardRequest({ convertigoContext: function () { return {}; } }, internal) === internal,
    "A trusted internal Flow invocation was unexpectedly rejected");

  assertTrue(String(jwt._test.rootDirectory().getAbsolutePath()) === String(temporary.getAbsolutePath()),
    "The Flow MCP JWT store did not honor its isolated contract path");
  assertTrue(new File(temporary, "keys/signing-current.key").isFile(),
    "The Flow MCP signing key was not persisted");

  print(JSON.stringify({ ok: true, kind: valid.kind, scope: valid.scope }));
} finally {
  System.clearProperty("flow.mcp.jwt.path");
  Packages.org.apache.commons.io.FileUtils.deleteDirectory(temporary);
}
