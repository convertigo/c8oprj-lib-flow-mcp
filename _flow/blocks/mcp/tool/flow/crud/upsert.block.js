const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "private": true,
  "runtime": "rhino",
  "uses": [
    "mcp",
    "crud-fastpath"
  ],
  "description": "Flow CRUD upsert: declarative schema, generated facades and Flow Svelte pages.",
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
    },
    "spec": {
      "kind": "literal",
      "type": "object",
      "required": true
    },
    "dryRun": {
      "kind": "literal",
      "type": "boolean"
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
