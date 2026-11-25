const _meta = {
  sourceVersion: 2, version: 1, private: true, runtime: "rhino",
  uses: ["mcp", "source-sync"], icon: "mdi:sync",
  description: "Sources mode: the project files on disk are the truth. Checks each changed file (Flows, blocks, .browser.js, pages, .flow.css, _flow/data/model.yaml) with the validator of code-check, then saves it as written: no working copy, nothing to promote. Omit paths for the files changed since the last sync; dryRun checks without saving. Same diagnostics, hints and guides as code-check. flow://guide/sources.",
  properties: {
    request: {kind:"expression",type:"object",default:"input.request"},
    project: {kind:"text",type:"string",description:"Target project; its files are read from the project folder on disk."},
    paths: {kind:"expression",type:"array",items:{type:"string"},description:"Project-relative files to check and save; omitted, the files changed since the last sync."},
    dryRun: {kind:"literal",type:"boolean",default:false,description:"Check without saving."},
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
