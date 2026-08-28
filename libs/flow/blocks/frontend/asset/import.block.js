const _meta = {
  "version": 1,
  "description": "Imports one local image into the target project's resources directory and returns its canonical resources/... URL.",
  "properties": {
    "project": {
      "kind": "text",
      "type": "string",
      "description": "Target Convertigo project name."
    },
    "projectDir": {
      "kind": "text",
      "type": "string",
      "description": "Resolved target project directory."
    },
    "sourceFile": {
      "kind": "text",
      "type": "string",
      "description": "Absolute path of the local image to import."
    },
    "assetPath": {
      "kind": "text",
      "type": "string",
      "description": "Optional destination under resources/. Defaults to resources/<source filename>."
    },
    "overwrite": {
      "kind": "literal",
      "type": "boolean",
      "default": true,
      "description": "Replace an existing asset. Defaults to true for iterative frontend authoring."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "description": "Scope path receiving the import result."
    }
  },
  "outputs": {
    "out": { "type": "object" }
  },
  "private": true,
  "runtime": "rhino"
}

(function () {
	var MAX_BYTES = 20 * 1024 * 1024;
	var MIME_TYPES = {
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		gif: "image/gif",
		webp: "image/webp",
		svg: "image/svg+xml",
		avif: "image/avif"
	};

	function cleanAssetPath(value, fallback) {
		var path = String(value || fallback || "").replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/{2,}/g, "/");
		if (path.indexOf("resources/") !== 0 || path === "resources/" || path.indexOf("\0") !== -1) {
			throw new Error("assetPath must be a file below resources/, for example resources/hero.png.");
		}
		if (path.split("/").some(function (segment) { return segment === "." || segment === ".."; })) {
			throw new Error("assetPath cannot contain . or .. path segments.");
		}
		return path;
	}

	function sha256(path) {
		var Files = Packages.java.nio.file.Files;
		var MessageDigest = Packages.java.security.MessageDigest;
		var digest = MessageDigest.getInstance("SHA-256");
		var stream = Files.newInputStream(path);
		try {
			var buffer = Packages.java.lang.reflect.Array.newInstance(Packages.java.lang.Byte.TYPE, 16384);
			var count;
			while ((count = stream.read(buffer)) !== -1) {
				digest.update(buffer, 0, count);
			}
		} finally {
			stream.close();
		}
		var bytes = digest.digest();
		var out = "";
		for (var index = 0; index < bytes.length; index++) {
			out += ("0" + ((bytes[index] & 255).toString(16))).slice(-2);
		}
		return out;
	}

	function moveReplacing(source, target) {
		var Files = Packages.java.nio.file.Files;
		var StandardCopyOption = Packages.java.nio.file.StandardCopyOption;
		try {
			Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
		} catch (_atomicUnavailable) {
			Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
		}
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var Files = Packages.java.nio.file.Files;
			var Paths = Packages.java.nio.file.Paths;
			var UUID = Packages.java.util.UUID;
			var sourceText = String(props.sourceFile || "").trim();
			if (!sourceText) {
				throw new Error("frontend-svelte-asset-import requires sourceFile.");
			}
			var source = Paths.get(sourceText);
			if (!source.isAbsolute() || !Files.isRegularFile(source)) {
				throw new Error("sourceFile must be an existing absolute local file.");
			}
			source = source.toRealPath();
			var size = Number(Files.size(source));
			if (size < 1 || size > MAX_BYTES) {
				throw new Error("Frontend assets must contain 1 to " + MAX_BYTES + " bytes.");
			}
			var fileName = String(source.getFileName());
			var extensionMatch = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
			var extension = extensionMatch ? extensionMatch[1] : "";
			if (!MIME_TYPES[extension]) {
				throw new Error("Unsupported frontend image type. Use PNG, JPEG, GIF, WebP, SVG or AVIF.");
			}
			var projectRoot = Paths.get(String(props.projectDir || "")).toAbsolutePath().normalize();
			if (!Files.isDirectory(projectRoot)) {
				throw new Error("Target Convertigo project directory does not exist.");
			}
			projectRoot = projectRoot.toRealPath();
			var assetPath = cleanAssetPath(props.assetPath, "resources/" + fileName);
			var assetExtensionMatch = assetPath.toLowerCase().match(/\.([a-z0-9]+)$/);
			var assetExtension = assetExtensionMatch ? assetExtensionMatch[1] : "";
			if (!MIME_TYPES[assetExtension] || MIME_TYPES[assetExtension] !== MIME_TYPES[extension]) {
				throw new Error("assetPath must keep the source image type.");
			}
			var resourcesRoot = projectRoot.resolve("resources").normalize();
			var target = projectRoot.resolve(assetPath).normalize();
			if (!target.startsWith(resourcesRoot) || target.equals(resourcesRoot)) {
				throw new Error("Refusing to import an asset outside the project resources directory.");
			}
			Files.createDirectories(resourcesRoot);
			Files.createDirectories(target.getParent());
			var realResourcesRoot = resourcesRoot.toRealPath();
			var realParent = target.getParent().toRealPath();
			if (!realParent.startsWith(realResourcesRoot)) {
				throw new Error("Refusing to import through a symlink outside the project resources directory.");
			}
			target = realParent.resolve(target.getFileName());
			var sourceHash = sha256(source);
			var existing = Files.isRegularFile(target);
			if (existing && sha256(target) === sourceHash) {
				var unchanged = {
					ok: true,
					project: String(props.project || ""),
					assetPath: assetPath,
					url: assetPath,
					mimeType: MIME_TYPES[extension],
					size: size,
					sha256: sourceHash,
					changed: false,
					written: false,
					sourceFile: String(target)
				};
				ctx.write(props.out || "local.asset", unchanged);
				return unchanged;
			}
			var overwrite = props.overwrite === undefined || props.overwrite === null || props.overwrite === ""
				? true
				: props.overwrite === true || String(props.overwrite) === "true";
			if (existing && !overwrite) {
				throw new Error("Frontend asset already exists: " + assetPath + ". Set overwrite:true to replace it.");
			}
			var staged = target.resolveSibling("." + target.getFileName() + ".flow-import-" + UUID.randomUUID() + ".tmp");
			try {
				Files.copy(source, staged);
				moveReplacing(staged, target);
			} finally {
				Files.deleteIfExists(staged);
			}
			var result = {
				ok: true,
				project: String(props.project || ""),
				assetPath: assetPath,
				url: assetPath,
				mimeType: MIME_TYPES[extension],
				size: size,
				sha256: sourceHash,
				changed: true,
				written: true,
				sourceFile: String(target),
				next: "Use the returned resources/... URL directly in Image properties or app.flow.css."
			};
			ctx.write(props.out || "local.asset", result);
			return result;
		}
	};
}())
