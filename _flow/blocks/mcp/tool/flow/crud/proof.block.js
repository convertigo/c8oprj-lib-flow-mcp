const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "private": true,
  "runtime": "rhino",
  "uses": [
    "mcp",
    "crud-fastpath", "crud-model", "crud-legacy"
  ],
  "description": "Checks generated CRUD artifacts and executes private schema/count proof; independent HTTP sessions and browser tests prove end-user rights and UI.",
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
