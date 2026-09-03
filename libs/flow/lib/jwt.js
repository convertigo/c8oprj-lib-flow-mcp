(function () {
	var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
	var Role = Packages.com.twinsoft.convertigo.engine.AuthenticatedSessionManager.Role;
	var SessionKey = Packages.com.twinsoft.convertigo.engine.AuthenticatedSessionManager.SessionKey;
	var File = Packages.java.io.File;
	var Files = Packages.java.nio.file.Files;
	var StandardCharsets = Packages.java.nio.charset.StandardCharsets;
	var StandardOpenOption = Packages.java.nio.file.StandardOpenOption;
	var StandardCopyOption = Packages.java.nio.file.StandardCopyOption;
	var AtomicMoveNotSupportedException = Packages.java.nio.file.AtomicMoveNotSupportedException;
	var Base64 = Packages.java.util.Base64;
	var SecureRandom = Packages.java.security.SecureRandom;
	var MessageDigest = Packages.java.security.MessageDigest;
	var Mac = Packages.javax.crypto.Mac;
	var SecretKeySpec = Packages.javax.crypto.spec.SecretKeySpec;
	var UUID = Packages.java.util.UUID;
	var SimpleDateFormat = Packages.java.text.SimpleDateFormat;
	var TimeZone = Packages.java.util.TimeZone;

	var ISSUER = "lib_ConvertigoMCP";
	var AUDIENCE = "ConvertigoMCP";
	var TOKEN_ENVIRONMENT_VARIABLE = "CONVERTIGO_MCP_TOKEN";
	var DEFAULT_DURABLE_DAYS = 365;
	var MAX_DURABLE_DAYS = 3650;
	var DEFAULT_MANAGED_SECONDS = 7200;
	var MIN_MANAGED_SECONDS = 300;
	var MAX_MANAGED_SECONDS = 86400;
	var LAST_USED_WRITE_INTERVAL_MS = 300000;
	var ADMIN_TOOL_NAMES = {
		"flow-token-status": true,
		"flow-token-create": true,
		"flow-token-list": true,
		"flow-token-revoke": true,
		"flow-token-managed-create": true
	};

	function trim(value) {
		return value === null || value === undefined ? "" : String(value).replace(/^\s+|\s+$/g, "");
	}

	function bytes(value) {
		return new java.lang.String(String(value)).getBytes(StandardCharsets.UTF_8);
	}

	function base64UrlBytes(value) {
		return String(Base64.getUrlEncoder().withoutPadding().encodeToString(value));
	}

	function base64Url(value) {
		return base64UrlBytes(bytes(value));
	}

	function decodeBase64Url(value) {
		return String(new java.lang.String(Base64.getUrlDecoder().decode(String(value)), StandardCharsets.UTF_8));
	}

	function randomBase64Url(size) {
		var random = new SecureRandom();
		var data = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, size);
		random.nextBytes(data);
		return base64UrlBytes(data);
	}

	function sign(data, secret) {
		var mac = Mac.getInstance("HmacSHA256");
		mac.init(new SecretKeySpec(bytes(secret), "HmacSHA256"));
		return base64UrlBytes(mac.doFinal(bytes(data)));
	}

	function signaturesEqual(actual, expected) {
		try {
			return MessageDigest.isEqual(
				Base64.getUrlDecoder().decode(String(actual)),
				Base64.getUrlDecoder().decode(String(expected))
			);
		} catch (_invalidSignatureEncoding) {
			return false;
		}
	}

	function sha256(value) {
		return base64UrlBytes(MessageDigest.getInstance("SHA-256").digest(bytes(value)));
	}

	function isoDate(ms) {
		var format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
		format.setTimeZone(TimeZone.getTimeZone("UTC"));
		return String(format.format(new java.util.Date(ms)));
	}

	function parseIsoDate(value) {
		var text = trim(value);
		if (!text.length) {
			return 0;
		}
		try {
			return Number(java.time.Instant.parse(text).toEpochMilli());
		} catch (_invalidDate) {
			return 0;
		}
	}

	function rootDirectory() {
		var override = trim(Packages.java.lang.System.getProperty("convertigo.mcp.jwt.path")) ||
			trim(Packages.java.lang.System.getProperty("flow.mcp.jwt.path"));
		return override.length
			? new File(override)
			: new File(new File(String(Engine.USER_WORKSPACE_PATH), "jwt"), "mcp");
	}

	function legacyRootDirectory() {
		var override = trim(Packages.java.lang.System.getProperty("convertigo.mcp.jwt.path")) ||
			trim(Packages.java.lang.System.getProperty("flow.mcp.jwt.path"));
		return override.length ? rootDirectory() : new File(String(Engine.USER_WORKSPACE_PATH), "mcp");
	}

	function keysDirectory(root) {
		return new File(root || rootDirectory(), "keys");
	}

	function activeDirectory(root) {
		return new File(new File(root || rootDirectory(), "tokens"), "active");
	}

	function revokedDirectory(root) {
		return new File(new File(root || rootDirectory(), "tokens"), "revoked");
	}

	function tokenRoots() {
		var canonical = rootDirectory();
		var legacy = legacyRootDirectory();
		return String(canonical.getAbsolutePath()) === String(legacy.getAbsolutePath())
			? [canonical]
			: [canonical, legacy];
	}

	function ensureDirectory(directory) {
		if (!directory.isDirectory() && !directory.mkdirs() && !directory.isDirectory()) {
			throw new Error("Unable to create Flow MCP JWT directory: " + directory.getAbsolutePath());
		}
		return directory;
	}

	function protectFile(file) {
		try {
			file.setReadable(false, false);
			file.setWritable(false, false);
			file.setExecutable(false, false);
			file.setReadable(true, true);
			file.setWritable(true, true);
		} catch (_permissionsUnsupported) {}
	}

	function readText(file) {
		return String(new java.lang.String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8));
	}

	function writeCreateOnly(file, content) {
		ensureDirectory(file.getParentFile());
		Files.write(file.toPath(), bytes(content), StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
		protectFile(file);
	}

	function atomicWrite(file, content) {
		ensureDirectory(file.getParentFile());
		var temporary = new File(file.getParentFile(), file.getName() + ".tmp-" + String(UUID.randomUUID()));
		try {
			writeCreateOnly(temporary, content);
			try {
				Files.move(temporary.toPath(), file.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
			} catch (moveError) {
				var unsupported = moveError instanceof AtomicMoveNotSupportedException;
				if (!unsupported) {
					try {
						unsupported = String(moveError.getClass().getName()).indexOf("AtomicMoveNotSupportedException") !== -1;
					} catch (_ignoreMoveClass) {}
				}
				if (!unsupported) {
					throw moveError;
				}
				Files.move(temporary.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING);
			}
			protectFile(file);
		} finally {
			try {
				if (temporary.exists()) {
					temporary.delete();
				}
			} catch (_ignoreTemporaryDelete) {}
		}
	}

	function signingKeyFile() {
		return new File(keysDirectory(), "signing-current.key");
	}

	function signingKey() {
		var file = signingKeyFile();
		if (file.isFile()) {
			var existing = trim(readText(file));
			if (existing.length >= 32) {
				return existing;
			}
			throw new Error("The Flow MCP signing key is invalid.");
		}
		ensureDirectory(keysDirectory());
		var candidate = "";
		var legacyFile = new File(keysDirectory(legacyRootDirectory()), "signing-current.key");
		if (legacyFile.isFile()) {
			candidate = trim(readText(legacyFile));
			if (candidate.length < 32) {
				throw new Error("The legacy MCP signing key is invalid.");
			}
		} else {
			candidate = randomBase64Url(64);
		}
		try {
			writeCreateOnly(file, candidate + "\n");
			return candidate;
		} catch (createError) {
			if (file.isFile()) {
				var raced = trim(readText(file));
				if (raced.length >= 32) {
					return raced;
				}
			}
			throw createError;
		}
	}

	function safeIdentifier(value) {
		var text = trim(value);
		return /^[A-Za-z0-9_-]{8,160}$/.test(text) ? text : "";
	}

	function tokenFile(directory, tokenId) {
		var safe = safeIdentifier(tokenId);
		if (!safe.length) {
			throw new Error("Invalid Flow MCP token identifier.");
		}
		return new File(directory, safe + ".json");
	}

	function parseJsonFile(file) {
		return JSON.parse(readText(file));
	}

	function publicRecord(record) {
		record = record || {};
		var revoked = trim(record.revokedAt).length > 0;
		var expiration = parseIsoDate(record.expiresAt);
		return {
			id: trim(record.id),
			name: trim(record.name),
			kind: trim(record.kind) || "durable",
			scope: trim(record.scope) || "mcp:full",
			createdAt: trim(record.createdAt),
			expiresAt: trim(record.expiresAt),
			lastUsedAt: trim(record.lastUsedAt),
			revokedAt: trim(record.revokedAt),
			createdBy: trim(record.createdBy),
			status: revoked ? "revoked" : (expiration > 0 && java.lang.System.currentTimeMillis() >= expiration ? "expired" : "active")
		};
	}

	function convertigoContext(ctx) {
		try {
			if (ctx && typeof ctx.convertigoContext === "function") {
				return ctx.convertigoContext();
			}
		} catch (_contextUnavailable) {}
		return ctx || null;
	}

	function currentAdminUser(ctx) {
		var contextObject = convertigoContext(ctx);
		var user = "";
		try {
			user = trim(contextObject.getAuthenticatedUser());
		} catch (_ignoreAuthenticatedUser) {}
		if (!user.length) {
			try {
				var request = contextObject.httpServletRequest;
				var session = request === null ? null : request.getSession(false);
				var value = session === null ? null : session.getAttribute(SessionKey.ADMIN_USER.toString());
				user = trim(value);
			} catch (_ignoreAdminUser) {}
		}
		return user.length ? user : "studio-admin";
	}

	function isWebAdmin(ctx) {
		try {
			var contextObject = convertigoContext(ctx);
			var request = contextObject && contextObject.httpServletRequest;
			var session = request === null ? null : request.getSession(false);
			return session !== null && Engine.authenticatedSessionManager.hasRole(session, Role.WEB_ADMIN);
		} catch (_notAdmin) {
			return false;
		}
	}

	function requireWebAdmin(ctx) {
		if (!isWebAdmin(ctx)) {
			var error = new Error("A WEB_ADMIN session is required.");
			error.code = "forbidden";
			throw error;
		}
	}

	function endpointUrl(ctx) {
		try {
			var contextObject = convertigoContext(ctx);
			var base = trim(contextObject.getConvertigoUrl()).replace(/\/+$/g, "");
			if (base.length) {
				return base + "/api/flow-mcp";
			}
		} catch (_ignoreConvertigoUrl) {}
		return "http://localhost:18080/convertigo/api/flow-mcp";
	}

	function buildToken(header, payload, secret) {
		var signingInput = base64Url(JSON.stringify(header)) + "." + base64Url(JSON.stringify(payload));
		return signingInput + "." + sign(signingInput, secret);
	}

	function resultError(code, message) {
		return {
			status: "error",
			error: {
				code: String(code || "flow_mcp_token_error"),
				message: String(message || "Flow MCP token operation failed.")
			}
		};
	}

	function tokenLabel(value, fallback) {
		var label = trim(value) || fallback;
		return label.length > 100 ? label.substring(0, 100) : label;
	}

	function boundedInteger(value, fallback, minimum, maximum) {
		var parsed = parseInt(trim(value), 10);
		if (isNaN(parsed)) {
			parsed = fallback;
		}
		return Math.max(minimum, Math.min(maximum, parsed));
	}

	function createDurable(ctx, name, expiresInDays) {
		try {
			requireWebAdmin(ctx);
			var label = tokenLabel(name, "");
			if (!label.length) {
				return resultError("missing_token_name", "A token label is required.");
			}
			var days = boundedInteger(expiresInDays, DEFAULT_DURABLE_DAYS, 1, MAX_DURABLE_DAYS);
			var nowMs = java.lang.System.currentTimeMillis();
			var nowSeconds = Math.floor(nowMs / 1000);
			var expiresSeconds = nowSeconds + days * 86400;
			var tokenId = "mcp_" + String(UUID.randomUUID()).replace(/-/g, "");
			var jti = String(UUID.randomUUID());
			var record = {
				id: tokenId,
				name: label,
				kind: "durable",
				scope: "mcp:full",
				jtiHash: sha256(jti),
				createdAt: isoDate(nowMs),
				expiresAt: isoDate(expiresSeconds * 1000),
				lastUsedAt: "",
				revokedAt: "",
				createdBy: currentAdminUser(ctx)
			};
			writeCreateOnly(tokenFile(ensureDirectory(activeDirectory()), tokenId), JSON.stringify(record, null, 2) + "\n");
			var token = buildToken(
				{ alg: "HS256", typ: "JWT", kid: tokenId },
				{
					iss: ISSUER,
					aud: AUDIENCE,
					sub: record.createdBy,
					jti: jti,
					kind: "durable",
					scope: "mcp:full",
					iat: nowSeconds,
					nbf: nowSeconds,
					exp: expiresSeconds
				},
				signingKey()
			);
			return {
				status: "ok",
				token: token,
				tokenInfo: publicRecord(record),
				tokens: listRecords(),
				mcpUrl: endpointUrl(ctx),
				tokenEnvironmentVariable: TOKEN_ENVIRONMENT_VARIABLE,
				instructions: "Copy this token now. It will not be shown again."
			};
		} catch (error) {
			return resultError(error.code || "token_creation_failed", String(error.message || error));
		}
	}

	function createManaged(ctx, label, ttlSeconds) {
		try {
			requireWebAdmin(ctx);
			var lifetime = boundedInteger(ttlSeconds, DEFAULT_MANAGED_SECONDS, MIN_MANAGED_SECONDS, MAX_MANAGED_SECONDS);
			var nowSeconds = Math.floor(java.lang.System.currentTimeMillis() / 1000);
			var tokenId = "managed_" + String(UUID.randomUUID()).replace(/-/g, "");
			var name = tokenLabel(label, "Convertigo Assistant");
			var token = buildToken(
				{ alg: "HS256", typ: "JWT", kid: tokenId },
				{
					iss: ISSUER,
					aud: AUDIENCE,
					sub: currentAdminUser(ctx),
					jti: String(UUID.randomUUID()),
					kind: "managed",
					label: name,
					scope: "mcp:full",
					iat: nowSeconds,
					nbf: nowSeconds,
					exp: nowSeconds + lifetime
				},
				signingKey()
			);
			return {
				status: "ok",
				token: token,
				tokenInfo: {
					id: tokenId,
					name: name,
					kind: "managed",
					scope: "mcp:full",
					createdAt: isoDate(nowSeconds * 1000),
					expiresAt: isoDate((nowSeconds + lifetime) * 1000),
					status: "active"
				},
				mcpUrl: endpointUrl(ctx),
				tokenEnvironmentVariable: TOKEN_ENVIRONMENT_VARIABLE
			};
		} catch (error) {
			return resultError(error.code || "managed_token_creation_failed", String(error.message || error));
		}
	}

	function filesIn(directory) {
		if (!directory.isDirectory()) {
			return [];
		}
		var files = directory.listFiles();
		var result = [];
		if (files !== null) {
			for (var i = 0; i < files.length; i++) {
				if (files[i].isFile() && /\.json$/.test(String(files[i].getName()))) {
					result.push(files[i]);
				}
			}
		}
		return result;
	}

	function listRecords() {
		var byId = {};
		var roots = tokenRoots();
		var directories = [];
		for (var rootIndex = 0; rootIndex < roots.length; rootIndex++) {
			directories.push(activeDirectory(roots[rootIndex]));
			directories.push(revokedDirectory(roots[rootIndex]));
		}
		for (var d = 0; d < directories.length; d++) {
			var files = filesIn(directories[d]);
			for (var i = 0; i < files.length; i++) {
				try {
					var record = parseJsonFile(files[i]);
					if (d % 2 === 1 && !trim(record.revokedAt).length) {
						record.revokedAt = isoDate(files[i].lastModified());
					}
					var item = publicRecord(record);
					if (item.id.length && (!byId[item.id] || d % 2 === 1)) {
						byId[item.id] = item;
					}
				} catch (_invalidRecord) {}
			}
		}
		var result = [];
		for (var id in byId) {
			if (Object.prototype.hasOwnProperty.call(byId, id)) {
				result.push(byId[id]);
			}
		}
		result.sort(function (left, right) {
			return String(right.createdAt).localeCompare(String(left.createdAt));
		});
		return result;
	}

	function adminStatus(ctx) {
		var authorized = isWebAdmin(ctx);
		return {
			status: authorized ? "ok" : "forbidden",
			authorized: authorized,
			storagePath: authorized ? String(rootDirectory().getAbsolutePath()) : "",
			mcpUrl: endpointUrl(ctx),
			tokenEnvironmentVariable: TOKEN_ENVIRONMENT_VARIABLE,
			tokens: authorized ? listRecords() : [],
			error: authorized ? null : { code: "forbidden", message: "A WEB_ADMIN session is required." }
		};
	}

	function list(ctx) {
		try {
			requireWebAdmin(ctx);
			return {
				status: "ok",
				mcpUrl: endpointUrl(ctx),
				tokenEnvironmentVariable: TOKEN_ENVIRONMENT_VARIABLE,
				tokens: listRecords()
			};
		} catch (error) {
			return resultError(error.code || "token_list_failed", String(error.message || error));
		}
	}

	function revoke(ctx, tokenId) {
		try {
			requireWebAdmin(ctx);
			var roots = tokenRoots();
			var active = null;
			var revokedExisting = null;
			for (var rootIndex = 0; rootIndex < roots.length; rootIndex++) {
				var activeCandidate = tokenFile(activeDirectory(roots[rootIndex]), tokenId);
				var revokedCandidate = tokenFile(revokedDirectory(roots[rootIndex]), tokenId);
				if (active === null && activeCandidate.isFile()) {
					active = activeCandidate;
				}
				if (revokedExisting === null && revokedCandidate.isFile()) {
					revokedExisting = revokedCandidate;
				}
			}
			if (active === null) {
				if (revokedExisting !== null) {
					return { status: "ok", tokenInfo: publicRecord(parseJsonFile(revokedExisting)), tokens: listRecords() };
				}
				return resultError("token_not_found", "Flow MCP token was not found.");
			}
			var record = parseJsonFile(active);
			record.revokedAt = trim(record.revokedAt) || isoDate(java.lang.System.currentTimeMillis());
			var revoked = tokenFile(ensureDirectory(revokedDirectory()), tokenId);
			atomicWrite(revoked, JSON.stringify(record, null, 2) + "\n");
			if (!active.delete() && active.exists()) {
				throw new Error("Unable to remove the active Flow MCP token record after revocation.");
			}
			return { status: "ok", tokenInfo: publicRecord(record), tokens: listRecords() };
		} catch (error) {
			return resultError(error.code || "token_revoke_failed", String(error.message || error));
		}
	}

	function invalid(code, message) {
		return {
			status: "error",
			authenticated: false,
			error: {
				code: String(code || "invalid_token"),
				message: String(message || "Flow MCP token is invalid.")
			}
		};
	}

	function updateLastUsed(file, record, nowMs) {
		var previous = parseIsoDate(record.lastUsedAt);
		if (previous > 0 && nowMs - previous < LAST_USED_WRITE_INTERVAL_MS) {
			return;
		}
		record.lastUsedAt = isoDate(nowMs);
		try {
			atomicWrite(file, JSON.stringify(record, null, 2) + "\n");
		} catch (_ignoreLastUsedWrite) {}
	}

	function validate(token) {
		var raw = trim(token);
		if (!raw.length) {
			return invalid("missing_token", "A Flow MCP bearer token is required.");
		}
		var parts = raw.split(".");
		if (parts.length !== 3) {
			return invalid("invalid_token_format", "The Flow MCP bearer token is malformed.");
		}
		var header;
		var payload;
		try {
			header = JSON.parse(decodeBase64Url(parts[0]));
			payload = JSON.parse(decodeBase64Url(parts[1]));
		} catch (_decodeError) {
			return invalid("invalid_token_encoding", "The Flow MCP bearer token cannot be decoded.");
		}
		if (String(header.alg || "") !== "HS256" || String(header.typ || "JWT").toUpperCase() !== "JWT") {
			return invalid("unsupported_token", "The Flow MCP bearer token must be an HS256 JWT.");
		}
		if (String(payload.iss || "") !== ISSUER || String(payload.aud || "") !== AUDIENCE) {
			return invalid("invalid_token_claims", "The Flow MCP bearer token issuer or audience is invalid.");
		}
		var nowSeconds = Math.floor(java.lang.System.currentTimeMillis() / 1000);
		if (payload.exp !== null && payload.exp !== undefined && nowSeconds >= Number(payload.exp)) {
			return invalid("expired_token", "The Flow MCP bearer token has expired.");
		}
		if (payload.nbf !== null && payload.nbf !== undefined && nowSeconds < Number(payload.nbf)) {
			return invalid("token_not_yet_valid", "The Flow MCP bearer token is not valid yet.");
		}
		var signingInput = parts[0] + "." + parts[1];
		var expected;
		try {
			expected = sign(signingInput, signingKey());
		} catch (keyError) {
			return invalid("signing_key_unavailable", String(keyError.message || keyError));
		}
		if (!signaturesEqual(parts[2], expected)) {
			return invalid("invalid_token_signature", "The Flow MCP bearer token signature is invalid.");
		}
		var kind = trim(payload.kind) || "durable";
		if (kind === "managed") {
			return {
				status: "ok",
				authenticated: true,
				kind: "managed",
				scope: trim(payload.scope) || "mcp:full",
				user: trim(payload.sub),
				payload: payload
			};
		}
		if (kind !== "durable") {
			return invalid("invalid_token_kind", "The Flow MCP bearer token kind is invalid.");
		}
		var tokenId = safeIdentifier(header.kid);
		var jti = trim(payload.jti);
		if (!tokenId.length || !jti.length) {
			return invalid("missing_token_identifier", "The Flow MCP bearer token identifier is missing.");
		}
		var file = null;
		try {
			var roots = tokenRoots();
			for (var rootIndex = 0; rootIndex < roots.length; rootIndex++) {
				if (tokenFile(revokedDirectory(roots[rootIndex]), tokenId).isFile()) {
					return invalid("revoked_token", "The Flow MCP bearer token has been revoked.");
				}
				var candidate = tokenFile(activeDirectory(roots[rootIndex]), tokenId);
				if (file === null && candidate.isFile()) {
					file = candidate;
				}
			}
		} catch (identifierError) {
			return invalid("invalid_token_identifier", String(identifierError.message || identifierError));
		}
		if (file === null) {
			return invalid("revoked_or_unknown_token", "The Flow MCP bearer token is revoked or unknown.");
		}
		try {
			var record = parseJsonFile(file);
			if (trim(record.id) !== tokenId || trim(record.jtiHash) !== sha256(jti)) {
				return invalid("invalid_token_record", "The Flow MCP bearer token does not match its active record.");
			}
			if (trim(record.revokedAt).length) {
				return invalid("revoked_token", "The Flow MCP bearer token has been revoked.");
			}
			var recordExpiration = parseIsoDate(record.expiresAt);
			if (recordExpiration > 0 && java.lang.System.currentTimeMillis() >= recordExpiration) {
				return invalid("expired_token", "The Flow MCP bearer token has expired.");
			}
			updateLastUsed(file, record, java.lang.System.currentTimeMillis());
			return {
				status: "ok",
				authenticated: true,
				kind: "durable",
				scope: trim(record.scope) || "mcp:full",
				user: trim(record.createdBy),
				tokenId: tokenId,
				payload: payload
			};
		} catch (recordError) {
			return invalid("invalid_token_record", String(recordError.message || recordError));
		}
	}

	function bearerToken(ctx) {
		try {
			var contextObject = convertigoContext(ctx);
			var request = contextObject && contextObject.httpServletRequest;
			var authorization = request === null ? null : request.getHeader("Authorization");
			var match = /^\s*Bearer\s+(.+?)\s*$/i.exec(String(authorization || ""));
			return match ? trim(match[1]) : "";
		} catch (_missingRequest) {
			return "";
		}
	}

	function toolName(request) {
		return trim(request && request.method === "tools/call" && request.params && request.params.name);
	}

	function isAdminToolRequest(request) {
		return ADMIN_TOOL_NAMES[toolName(request)] === true;
	}

	function authenticateRequest(ctx, request) {
		var contextObject = convertigoContext(ctx);
		if (!contextObject || !contextObject.httpServletRequest) {
			return { status: "ok", authenticated: true, kind: "internal", scope: "mcp:internal", user: "internal" };
		}
		if (isAdminToolRequest(request) && isWebAdmin(ctx)) {
			return { status: "ok", authenticated: true, kind: "web-admin", scope: "mcp:tokens", user: currentAdminUser(ctx) };
		}
		return validate(bearerToken(ctx));
	}

	function applyUnauthorizedResponse(ctx) {
		try {
			var contextObject = convertigoContext(ctx);
			var response = contextObject && contextObject.httpServletResponse;
			if (response !== null) {
				response.setStatus(401);
				response.setHeader("WWW-Authenticate", "Bearer realm=\"Convertigo Flow MCP\"");
			}
		} catch (_ignoreResponseStatus) {}
	}

	function guardRequest(ctx, request) {
		var authentication = authenticateRequest(ctx, request);
		if (authentication && authentication.authenticated === true) {
			return request;
		}
		applyUnauthorizedResponse(ctx);
		var error = authentication && authentication.error ? authentication.error : {};
		return {
			jsonrpc: "2.0",
			id: request && request.id !== undefined ? request.id : null,
			__flowMcpAuthenticationError: {
				code: String(error.code || "unauthorized"),
				message: String(error.message || "Flow MCP bearer authentication is required.")
			}
		};
	}

	function adminResponse(request, value) {
		return {
			jsonrpc: "2.0",
			id: request && request.id !== undefined ? request.id : null,
			result: {
				content: [{ type: "text", text: value && value.status === "ok" ? "OK" : "Flow MCP token operation failed." }],
				structuredContent: value
			}
		};
	}

	return {
		adminResponse: adminResponse,
		adminStatus: adminStatus,
		createDurable: createDurable,
		createManaged: createManaged,
		guardRequest: guardRequest,
		isWebAdmin: isWebAdmin,
		list: list,
		revoke: revoke,
		validate: validate,
		_test: {
			buildToken: buildToken,
			rootDirectory: rootDirectory,
			signingKey: signingKey
		}
	};
}())
