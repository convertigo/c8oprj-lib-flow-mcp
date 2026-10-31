var project=new java.io.File(arguments[0]),io=Packages.org.apache.commons.io.FileUtils;
var mcp=eval(String(io.readFileToString(new java.io.File(project,'_flow/lib/mcp.js'),'UTF-8')));
var request={id:1,method:'tools/call',params:{name:'flow-resource-get',arguments:{}}};
[{text:'guide body'},{content:'project body'},{text:''},{content:''}].forEach(function(value){
 var out=mcp.toolResponse(request,value,{}).result.structuredContent;
 if(out.text!==out.content || typeof out.text!=='string')throw Error('Every resource has identical text and content aliases: '+JSON.stringify(out));
});
print('resource-text-alias OK');
