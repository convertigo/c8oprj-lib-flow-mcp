var File=java.io.File,IO=Packages.org.apache.commons.io.FileUtils;
var root=java.nio.file.Files.createTempDirectory('flow-target-check-').toFile();
var source=String(IO.readFileToString(new File(arguments[0],'_flow/blocks/frontend/svelte/source.block.js'),'UTF-8'));
var block=eval(source.substring(source.indexOf('(function')));
var expected=String(new File(root,'_flow/frontbuilder/svelte/model/App/src/routes/new/+page.flow.svelte').getCanonicalPath());
var ctx={props:function(n){return n;},write:function(){},authoringTreeSource:function(request){
 if(request.sourceFile!==expected) return {ok:true,children:[],diagnostics:[]};
 return {ok:true,children:[],diagnostics:[{level:'error',code:'FRONTEND_PROPERTY_VALUE_INVALID',message:'Text.variant: h1 is not in the catalog at line 2',sourcePath:expected,path:'frontAst.slots.structure.children[0].props.variant'}]};
}};
var props={operation:'set',projectDir:String(root),sourceFile:expected,code:'<FlowComponent $$id="new"><Structure>\n<Text variant="h1" /></Structure></FlowComponent>'};
var error=null;try{block.run(ctx,props);}catch(e){error=e;}
if(!error || error.code!=='FRONTEND_PROPERTY_VALUE_INVALID' || error.message.indexOf('Text.variant')<0 || new File(expected).exists())throw Error('New page must be validated through its own projection before writing: '+error);
print('frontend-target-validation OK');
