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
    new File(projectDir, "_flow/lib/jwt.js"), "UTF-8"));
  var jwt = eval(source);
  var now = Math.floor(System.currentTimeMillis() / 1000);
  var token = jwt._test.buildToken(
    { alg: "HS256", typ: "JWT", kid: "flow_managed_contract" },
    {
      iss: "lib_ConvertigoMCP",
      aud: "ConvertigoMCP",
      sub: "contract-test",
      jti: "contract-test-jti",
      kind: "managed",
      scope: "mcp:full",
      iat: now,
      nbf: now,
      exp: now + 300
    },
    jwt._test.signingKey()
  );
  var valid = jwt.validate(token);
  assertTrue(valid.authenticated === true && valid.kind === "managed",
    "A correctly signed managed Flow MCP token was rejected: " + JSON.stringify(valid));

  // Tamper the first signature character: it carries 6 meaningful bits, while the last one carries
  // only 4 (base64url of a 32-byte HMAC), so changing it can decode to the very same signature.
  var signatureStart = token.lastIndexOf(".") + 1;
  var tampered = token.substring(0, signatureStart) + (token.charAt(signatureStart) === "a" ? "b" : "a")
    + token.substring(signatureStart + 1);
  var rejected = jwt.validate(tampered);
  assertTrue(rejected.authenticated === false && rejected.error.code === "invalid_token_signature",
    "A token with a modified signature was accepted: " + JSON.stringify(rejected));

  // The same decoded signature written differently is refused too: a non-zero unused trailing bit
  // (the last character of a 32-byte HMAC carries only 4 meaningful bits) or padding.
  var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  var lastIndex = alphabet.indexOf(token.charAt(token.length - 1));
  assertTrue(lastIndex % 4 === 0, "The issued signature is not canonical: " + token.substring(signatureStart));
  [token.substring(0, token.length - 1) + alphabet.charAt(lastIndex + 1), token + "="].forEach(function (variant) {
    var refused = jwt.validate(variant);
    assertTrue(refused.authenticated === false && refused.error.code === "invalid_token_signature",
      "A non canonical signature encoding was accepted: " + JSON.stringify(refused));
  });

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
