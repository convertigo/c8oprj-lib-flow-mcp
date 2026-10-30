const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "private": true,
  "runtime": "rhino",
  "uses": [
    "mcp",
    "crud-fastpath", "crud-model", "crud-legacy"
  ],
  "description": "Preview or apply a legacy-shaped model, portable SQL and owned CRUD artifacts; frontend component plan.",
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
    "planHash": {"kind":"text","type":"string","description":"Hash from the preceding dry-run; application refuses a stale plan."},
    "spec": {
      "kind": "literal",
      "type": "object",
      "description":"Optional legacy CRUD spec; omitted reads _flow/data/model.yaml."
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
