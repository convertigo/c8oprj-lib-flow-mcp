const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "runtime": "rhino",
  "description": "Sets a non-secret project symbol in the engine symbol manager, effective immediately. Only boolean and numeric feature settings; no credentials, files or administration endpoint.",
  "properties": {
    "project": {
      "kind": "text",
      "type": "string",
      "description": "Loaded application project; only its <project>.* symbol namespace can be changed."
    },
    "key": {
      "kind": "text",
      "type": "string",
      "description": "Full project-prefixed non-secret symbol key, for example App.demo.login."
    },
    "value": {
      "kind": "literal",
      "type": "unknown",
      "description": "Non-secret boolean or finite number. Strings and credentials are refused."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.projectSymbol"
    }
  },
  "outputs": {
    "out": {
      "type": "object",
      "properties": {
        "ok": {
          "type": "boolean"
        },
        "project": {
          "type": "string"
        },
        "key": {
          "type": "string"
        },
        "changed": {
          "type": "boolean"
        },
        "effective": {
          "type": "boolean"
        }
      }
    }
  }
};

(function () {
 function fail(property, message) {
  var e = new Error("flow-project-symbol-set " + property + ": " + message);
  e.code = "PROJECT_SYMBOL_INVALID";
  e.details = { property: property };
  e.hint = "Use key <project>.<setting> and a non-secret boolean or finite number, for example App.demo.login = true. Credentials must be provisioned by the operator.";
  throw e;
 }
 return {run:function(ctx,node) {
  var p=ctx.props(node), project=String(p.project || ""), key=String(p.key || "");
  if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(project)) fail("project","a loaded project name is required.");
  if(key.indexOf(project+".")!==0 || !/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_-]*)+$/.test(key)) fail("key","only this project's namespace is allowed.");
  if(/(?:secret|password|passwd|credential|token|jwt|apikey|api_key|privatekey|private_key)/i.test(key)) fail("key","credential settings are not exposed.");
  if(typeof p.value!=="boolean" && !(typeof p.value==="number" && isFinite(p.value))) fail("value","expected a boolean or finite number; strings and credentials are refused.");
  var dbom=Packages.com.twinsoft.convertigo.engine.Engine.theApp.databaseObjectsManager;
  if(dbom.getOriginalProjectByName(project,false)==null) fail("project","the project is not loaded.");
  var value=String(p.value), current=dbom.symbolsGetValue(key);
  var changed=current==null || String(current)!==value;
  // The public manager updates its in-memory map and notifies loaded projects. Never edit global_symbols.properties:
  // the Flow configuration resolver reads this map at every run, including an already-warm runtime.
  if(changed) dbom.symbolsEdit(key,key,value);
  var result={ok:true,project:project,key:key,changed:changed,effective:String(dbom.symbolsGetValue(key))===value};
  if(!result.effective) fail("value","the symbol manager did not apply the setting; retry once after checking the engine log.");
  ctx.write(p.out || "local.projectSymbol",result); return result;
 }};
}())
