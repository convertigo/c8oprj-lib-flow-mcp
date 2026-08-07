const _meta = {
  "version": 1,
  "description": "Searches workspace Convertigo projects that contribute reusable Flow backend blocks or Svelte components.",
  "icon": "mdi:bookshelf",
  "properties": {
    "project": {
      "kind": "text",
      "type": "string",
      "description": "Consuming Convertigo project used to report existing references."
    },
    "query": {
      "kind": "text",
      "type": "string",
      "description": "Optional capability or component search, for example chart, markdown or github."
    },
    "target": {
      "kind": "text",
      "type": "string",
      "default": "any",
      "enum": ["any", "backend", "frontend"],
      "description": "Limit results to backend blocks, frontend components or both."
    },
    "limit": {
      "kind": "literal",
      "type": "integer",
      "default": 10,
      "description": "Maximum number of matching library projects."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.flowLibraries",
      "description": "Scope path receiving the library search result."
    }
  },
  "outputs": {
    "out": {
      "type": "object",
      "properties": {
        "ok": { "type": "boolean" },
        "project": { "type": "string" },
        "query": { "type": "string" },
        "target": { "type": "string" },
        "count": { "type": "integer" },
        "libraries": { "type": "array", "items": { "type": "object" } },
        "recommendedCall": { "type": ["object", "null"] }
      }
    }
  },
  "runtime": "rhino"
}

// Use Rhino 1.9.0 features: https://mozilla.github.io/rhino/compat/engines.html
(function () {
  var File = Packages.java.io.File;
  var FileUtils = Packages.org.apache.commons.io.FileUtils;
  var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
  var ProjectSchemaReference = Packages.com.twinsoft.convertigo.beans.references.ProjectSchemaReference;

  function prop(node, key) {
    return node && node.props && node.props[key] !== undefined ? node.props[key] : node && node[key];
  }

  function text(value, fallback) {
    if (value === undefined || value === null || String(value).trim() === "") {
      return fallback || "";
    }
    return String(value).trim();
  }

  function boundedLimit(value) {
    var number = Number(value || 10);
    return Math.max(1, Math.min(20, isFinite(number) ? Math.floor(number) : 10));
  }

  function words(value) {
    return text(value, "").toLowerCase().split(/[^a-z0-9_.-]+/).filter(function (word) {
      return word.length > 0;
    });
  }

  function includesWords(haystack, tokens) {
    var normalized = String(haystack || "").toLowerCase();
    return tokens.every(function (token) { return normalized.indexOf(token) !== -1; });
  }

  function javaValues(collection) {
    var values = [];
    if (!collection) {
      return values;
    }
    var iterator = collection.iterator();
    while (iterator.hasNext()) {
      values.push(iterator.next());
    }
    return values;
  }

  function projectNameFromRoot(root) {
    try {
      var definition = new File(root, "c8oProject.yaml");
      if (!definition.isFile() || definition.length() > 1024 * 1024) {
        return "";
      }
      var source = String(FileUtils.readFileToString(definition, "UTF-8"));
      var lines = source.split(/\r?\n/);
      for (var i = 0; i < lines.length; i++) {
        var match = /^↓([^\s\[]+) \[core\.Project\]: $/.exec(lines[i]);
        if (match) {
          return String(match[1]);
        }
      }
      return "";
    } catch (_ignoreDefinition) {
      return "";
    }
  }

  function candidateWorkspaceRoots(dbom, consumer) {
    var roots = {};
    function add(file) {
      if (!file || !file.isDirectory()) {
        return;
      }
      try {
        roots[String(file.getCanonicalPath())] = file.getCanonicalFile();
      } catch (_ignoreCanonical) {
        roots[String(file.getAbsolutePath())] = file.getAbsoluteFile();
      }
    }
    if (Engine.PROJECTS_PATH !== undefined && Engine.PROJECTS_PATH !== null) {
      add(new File(String(Engine.PROJECTS_PATH)));
    }
    if (consumer) {
      add(new File(String(consumer.getDirPath())).getParentFile());
    }
    javaValues(dbom.getAllProjectNamesList(false)).forEach(function (name) {
      try {
        add(new File(String(Engine.projectDir(String(name)))).getParentFile());
      } catch (_ignoreProjectDir) {
      }
    });
    return Object.keys(roots).map(function (key) { return roots[key]; });
  }

  function discoverWorkspaceProjects(dbom, consumer) {
    var projects = {};
    javaValues(dbom.getAllProjectNamesList(false)).forEach(function (name) {
      var projectName = String(name);
      var loaded = dbom.getLoadedProjectByName(projectName);
      try {
        projects[projectName] = {
          root: loaded ? new File(String(loaded.getDirPath())) : new File(String(Engine.projectDir(projectName))),
          loaded: loaded != null
        };
      } catch (_ignoreProjectDir) {
      }
    });
    candidateWorkspaceRoots(dbom, consumer).forEach(function (workspaceRoot) {
      var children = workspaceRoot.listFiles();
      if (!children) {
        return;
      }
      for (var i = 0; i < children.length; i++) {
        var root = children[i];
        if (!root.isDirectory()) {
          continue;
        }
        var projectName = projectNameFromRoot(root);
        if (projectName && !projects[projectName]) {
          projects[projectName] = { root: root, loaded: false };
        }
      }
    });
    return projects;
  }

  function referencedProjects(project) {
    var names = {};
    if (!project) {
      return names;
    }
    javaValues(project.getReferenceList()).forEach(function (reference) {
      if (reference instanceof ProjectSchemaReference) {
        names[String(reference.getParser().getProjectName())] = true;
      }
    });
    return names;
  }

  function relativePath(root, file) {
    var rootPath = String(root.getCanonicalPath());
    var filePath = String(file.getCanonicalPath());
    return filePath.indexOf(rootPath + File.separator) === 0
      ? filePath.substring(rootPath.length + 1).replace(/\\/g, "/")
      : String(file.getName());
  }

  function sourceField(source, key, fallback) {
    var match = new RegExp("\\b" + key + "\\s*:\\s*[\\\"']([^\\\"']+)[\\\"']").exec(source);
    return match ? String(match[1]) : fallback || "";
  }

  function dependencyNames(source) {
    var match = /\bdependencies\s*:\s*\{([\s\S]*?)\}/.exec(source);
    if (!match) {
      return [];
    }
    var names = [];
    var matcher = /["']([^"']+)["']\s*:/g;
    var dependency;
    while ((dependency = matcher.exec(match[1])) !== null) {
      names.push(String(dependency[1]));
    }
    return names;
  }

  function collectFiles(root, suffix, files) {
    if (!root || !root.exists()) {
      return;
    }
    if (root.isFile()) {
      if (String(root.getName()).endsWith(suffix)) {
        files.push(root);
      }
      return;
    }
    var children = root.listFiles();
    if (!children) {
      return;
    }
    for (var i = 0; i < children.length; i++) {
      collectFiles(children[i], suffix, files);
    }
  }

  function descriptor(root, file, kind) {
    var source = file.length() <= 512 * 1024
      ? String(FileUtils.readFileToString(file, "UTF-8"))
      : "";
    var relative = relativePath(root, file);
    var fallback = String(file.getName()).replace(kind === "frontend" ? /\.flow\.svelte$/ : /\.block\.js$/, "");
    var name = sourceField(source, "name", fallback);
    var id = sourceField(source, "id", kind === "backend"
      ? relative.replace(/\.block\.js$/, "").replace(/\//g, ".")
      : name);
    return {
      kind: kind === "frontend" ? "frontendComponent" : "backendBlock",
      id: id,
      name: name,
      category: sourceField(source, "category", ""),
      description: sourceField(source, "description", ""),
      path: relative,
      dependencies: kind === "frontend" ? dependencyNames(source) : [],
      searchText: [id, name, relative, source].join("\n")
    };
  }

  function projectLibrary(projectName, root, loaded, consumerName, references, tokens, target) {
    root = root.getCanonicalFile();
    var backendRoot = new File(root, "libs/flow/blocks");
    var frontendRoot = new File(root, "libs/flow/frontbuilder/svelte/components");
    var backendFiles = [];
    var frontendFiles = [];
    if (target !== "frontend") {
      collectFiles(backendRoot, ".block.js", backendFiles);
    }
    if (target !== "backend") {
      collectFiles(frontendRoot, ".flow.svelte", frontendFiles);
    }
    if (backendFiles.length === 0 && frontendFiles.length === 0) {
      return null;
    }
    var items = backendFiles.map(function (file) {
      return descriptor(backendRoot, file, "backend");
    }).concat(frontendFiles.map(function (file) {
      return descriptor(frontendRoot, file, "frontend");
    }));
    var matching = tokens.length === 0
      ? items.slice(0, 8)
      : items.filter(function (item) { return includesWords(item.searchText, tokens); }).slice(0, 12);
    var projectMatches = includesWords(projectName, tokens);
    if (tokens.length > 0 && !projectMatches && matching.length === 0) {
      return null;
    }
    var dependencies = {};
    matching.forEach(function (item) {
      (item.dependencies || []).forEach(function (name) { dependencies[name] = true; });
      delete item.searchText;
    });
    var referenced = references[projectName] === true;
    return {
      project: projectName,
      loaded: loaded,
      referenced: referenced,
      capabilities: {
        backend: backendFiles.length > 0,
        frontend: frontendFiles.length > 0
      },
      counts: {
        backendBlocks: backendFiles.length,
        frontendComponents: frontendFiles.length
      },
      matches: matching,
      npmDependencies: Object.keys(dependencies).sort(),
      score: (projectMatches ? 100 : 0) + matching.length * 10,
      referenceCall: referenced || projectName === consumerName ? null : {
        tool: "flow-project-reference",
        arguments: { project: consumerName, reference: projectName }
      }
    };
  }

  return {
    run: function (ctx, node) {
      var props = ctx.props(node);
      var consumerName = text(prop(props, "project"), "");
      var query = text(prop(props, "query"), "");
      var target = text(prop(props, "target"), "any").toLowerCase();
      if (["any", "backend", "frontend"].indexOf(target) === -1) {
        throw new Error("Invalid Flow library target: " + target + ". Use any, backend or frontend.");
      }
      var dbom = Engine.theApp && Engine.theApp.databaseObjectsManager;
      if (!dbom) {
        throw new Error("Convertigo project manager is unavailable.");
      }
      var consumer = consumerName ? dbom.getOriginalProjectByName(consumerName, false) : null;
      if (consumerName && !consumer) {
        throw new Error("Convertigo project is not loaded: " + consumerName);
      }
      var references = referencedProjects(consumer);
      var tokens = words(query);
      var libraries = [];
      var workspaceProjects = discoverWorkspaceProjects(dbom, consumer);
      Object.keys(workspaceProjects).forEach(function (projectName) {
        if (projectName === consumerName) {
          return;
        }
        var candidate = workspaceProjects[projectName];
        var root = candidate.root;
        if (!root.isDirectory()) {
          return;
        }
        var library = projectLibrary(projectName, root, candidate.loaded,
          consumerName, references, tokens, target);
        if (library) {
          libraries.push(library);
        }
      });
      libraries.sort(function (left, right) {
        return right.score - left.score || left.project.localeCompare(right.project);
      });
      libraries = libraries.slice(0, boundedLimit(prop(props, "limit")));
      var recommendedCall = null;
      for (var i = 0; i < libraries.length; i++) {
        if (libraries[i].referenceCall) {
          recommendedCall = libraries[i].referenceCall;
          break;
        }
      }
      libraries.forEach(function (library) { delete library.score; });
      var response = {
        ok: true,
        project: consumerName,
        query: query,
        target: target,
        count: libraries.length,
        libraries: libraries,
        recommendedCall: recommendedCall
      };
      ctx.write(prop(props, "out") || "local.flowLibraries", response);
      return response;
    }
  };
}())
