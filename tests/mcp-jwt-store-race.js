// Deterministic interleavings and read failures against a real, disposable JWT store.
// No existing token store, token or license is read; all credential material is deleted in finally.
var File = java.io.File, RealFiles = java.nio.file.Files, UTF8 = java.nio.charset.StandardCharsets.UTF_8;
var temporary = RealFiles.createTempDirectory('mcp-jwt-store-race-').toFile();
var previous = java.lang.System.getProperty('convertigo.mcp.jwt.path');
java.lang.System.setProperty('convertigo.mcp.jwt.path', String(temporary));
var checks = 0, failedPath = '', failures = 0, reads = 0, liveProtection = 0, interleavings = 0;
var nonPosix = false, revokeOnFailure = false, revoked;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
function bytes(text) { return new java.lang.String(text).getBytes(UTF8); }
var jwt, token, active;
var fixtureFiles = {
  readAllBytes: function (path) {
    if (String(path) === failedPath) {
      reads++;
      if (failures-- > 0) {
        if (revokeOnFailure) RealFiles.write(revoked.toPath(), bytes('{}'));
        throw new java.io.IOException('private-path-marker');
      }
    }
    return RealFiles.readAllBytes(path);
  },
  write: function (path, data, first, second) { return RealFiles.write(path, data, first, second); },
  setPosixFilePermissions: function (path, permissions) {
    if (nonPosix) throw new java.lang.UnsupportedOperationException('fixture');
    return RealFiles.setPosixFilePermissions(path, permissions);
  },
  move: function (from, to, first, second) {
    var result = RealFiles.move(from, to, first, second);
    if (active && String(to) === String(active.toPath())) {
      interleavings++;
      assert(jwt.validate(token).authenticated === true, 'Reader after atomic replacement refused a valid token');
    }
    return result;
  }
};
// Observe the actual permission function, including its non-POSIX fallback.
function fixtureProtect(file) {
  if (active && String(file.toPath()) === String(active.toPath())) liveProtection++;
}
try {
  var sourceFile = arguments[1] ? new File(arguments[1]) : new File(arguments[0], '_flow/lib/jwt.js');
  var source = String(Packages.org.apache.commons.io.FileUtils.readFileToString(sourceFile, 'UTF-8'));
  source = source.replace('var Files = Packages.java.nio.file.Files;', 'var Files = fixtureFiles;')
    .replace('function protectFile(file) {', 'function protectFile(file) { fixtureProtect(file);');
  jwt = eval(source);
  var now = Math.floor(java.lang.System.currentTimeMillis() / 1000), id = 'fixture_durable', jti = 'fixture-jti';
  token = jwt._test.buildToken({ alg: 'HS256', typ: 'JWT', kid: id },
    { iss: 'lib_ConvertigoMCP', aud: 'ConvertigoMCP', kind: 'durable', sub: 'fixture', jti: jti, nbf: now, exp: now + 300 }, jwt._test.signingKey());
  active = new File(temporary, 'tokens/active/' + id + '.json');
  active.getParentFile().mkdirs();
  var record = { id: id, jtiHash: String(java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(java.security.MessageDigest.getInstance('SHA-256').digest(bytes(jti)))),
    createdBy: 'fixture', lastUsedAt: '', expiresAt: new Date((now + 300) * 1000).toISOString() };
  function writeRecord(value) { RealFiles.write(active.toPath(), bytes(JSON.stringify(value))); }
  writeRecord(record);
  assert(jwt.validate(token).authenticated === true, 'Initial durable validation failed');
  assert(interleavings === 1 && liveProtection === 0, 'Live token permissions were changed after replacement');
  assert(String(RealFiles.getPosixFilePermissions(active.toPath())) === '[OWNER_READ, OWNER_WRITE]' ||
    RealFiles.getPosixFilePermissions(active.toPath()).equals(java.nio.file.attribute.PosixFilePermissions.fromString('rw-------')), 'Replaced token must keep owner-only permissions');
  nonPosix = true; writeRecord(record);
  assert(jwt.validate(token).authenticated === true && liveProtection === 0 && interleavings === 2, 'Fallback permissions touched the live record');
  nonPosix = false;
  failedPath = String(active.toPath()); failures = 2; reads = 0;
  assert(jwt.validate(token).authenticated === true && reads === 3, 'Transient record read failures should recover');
  failures = 10; reads = 0;
  var status = 0, headers = {}, attributes = {};
  var guarded = jwt.guardRequest({ convertigoContext: function () { return {
    httpServletRequest: { getHeader: function (name) { return name === 'Authorization' ? 'Bearer ' + token : null; }, setAttribute: function (name, value) { attributes[name] = value; } },
    httpServletResponse: { setStatus: function (value) { status = Number(value); }, setHeader: function (name, value) { headers[name] = String(value); } }
  }; } }, { jsonrpc: '2.0', id: 1, method: 'initialize' });
  assert(reads === 4 && status === 503 && headers['Retry-After'] === '1' && !headers['WWW-Authenticate'], 'Persistent I/O failure must be a bounded retryable 503');
  assert(guarded.__flowMcpAuthenticationError.code === 'token_store_unreadable' && Object.keys(attributes).length === 0, 'Unavailable store granted a principal');
  assert(JSON.stringify(guarded).indexOf('private-path-marker') < 0, 'Filesystem details leaked through authentication');
  failedPath = String(new File(temporary, 'keys/signing-current.key').toPath()); failures = 1; reads = 0;
  assert(jwt.validate(token).authenticated === true && reads === 2, 'Transient signing-key read failure should recover');
  failures = 10; reads = 0;
  var unavailable = jwt.validate(token);
  assert(!unavailable.authenticated && unavailable.retryable && reads === 4, 'Unreadable signing key must fail closed and remain retryable');
  failures = 1; reads = 0;
  java.lang.Thread.currentThread().interrupt();
  var interrupted = jwt.validate(token);
  assert(!interrupted.authenticated && interrupted.retryable && reads === 1 && java.lang.Thread.currentThread().isInterrupted(), 'Interrupted retries must preserve the interrupt and fail closed');
  java.lang.Thread.interrupted();
  revoked = new File(temporary, 'tokens/revoked/' + id + '.json'); revoked.getParentFile().mkdirs();
  failedPath = String(active.toPath()); failures = 1; reads = 0; revokeOnFailure = true;
  assert(jwt.validate(token).error.code === 'revoked_token' && reads === 1, 'Retry ignored a concurrent revocation');
  revokeOnFailure = false; revoked.delete();
  failedPath = String(active.toPath()); failures = 0; reads = 0;
  RealFiles.write(active.toPath(), bytes('{'));
  var corrupt = jwt.validate(token);
  assert(!corrupt.authenticated && corrupt.error.code === 'invalid_token_record' && !corrupt.retryable && reads === 1, 'Corrupt records are credential refusals, not transient I/O');
  record.jtiHash = 'wrong'; writeRecord(record);
  assert(jwt.validate(token).error.code === 'invalid_token_record', 'Mismatched record was accepted');
  active.delete();
  assert(jwt.validate(token).error.code === 'revoked_or_unknown_token', 'Unknown record was accepted');
  RealFiles.write(revoked.toPath(), bytes('{}')); writeRecord(record);
  assert(jwt.validate(token).error.code === 'revoked_token', 'Revocation must take precedence over an active record');
  print('mcp-jwt-store-race OK (' + checks + ' checks)');
} finally {
  java.lang.Thread.interrupted();
  if (previous === null) java.lang.System.clearProperty('convertigo.mcp.jwt.path');
  else java.lang.System.setProperty('convertigo.mcp.jwt.path', previous);
  Packages.org.apache.commons.io.FileUtils.deleteDirectory(temporary);
}
