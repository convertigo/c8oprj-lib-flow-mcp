var File=java.io.File,IO=Packages.org.apache.commons.io.FileUtils;
var root=java.nio.file.Files.createTempDirectory('flow-inline-diagnostic-').toFile();
var source=String(IO.readFileToString(new File(arguments[0],'_flow/blocks/frontend/svelte/source.block.js'),'UTF-8'));
var block=eval(source.substring(source.indexOf('(function')));
var reported='_flow/frontbuilder/svelte/model/App/src/routes/new/+page.flow.svelte:4:18 property test: Unexpected character @';
var ctx={props:function(n){return n;},write:function(){},authoringTreeSource:function(){return {children:[{kind:'error',label:'Invalid +page.flow.svelte',props:{error:reported}}]};}};
var props={operation:'set',projectDir:String(root),sourceFile:'_flow/frontbuilder/svelte/model/App/src/routes/new/+page.flow.svelte',code:'<FlowComponent $$id="new"><Structure><If test={@page.st} /></Structure></FlowComponent>'};
var failure=null;try{block.run(ctx,props);}catch(e){failure=e;}
if(!failure||failure.message.indexOf('4:18 property test')<0||!failure.details||failure.hint.indexOf('inline code')<0)throw Error('source location or inline recovery missing: '+failure);
props.operation='check';var checked=block.run(ctx,props);
if(checked.ok!==false||checked.revision!==null||checked.diagnostics[0].message.indexOf(reported)<0)throw Error('new refused source must remain checkable inline: '+JSON.stringify(checked));
print('frontend-inline-diagnostic OK');
