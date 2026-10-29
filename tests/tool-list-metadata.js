// Public JSON Schema field names are contracts, not credential values.
var directory=new java.io.File(arguments[0]).getCanonicalFile();
var source=String(Packages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(directory,"_flow/lib/mcp.js"),"UTF-8"));
var mcp=eval(source),count=0;
function assert(value,message){count++;if(!value)throw new Error(message);}
var descriptor={name:"image-describe",inputSchema:{type:"object",properties:{maxTokens:{type:"integer",default:2000},token:{type:"string",description:"Opaque caller token"}},required:["token"]},outputSchema:{type:"object",properties:{usage:{type:"object",properties:{inputTokens:{type:"integer"},totalTokens:{type:"integer"}}}}}};
var result=mcp.finalizeResponse({}, {method:"tools/list"}, {jsonrpc:"2.0",id:1,result:{tools:[descriptor]}});
assert(JSON.stringify(result.result.tools[0].inputSchema)===JSON.stringify(descriptor.inputSchema),"tools/list corrupted input schemas for token-named fields");
assert(JSON.stringify(result.result.tools[0].outputSchema)===JSON.stringify(descriptor.outputSchema),"tools/list corrupted token usage output schema");
var data=mcp.finalizeResponse({}, {method:"tools/call"}, {jsonrpc:"2.0",id:2,result:{structuredContent:{password:"fixture-password",nested:{token:"fixture-token"},inputSchema:{token:"fixture-token"}}}});
assert(data.result.structuredContent.password==="[redacted]","password data exposed");
assert(data.result.structuredContent.nested.token==="[redacted]","nested token data exposed");
assert(data.result.structuredContent.inputSchema.token==="[redacted]","runtime data must not masquerade as a public schema");
print("tool-list-metadata OK ("+count+" checks)");
