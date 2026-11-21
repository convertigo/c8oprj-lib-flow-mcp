// The scaffold answer says how requestable.call takes each transaction: inputs lists, by transaction, its requestable and
// the variables it declares under their real names (a view variable key is created as _use_key, which the answer did not
// say: a call with key returned every row). postDocument declares _use_json_base, the whole document as Convertigo
// PostDocumentTransaction reads it (a call giving it to a transaction without it wrote an empty document).
var engineRoot=new java.io.File(arguments[0]).getCanonicalFile(),project=new java.io.File(arguments[1]).getCanonicalFile();
var files=Packages.org.apache.commons.io.FileUtils,assertions=0,failures=[];
var contract=eval(String(files.readFileToString(new java.io.File(engineRoot,'modules/native-property-contract.js'),'UTF-8')));
function assert(v,m){assertions++;if(!v)failures.push(m);}
function read(path){return String(files.readFileToString(new java.io.File(project,path),'UTF-8'));}
function block(path,replace){var s=read(path);if(replace)s=replace(s);return eval(s.substring(s.indexOf('(function')));}
function context(){return {props:function(n){return n.props;},nativePropertyContract:function(){return contract;},write:function(){},lib:function(){return {assertProjectSaveAllowed:function(){return false;},withProjectFlagLock:function(p,f){return f();}};}};}
var scaffold=block('_flow/blocks/project/fullsync/scaffold.block.js',function(s){return s.replace('function loadedProject(engine, name) {','function loadedProject(engine, name) { return null;');});
var answer=scaffold.run(context(),{props:{project:'Probe',connector:{name:'ticketsdb'},dryRun:true,transactions:[
 {name:'TicketsByTag',type:'getView',view:'tickets/by_tag',variables:[{name:'key'}]},
 {name:'PostTicket',type:'postDocument'},
 {name:'PostFields',type:'postDocument',variables:[{name:'title'},{name:'tag'}]},
 {name:'GetTicket',type:'getDocument'},
 {name:'PostMany',type:'postBulkDocuments'}]}});
var inputs=answer.inputs||{};
function names(t){return JSON.stringify(inputs[t]&&inputs[t].variables);}
assert(inputs.TicketsByTag&&inputs.TicketsByTag.requestable==='.ticketsdb.TicketsByTag'&&inputs.TicketsByTag.type==='getView','the view is called .ticketsdb.TicketsByTag: '+JSON.stringify(inputs.TicketsByTag));
assert(names('TicketsByTag')==='["_use_include_docs","_use_limit","_use_key"]','the view variable key is listed as _use_key: '+names('TicketsByTag'));
assert(names('PostTicket')==='["_use_json_base"]','postDocument declares _use_json_base: '+names('PostTicket'));
assert(names('PostFields')==='["_use_json_base","title","tag"]','field variables are listed beside _use_json_base: '+names('PostFields'));
assert(names('GetTicket')==='["_use_docid"]'&&names('PostMany')==='["_use_json_base"]','getDocument and postBulkDocuments: '+names('GetTicket')+' '+names('PostMany'));
var usage=answer.usage||{};
assert(/_use_json_base/.test(usage.postDocument)&&/REQUESTABLE_UNDECLARED_INPUT/.test(usage.postDocument),'the postDocument usage gives both forms: '+usage.postDocument);
assert(/_use_key/.test(usage.variables)&&/inputs/.test(usage.variables),'the usage says the _use_ prefix: '+usage.variables);
var defaults=scaffold.defaultVariables('postDocument',{});
assert(defaults.length===1&&defaults[0].name==='_use_json_base','the default variables of postDocument: '+JSON.stringify(defaults));
if(failures.length){throw new Error(failures.join('\n'));}
print('fullsync-scaffold-inputs: '+assertions+' assertions');
