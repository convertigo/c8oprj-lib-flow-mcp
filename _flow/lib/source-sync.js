// MCP-only filesystem adapter for the sources mode: the project files on disk are the truth. Each changed file is
// checked by the validator of its kind, then saved as is through the existing writer, so no working copy remains.
(function () {
	var ACCEPTED = ["_flow/flows/<Flow>.flow.js", "_flow/blocks/<ns>/<name>.block.js", "_flow/blocks/<ns>/<name>.browser.js",
		"_flow/frontbuilder/svelte/model/<App>/src/**/*.flow.svelte", "_flow/frontbuilder/svelte/model/<App>/src/**/*.flow.css",
		"_flow/data/model.yaml"];
	// Writers replaced by file edits + flow-source-sync, and the draft tools that have nothing to do once the disk is saved.
	var HIDDEN = ["code-set", "code-patch", "code-promote", "code-discard", "authoring-mutate", "frontend-svelte-mutate",
		"flow-block-mock", "flow-object-remove", "flow-project-remove", "flow-resource-patch", "flow-resource-delete",
		"flow-entity-model-set", "flow-crud-upsert", "flow-fullsync-scaffold", "frontend-svelte-fullsync-schema",
		"flow-code-set", "flow-code-patch", "flow-code-promote", "flow-code-discard", "flow-block-code-set", "flow-block-code-patch",
		"frontend-svelte-code-set", "frontend-svelte-code-patch", "frontend-svelte-code-discard"];
	var REREAD = "The engine normalized this file when saving it: read it again before editing it.";
	function sources(ctx) {
		var c = null;
		// Headless runs (tests, the Studio host) have no live Convertigo context: they are never in sources mode.
		try { c = ctx && typeof ctx.convertigoContext === "function" ? ctx.convertigoContext() : null; } catch (e) { c = null; }
		var http = c && c.httpServletRequest;
		if (!http && ctx && ctx.httpServletRequest) http = ctx.httpServletRequest;
		return !!(http && String(http.getHeader("X-Convertigo-Source-Mode") || "") === "sources");
	}
	function visible(ctx, name) {
		return sources(ctx) ? HIDDEN.indexOf(name) < 0 : name !== "flow-source-sync";
	}
	// What a path is, and the arguments that select it for the code tools (never a `kind`: the code dispatcher reads it).
	function target(path) {
		var m;
		if ((m = /^_flow\/flows\/([A-Za-z_$][\w$]*)\.flow\.js$/.exec(path))) return {type:"flow", args:{name:m[1]}};
		if ((m = /^_flow\/blocks\/(.+)\.block\.js$/.exec(path))) return {type:"block", args:{block:m[1].replace(/\//g,".")}};
		if ((m = /^_flow\/blocks\/(.+)\.browser\.js$/.exec(path))) return {type:"browser", args:{block:m[1].replace(/\//g,"."), target:"frontend"}};
		if (/^_flow\/frontbuilder\/svelte\/model\/[^/]+\/src\/.+\.flow\.(svelte|css)$/.test(path)) return {type:"source", args:{sourceFile:path}};
		if (path === "_flow/data/model.yaml") return {type:"model", args:{}};
		return null;
	}
	function failed(r) {
		var s = r && r.result && r.result.structuredContent;
		return !r || !!r.error || !!(r.result && r.result.isError) || !!(s && (s.ok === false || s.error));
	}
	function structured(r) {
		return r && r.result && r.result.structuredContent || {};
	}
	// The revision of a Flow is the SHA-256 of its code (flow-code-service): code-promote with code requires it.
	function sha256(text) {
		var digest = Packages.java.security.MessageDigest.getInstance("SHA-256")
			.digest(new Packages.java.lang.String(String(text)).getBytes(Packages.java.nio.charset.StandardCharsets.UTF_8));
		return String(Packages.java.util.HexFormat.of().formatHex(digest));
	}
	// Contracts before what uses them: blocks, browser implementations, data model, Flows, pages and CSS.
	var RANK = {block:0, browser:1, model:2, flow:3, source:4};
	function rank(path) {
		var t = target(path);
		return t ? RANK[t.type] : 5;
	}
	function sync(ctx, request, args) {
		var mcp = ctx.lib("mcp"), File = Packages.java.io.File, Files = Packages.java.nio.file.Files;
		var root = new File(String(args.projectDir)).getCanonicalFile();
		var prefix = String(root.getPath()) + File.separator;
		function confined(path) {
			if (typeof path !== "string" || path.indexOf("\\") >= 0 || path.split("/").indexOf("..") >= 0 || path.charAt(0) === "/")
				throw {code:"SOURCE_PATH_REFUSED",message:"Expected a project-relative author source path.",details:{accepted:ACCEPTED}};
			var file = new File(root, path).getCanonicalFile();
			if (String(file.getPath()).indexOf(prefix) !== 0)
				throw {code:"SOURCE_PATH_REFUSED",message:"Source escapes the project.",details:{accepted:ACCEPTED}};
			return file;
		}
		function read(file) { return String(Files.readString(file.toPath())); }
		function scan(dir, found) {
			var files = dir.listFiles();
			if (!files) return;
			for (var i=0;i<files.length;i++) {
				var f=files[i], path=String(root.toPath().relativize(f.toPath())).replace(/\\/g,"/");
				if (Files.isSymbolicLink(f.toPath())) continue;
				if (f.isDirectory()) scan(f,found);
				else if (target(path) || /^_flow\/schemas\//.test(path)) found[path]=read(confined(path));
			}
		}
		var servlet = Packages.com.twinsoft.convertigo.engine.Engine.getServletContext();
		if (!servlet) throw {code:"SOURCE_SYNC_STATE_UNAVAILABLE",message:"Source sync needs a running Convertigo servlet."};
		// Interned project key serializes concurrent sync calls without keeping Rhino objects across requests.
		var key="flow.mcp.source-sync:" + String(root.getPath());
		var lock=new Packages.java.lang.String(key).intern();
		return new Packages.org.mozilla.javascript.Synchronizer(function () {
			var disk={};
			["_flow/flows","_flow/blocks","_flow/frontbuilder/svelte/model","_flow/data","_flow/schemas"].forEach(function(p){scan(confined(p),disk);});
			var kept=servlet.getAttribute(key), known=kept ? JSON.parse(String(kept)) : {}, snapshot=!!kept;
			// The first call snapshots the engine view, before the harness starts the source editor.
			if (!kept && Array.isArray(args.paths) && args.paths.length === 0) {
				snapshot=true;
				var store=mcp.sourceStore(args);
				Object.keys(disk).forEach(function(p){var f=confined(p); if(target(p) && store.exists(f)) known[p]=store.read(f); else if(/^_flow\/schemas\//.test(p)) known[p]=disk[p];});
				servlet.setAttribute(key,JSON.stringify(known));
			}
			var paths=args.paths;
			if (paths === undefined || paths === null) {
				// Changed files only, never the schemas the engine generates when it runs or saves a Flow (i191: they were
				// refused as edits, and the whole sync answered an error).
				paths=Object.keys(disk).concat(Object.keys(known).filter(function(p){return disk[p]===undefined;}))
					.filter(function(p){return disk[p]!==known[p] && !/^_flow\/schemas\//.test(p);});
			}
			if (!Array.isArray(paths)) throw {code:"INVALID_ARGUMENT",message:"paths must be an array of project-relative paths."};
			// gateway:true creates the EntityGateway with the model: the model is synced even when it did not change.
			if (args.gateway === true && disk["_flow/data/model.yaml"] !== undefined && paths.indexOf("_flow/data/model.yaml") < 0)
				paths=paths.concat(["_flow/data/model.yaml"]);
			var results=[], count={checked:0,applied:0,refused:0,rewritten:0}, dry=args.dryRun===true;
			function inner(name, a, op) {
				var clean=Object.assign({},args); delete clean.paths; delete clean.dryRun; delete clean.gateway;
				var req={jsonrpc:"2.0",id:request.id,method:"tools/call",__flowMcpTraceDeferred:true,params:{name:name,arguments:Object.assign(clean,a)}};
				return ctx.callBlock(op ? "mcp.tool.code.dispatch" : "mcp.tool."+name.replace(/^flow-/,"flow.").replace(/-/g,"."),
					{request:req,operation:op,out:"local.sourceSyncInner"},{trace:false});
			}
			// Check, then save as is: blocks (contract) first, then the data model, the Flows and the pages, so
			// that each file is checked against what it uses.
			function apply(t, text, file) {
				var a=t.args, response;
				if (t.type === "model") return applyModel(file, text);
				if (t.type === "flow") {
					// A Flow is checked, then promoted from its code: saved as written, declared, and no working copy is kept.
					response=inner("code-check",Object.assign({},a,{code:text}),"check");
					if (dry || failed(response)) return response;
					return inner("code-promote",Object.assign({},a,{code:text,revision:sha256(text)}),"promote");
				}
				if (t.type === "block") {
					// A backend block has no code-check: code-set dry:true is its validator. The file already exists on disk.
					response=inner("code-set",Object.assign({},a,{code:text,overwrite:true,dry:true}),"set");
					if (dry || failed(response)) return response;
					return inner("code-set",Object.assign({},a,{code:text,overwrite:true}),"set");
				}
				response=inner("code-check",Object.assign({},a,{code:text}),"check");
				if (dry || failed(response)) return response;
				var revision=t.type === "source" ? structured(inner("code-get",a,"get")).revision : undefined;
				return inner("code-set",Object.assign({},a,{code:text,revision:revision}),"set");
			}
			// The entity tools compare a new model with the model file on disk, which the editor has already changed: while
			// they check and save, that file holds the last synced model again (none for a model created since the snapshot),
			// so that a stored field removed or retyped is still refused. The edited file is put back unless it was saved.
			function applyModel(file, text) {
				var FileUtils=Packages.org.apache.commons.io.FileUtils, base=known["_flow/data/model.yaml"], response;
				var swap=snapshot && base !== text;
				if (swap) {
					// A private copy of the edited model survives an interrupted call.
					FileUtils.writeStringToFile(new File(root, "_private/flow/source-sync/model.yaml.edited"), text, "UTF-8");
					if (base === undefined) Files.deleteIfExists(file.toPath());
					else FileUtils.writeStringToFile(file, base, "UTF-8");
				}
				try {
					var model=ctx.parseYaml(text);
					response=inner("flow-entity-model-check",{model:model});
					if (!dry && !failed(response))
						response=inner("flow-entity-model-set",Object.assign({model:model,expectedRevision:structured(response).revision},
							args.gateway === true ? {gateway:true} : {}));
				} finally {
					if (swap && (dry || failed(response))) FileUtils.writeStringToFile(file, text, "UTF-8");
				}
				return response;
			}
			var ordered=paths.filter(function(p,i){return paths.indexOf(p)===i;});
			ordered.sort(function(a,b){return (rank(a)-rank(b)) || (a < b ? -1 : a > b ? 1 : 0);});
			ordered.forEach(function(path) {
				var entry={path:path,applied:false}, response;
				try {
					var file=confined(path), t=target(path);
					if (!t) throw {code:/^_flow\/schemas\//.test(path) ? "SOURCE_SCHEMA_READ_ONLY" : "SOURCE_TYPE_UNSUPPORTED",
						message:/^_flow\/schemas\//.test(path) ? "Schemas are generated by the engine; they are not edited as files: "+path
							: "Unsupported author source: "+path,details:{accepted:ACCEPTED}};
					if (!file.isFile()) throw {code:"SOURCE_FILE_DELETED",message:"Source is missing on disk; nothing was deleted in the engine: "+path,
						hint:"Restore the file. Removing a Flow or a page is not part of the sources mode.",details:{accepted:ACCEPTED}};
					var text=read(file);
					entry.type=t.type;
					response=apply(t,text,file);
					count.checked++;
					if (failed(response)) count.refused++;
					else if (!dry) {
						var saved=read(file);
						count.applied++;entry.applied=true;
						if (t.type === "flow" && saved !== text) {
							// A Flow is saved as written: other bytes now are an edit made meanwhile, left for the next sync.
							entry.note="Changed on disk during the sync: sync it again.";
						} else {
							known[path]=saved;
							if (saved !== text) {entry.rewritten=true;entry.note=REREAD;count.rewritten++;}
						}
						mcp.stableToolCalled(t.type === "model" ? "flow-entity-model-set" : t.type === "flow" ? "code-promote" : "code-set");
					}
				} catch(e) {response=mcp.toolError(Object.assign({},request,{__flowMcpTraceDeferred:true}),e,ctx);count.refused++;}
				// Preserve the complete code-check/code-set envelope, including text, hints and guide drawers.
				entry.response=response;
				if (failed(response)) entry.note="Not saved. code-run reads this file from disk while HTTP keeps the last synced version: fix it and sync again before running it.";
				results.push(entry);
			});
			if (!dry) {
				// Files the engine itself wrote during this sync are not edits: the ones it created (the access block of a
				// model, a gateway Flow) and the schemas it generates. A file that existed before keeps its own state.
				var after={};
				["_flow/flows","_flow/blocks","_flow/frontbuilder/svelte/model","_flow/data","_flow/schemas"].forEach(function(p){scan(confined(p),after);});
				Object.keys(after).forEach(function(p){
					if (ordered.indexOf(p) < 0 && after[p] !== disk[p] && (disk[p] === undefined || /^_flow\/schemas\//.test(p)))
						known[p]=after[p];
				});
				servlet.setAttribute(key,JSON.stringify(known));
			}
			var content=[];
			results.forEach(function(e){
				// Same text as code-check/code-promote/code-set, warnings included: the sources mode loses no information.
				(e.response && e.response.result && e.response.result.content || []).forEach(function(c){content.push(c);});
				if (e.note) content.push({type:"text",text:e.path+": "+e.note});
			});
			var summary=count.checked+" checked, "+(dry ? "dry run, nothing applied" : count.applied+" applied")+", "+count.refused+" refused"+
				(count.rewritten ? ", "+count.rewritten+" normalized by the engine" : "")+".";
			if (!paths.length) summary="No changed source since the last sync.";
			content.push({type:"text",text:summary});
			return mcp.jsonRpcResult(request.id,{isError:count.refused>0,content:content,structuredContent:{ok:count.refused===0,
				dryRun:dry,results:results,summary:count,
				next:count.refused ? "Fix the refused files, then call flow-source-sync again." :
					"Run a Flow with code-run, and open or refresh the viewer with frontend-svelte-action dev.sync."}});
		},lock)();
	}
	return {sync:sync,visible:visible,sources:sources,hidden:HIDDEN,target:target,accepted:ACCEPTED};
}())
