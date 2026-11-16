// MCP-only filesystem adapter. Validation and application belong to the existing tool blocks.
(function () {
	var ACCEPTED = ["_flow/flows/*.flow.js", "_flow/blocks/**/*.block.js",
		"_flow/frontbuilder/svelte/model/<App>/src/**/*.flow.svelte", "*.flow.css (under the same src)",
		"_flow/data/model.yaml", "_flow/schemas/**"];
	var HIDDEN = ["code-set", "code-patch", "authoring-mutate", "frontend-svelte-mutate",
		"flow-block-mock", "flow-object-remove", "flow-project-remove", "flow-resource-patch", "flow-resource-delete",
		"flow-entity-model-set", "flow-crud-upsert", "flow-fullsync-scaffold", "frontend-svelte-fullsync-schema"];
	function sources(ctx) {
		var c = ctx && typeof ctx.convertigoContext === "function" ? ctx.convertigoContext() : null;
		var http = c && c.httpServletRequest;
		if (!http && ctx && ctx.httpServletRequest) http = ctx.httpServletRequest;
		return !!(http && String(http.getHeader("X-Convertigo-Source-Mode") || "") === "sources");
	}
	function visible(ctx, name) {
		return sources(ctx) ? HIDDEN.indexOf(name) < 0 : name !== "flow-source-sync";
	}
	function target(path) {
		var m;
		if ((m = /^_flow\/flows\/([A-Za-z_$][\w$]*)\.flow\.js$/.exec(path))) return {name:m[1]};
		if ((m = /^_flow\/blocks\/(.+)\.block\.js$/.exec(path))) return {block:m[1].replace(/\//g,".")};
		if (/^_flow\/frontbuilder\/svelte\/model\/[^/]+\/src\/.+\.flow\.(svelte|css)$/.test(path)) return {sourceFile:path};
		if (path === "_flow/data/model.yaml" || /^_flow\/schemas\/.+/.test(path)) return {path:path};
		return null;
	}
	function failed(r) {
		var s = r && r.result && r.result.structuredContent;
		return !r || !!r.error || !!(r.result && r.result.isError) || !!(s && (s.ok === false || s.error));
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
				else if (target(path)) found[path]=read(confined(path));
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
			var kept=servlet.getAttribute(key), known=kept ? JSON.parse(String(kept)) : {};
			// The first call snapshots the engine view, before the harness starts the source editor.
			if (!kept) {
				var store=mcp.sourceStore(args);
				Object.keys(disk).forEach(function(p){var f=confined(p); if(store.exists(f)) known[p]=store.read(f);});
				servlet.setAttribute(key,JSON.stringify(known));
			}
			var paths=args.paths;
			if (paths === undefined || paths === null) {
				paths=Object.keys(disk).concat(Object.keys(known).filter(function(p){return disk[p]===undefined;}))
					.filter(function(p){return disk[p]!==known[p];});
			}
			if (!Array.isArray(paths)) throw {code:"INVALID_ARGUMENT",message:"paths must be an array of project-relative paths."};
			var results=[], count={checked:0,applied:0,refused:0}, dry=args.dryRun===true;
			function inner(name, a, op) {
				var req={jsonrpc:"2.0",id:request.id,method:"tools/call",params:{name:name,arguments:Object.assign({},args,a)}};
				delete req.params.arguments.paths; delete req.params.arguments.dryRun;
				return ctx.callBlock(op ? "mcp.tool.code.dispatch" : "mcp.tool."+name.replace(/^flow-/,"flow.").replace(/-/g,"."),
					{request:req,operation:op,out:"local.sourceSyncInner"},{trace:false});
			}
			paths.filter(function(p,i){return paths.indexOf(p)===i;}).sort().forEach(function(path) {
				var entry={path:path,applied:false,diskApplied:false}, response;
				try {
					var file=confined(path), t=target(path);
					if (!t) throw {code:"SOURCE_TYPE_UNSUPPORTED",message:"Unsupported author source: "+path,details:{accepted:ACCEPTED}};
					if (!file.isFile()) throw {code:"SOURCE_FILE_DELETED",message:"Source is missing on disk; no engine deletion was applied: "+path,details:{accepted:ACCEPTED}};
					var text=read(file);
					if (t.path) {
						// The resource writer owns data/schema validation too. baseContent bypasses no validator.
						var preview={path:path,baseContent:text,edits:[{oldText:text,newText:text}],dryRun:true};
						response=inner("flow-resource-patch",preview);
						if (!dry && !failed(response)) {
							// Request the same resource engine application even when disk already holds these bytes.
							response=mcp.runToolBlock(ctx,{id:request.id,params:{name:"flow-source-sync",arguments:args}}, {},function(){
								return ctx.resourcePatch({project:args.project,projectDir:args.projectDir,path:path,
									edits:[{oldText:text,newText:text}]});
							});
						}
					} else {
						response=inner("code-check",Object.assign({},t,{code:text}),"check");
						if (!dry && !failed(response)) {
							var current=inner("code-get",t,"get");
							var sc=current && current.result && current.result.structuredContent || {};
							response=inner("code-set",Object.assign({},t,{code:text,revision:sc.revision}),"set");
						}
					}
					count.checked++;
					if (failed(response)) count.refused++;
					else if (!dry) {known[path]=text;count.applied++;entry.applied=true;entry.diskApplied=true;}
				} catch(e) {response=mcp.toolError(request,e,ctx);count.refused++;}
				// Preserve the complete code-check/code-set envelope, including text, hints and guide drawers.
				entry.response=response;
				if (failed(response)) entry.note="Disk file was not applied. Direct runtime disk reads can still observe it; repair and sync before running.";
				results.push(entry);
			});
			if (!dry) servlet.setAttribute(key,JSON.stringify(known));
			var content=[];
			results.forEach(function(e){(e.response && e.response.result && e.response.result.content || []).forEach(function(c){content.push(c);});});
			content.push({type:"text",text:count.checked+" checked, "+count.applied+" applied, "+count.refused+" refused."});
			return mcp.jsonRpcResult(request.id,{isError:count.refused>0,content:content,structuredContent:{ok:count.refused===0,
				dryRun:dry,results:results,summary:count,runtimeDiskReads:true}});
		},lock)();
	}
	return {sync:sync,visible:visible,sources:sources,hidden:HIDDEN,target:target,accepted:ACCEPTED};
}())
