const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "private": true,
  "runtime": "rhino",
  "uses": [
    "mcp",
    "crud-fastpath", "crud-model", "crud-legacy", "crud-ui", "project-starter"
  ],
  "description": "Builds a data application from an entity model in one step: SQL schema and seed, secured CRUD Flows (<prefix>_<entity>_list/read/count/options/save/delete, <prefix>_session, demo login, logout) and Svelte pages (shell, dashboard, list, detail, form), all owned by _flow/data/model.yaml. Use it first for list/detail/form applications with reference data and roles; read flow://guide/crud for the spec format and how to add business Flows and pages. Two steps: preview with dryRun:true (diagnostics, missing references, SQL plan, planHash), then apply with the same spec and planHash (adds the references, writes, initializes the database); flow-crud-proof checks it. Minimal preview: {project:\"MyApp\", dryRun:true, spec:{facade:{prefix:\"desk\"}, entities:[{name:\"tickets\", fields:[{name:\"Id\", type:\"INTEGER\", primary:true}, {name:\"Title\", type:\"VARCHAR(120)\", required:true}]}]}}.",
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object"
    },
    "out": {
      "kind": "path",
      "mode": "write"
    },
    "project": {
      "kind": "text",
      "type": "string",
      "description": "The Flow project to build or check."
    },
    "planHash": {"kind":"text","type":"string","description":"planHash of the preceding dryRun preview; apply refuses a stale plan (preview again)."},
    "spec": {
      "kind": "literal",
      "type": "object",
      "description":"Entity model (legacy CRUD spec format, flow://guide/crud): entities with fields, relations, seed, security, facade, ui. project defaults to the target project. Omitted: the stored _flow/data/model.yaml."
    },
    "dryRun": {
      "kind": "literal",
      "type": "boolean",
      "description": "true previews without writing and returns planHash; omitted with planHash applies."
    }
  },
  "outputs": {
    "out": {
      "type": "object"
    }
  }
}

(function () { return {run:function(ctx,node) {
var mcp=ctx.lib("mcp"), request=mcp.requestValue(ctx,ctx.props(node).request);
try { var args=mcp.prepareToolArguments(ctx,request,{}); var result=ctx.lib("crud-fastpath").upsert(ctx,args);
var response=mcp.finalizeResponse(ctx,request,mcp.jsonRpcResult(request.id,{content:[{type:"text",text:JSON.stringify(result)}],structuredContent:result}));
ctx.write(ctx.props(node).out || "local.response",response);return response;
} catch(error) {return mcp.toolError(request,error,ctx);}
}}; }())
