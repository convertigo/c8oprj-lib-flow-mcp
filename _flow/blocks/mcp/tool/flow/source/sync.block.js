const _meta = {
  sourceVersion: 2, version: 1, private: true, runtime: "rhino",
  uses: ["mcp", "source-sync"], icon: "mdi:sync",
  description: "Checks or applies author files read from the project disk through the existing code validators and writers. Omit paths for changed/new/deleted sources; dryRun checks without applying. Repair disk files and sync before code-run or dev.sync.",
  properties: {
    request: {kind:"expression",type:"object",default:"input.request"},
    project: {kind:"text",type:"string",required:true},
    paths: {kind:"expression",type:"array",items:{type:"string"}},
    dryRun: {kind:"literal",type:"boolean",default:false},
    out: {kind:"path",mode:"write",default:"local.response"}
  }
}
(function () { return {run:function(ctx,node) {
  var p=ctx.props(node), mcp=ctx.lib("mcp"), request=mcp.requestValue(ctx,p.request), response;
  try {
    var args=mcp.prepareToolArguments(ctx,request,{});
    if (!args.project && !args.projectDir) throw {code:"PROJECT_REQUIRED",message:"flow-source-sync requires project."};
    response=mcp.finalizeResponse(ctx,request,ctx.lib("source-sync").sync(ctx,request,args));
  } catch(e) {response=mcp.toolError(request,e,ctx);}
  ctx.write(p.out || "local.response",response);return response;
}};}())
