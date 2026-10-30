const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "private": true,
  "runtime": "rhino",
  "uses": [
    "mcp",
    "crud-fastpath", "crud-model", "crud-legacy", "crud-ui", "project-starter"
  ],
  "description": "Checks an application applied by flow-crud-upsert: the stored model is applied, every generated Flow, page and SQL resource still matches it (a hand edit is reported), and the read-only SQL plan has nothing left to run. Call it after apply and after any model change: {project:\"MyApp\"}. It does not prove end-user rights or pages: sign in over HTTP with each role and check the pages.",
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
      "required": true
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
try { var args=mcp.prepareToolArguments(ctx,request,{}); var result=ctx.lib("crud-fastpath").proof(ctx,args);
var response=mcp.finalizeResponse(ctx,request,mcp.jsonRpcResult(request.id,{content:[{type:"text",text:JSON.stringify(result)}],structuredContent:result}));
ctx.write(ctx.props(node).out || "local.response",response);return response;
} catch(error) {return mcp.toolError(request,error,ctx);}
}}; }())
