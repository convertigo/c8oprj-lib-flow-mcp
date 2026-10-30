/* MCP authoring compiler. No SQL runtime: generated Flows call the SQL/data libraries. */
(function () {
  function fail(message) { throw new Error('FLOW_CRUD_SPEC_INVALID: ' + message); }
  function id(value) { if (['__proto__','constructor','prototype'].indexOf(String(value))>=0 || !/^[A-Za-z_][A-Za-z0-9_]{0,47}$/.test(String(value))) fail('Invalid identifier: ' + value); return String(value); }
  function json(value) { return JSON.stringify(value, null, 2); }
  function own(o,k) { return Object.prototype.hasOwnProperty.call(o,k); }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function quote(n) { return '"' + id(n) + '"'; }
  function xml(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
  function compile(raw, project) {
    var s=copy(raw), entities={}, relations=s.relations || [], files={}, flows={}, tables=[], seed=[], sources={}, queries={}, writes={};
    id(project);if(['__proto__','constructor','prototype'].indexOf(project)>=0)fail('Reserved project name');
    if(s.specVersion!==1 || !Number.isInteger(s.schemaVersion) || s.schemaVersion<1) fail('specVersion:1 and positive schemaVersion required');
    if(!Array.isArray(s.entities) || !s.entities.length || s.entities.length>32) fail('1..32 entities required');
    if(s.seed && s.seed.reset===true && s.seed.demo!==true)fail('Reset needs explicit demo:true');
    var prefix=id(s.facade && s.facade.prefix || 'crud'), db=s.database || {}, connection=id(db.connection || 'crud');
    if(['hsqldb','postgresql'].indexOf(db.dialect)<0) fail('Only Querydsl-qualified HSQLDB/PostgreSQL');
    if(db.dialect==='hsqldb' && /;shutdown=true/i.test(db.url || '')) fail('Use shutdown=false for concurrent requests');
    if(db.password && !/^\$\{[A-Za-z0-9_.-]+\.secret=?\}$/.test(db.password)) fail('Use server secret symbols; literal passwords are not accepted');
    if(!s.security || !s.security.principals || Object.keys(s.security.principals).length===0) fail('Explicit server principal/role mapping required');
    Object.keys(s.security.principals).forEach(function(p){if(['editor','reader'].indexOf(s.security.principals[p])<0) fail('Role must be editor or reader');});
    s.entities.forEach(function(e){
      id(e.name); if(own(entities,e.name)) fail('Duplicate entity'); entities[e.name]=e;
      if(!Array.isArray(e.fields) || e.fields.length>120) fail('Bounded fields required');
      var seen={}; e.fields.forEach(function(f){id(f.name);if(own(seen,f.name))fail('Duplicate field');seen[f.name]=true;
        if(['string','int64','decimal','boolean','date'].indexOf(f.type)<0)fail('Unsupported type');
        if(f.type==='string' && (!Number.isInteger(f.length) || f.length<1 || f.length>65536))fail('Bounded string length required');
        if(own(f,'default') && f.default!==null){if((f.type==='int64'||f.type==='decimal') && typeof f.default!=='string')fail('Exact numeric defaults are strings');if(f.type==='boolean' && typeof f.default!=='boolean')fail('Boolean default required');}
      });
      if(!e.key || e.key.length!==1 || !e.fields.some(function(f){return f.name===e.key[0] && f.type==='int64' && f.identity===true;}))fail('Prototype requires single generated int64 key');
      if(e.revision){id(e.revision);if(!own(seen,e.revision)) e.fields.push({name:e.revision,type:'int64',default:'1'});else {var r=e.fields.filter(function(f){return f.name===e.revision;})[0];if(r.type!=='int64'||r.nullable||r.identity)fail('Revision must be nonnullable int64');}}
      if(!e.revision && !e.readOnly)fail('Prototype writes require opt-in revision; unversioned entities must be readOnly');
      e.ui=e.ui || {};e.ui.labelField=e.ui.labelField || e.key[0];
      ['labelField'].forEach(function(k){if(!e.fields.some(function(f){return f.name===e.ui[k];}))fail('Unknown UI field');});
      ['listFields','formFields'].forEach(function(k){e.ui[k]=e.ui[k] || e.fields.filter(function(f){return !f.identity && f.name!==e.revision;}).map(function(f){return f.name;});e.ui[k].forEach(function(n){if(!e.fields.some(function(f){return f.name===n;}))fail('Unknown UI field '+n);});});
    });
    relations.forEach(function(r){id(r.name);if(r.kind!=='many-to-one')fail('Prototype supports many-to-one');
      var from=entities[r.from.entity],to=entities[r.to.entity];if(!from||!to)fail('Unknown relation entity');
      var ff=from.fields.filter(function(f){return f.name===r.from.field;})[0],tf=to.fields.filter(function(f){return f.name===r.to.field;})[0];
      if(!ff||!tf||ff.type!==tf.type||r.to.field!==to.key[0])fail('Relation must target compatible primary key');
      if(r.labelField && r.labelField!==to.ui.labelField)fail('Prototype relation labels use the target entity ui.labelField');
    });
    var visited={},active={};function visit(e){if(active[e.name])fail('Cyclic relations unsupported');if(visited[e.name])return;active[e.name]=true;relations.filter(function(r){return r.from.entity===e.name;}).forEach(function(r){visit(entities[r.to.entity]);});delete active[e.name];visited[e.name]=true;tables.push(e);}
    s.entities.forEach(visit);
    var ordered=tables;tables=[];
    ordered.forEach(function(e){
      var columns=e.fields.map(function(f){var c={name:f.name,type:f.type};['nullable','identity','length','precision','scale','default'].forEach(function(k){if(own(f,k))c[k]=f[k];});return c;});
      var table={name:e.name,columns:columns,primaryKey:e.key};
      table.unique=e.fields.filter(function(f){return f.unique;}).map(function(f){return {name:id(e.name+'_'+f.name+'_uq'),columns:[f.name]};});
      table.foreignKeys=relations.filter(function(r){return r.from.entity===e.name;}).map(function(r){return {name:r.name,columns:[r.from.field],references:{table:r.to.entity,columns:[r.to.field]}};});tables.push(table);
      seed.push({table:e.name,key:e.key,rows:(s.seed && s.seed.data && s.seed.data[e.name]) || []});
      var source={provider:'sql',connection:connection,table:e.name,readOnly:true,includeTotal:true,requireProjection:true,fields:e.fields.map(function(f){return {name:f.name,column:f.name,label:f.label || f.name};})};
      sources[e.name+'_read']=source;
      if(!e.readOnly){var writable=copy(source);writable.readOnly=false;writable.versionColumn=e.revision;writable.writableFields=e.fields.filter(function(f){return !f.identity && f.name!==e.revision && !f.readOnly;}).map(function(f){return f.name;});sources[e.name+'_write']=writable;}
      var qtable=quote(db.dialect==='postgresql'?'public':'PUBLIC')+'.'+quote(e.name), cols=e.fields.map(function(f){return quote(f.name);}).join(', ');
      queries[e.name+'_count']={connection:connection,readOnly:true,expose:false,sql:'SELECT COUNT(*) AS "total" FROM '+qtable,parameters:[],columns:[{name:'total',type:'int64',nullable:false}]};
      queries[e.name+'_read']={connection:connection,readOnly:true,expose:false,sql:'SELECT '+cols+' FROM '+qtable+' WHERE '+quote(e.key[0])+'=:id',parameters:[{name:'id',type:'int64'}],columns:e.fields.map(function(f){return {name:f.name,type:f.type,nullable:f.nullable===true};})};
      queries[e.name+'_options']={connection:connection,readOnly:true,expose:false,maxRows:200,sql:'SELECT '+quote(e.key[0])+' AS "value", '+quote(e.ui.labelField)+' AS "label" FROM '+qtable+' ORDER BY '+quote(e.key[0]),parameters:[],columns:[{name:'value',type:'int64',nullable:false},{name:'label',type:e.fields.filter(function(f){return f.name===e.ui.labelField;})[0].type,nullable:false}]};
      if(!e.readOnly){var fields=e.fields.filter(function(f){return !f.identity && f.name!==e.revision && !f.readOnly;}),params=fields.map(function(f){var p={name:f.name,type:f.type,nullable:f.nullable===true};if(own(f,'default'))p.default=f.default;return p;});
        writes[e.name+'_insert']={connection:connection,operation:'insert',sql:'INSERT INTO '+qtable+' ('+fields.map(function(f){return quote(f.name);}).join(', ')+') VALUES ('+fields.map(function(f){return ':'+f.name;}).join(', ')+')',parameters:params,generatedKey:{column:e.key[0],type:'int64'},minAffectedRows:1,maxAffectedRows:1};
        writes[e.name+'_update']={connection:connection,operation:'update',sql:'UPDATE '+qtable+' SET '+fields.map(function(f){return quote(f.name)+'=:'+f.name;}).join(', ')+', '+quote(e.revision)+'='+quote(e.revision)+'+1 WHERE '+quote(e.key[0])+'=:id AND '+quote(e.revision)+'=:revision',parameters:params.concat([{name:'id',type:'int64'},{name:'revision',type:'int64'}]),minAffectedRows:1,maxAffectedRows:1};
        writes[e.name+'_delete']={connection:connection,operation:'delete',sql:'DELETE FROM '+qtable+' WHERE '+quote(e.key[0])+'=:id AND '+quote(e.revision)+'=:revision',parameters:[{name:'id',type:'int64'},{name:'revision',type:'int64'}],minAffectedRows:1,maxAffectedRows:1};
      }
    });
    // Validate declarations at authoring time, before any generated file is written.
    Object.keys(queries).concat(Object.keys(writes)).forEach(function(name){
      var declaration=queries[name] || writes[name],used={},declared={},match,rx=/:([A-Za-z_][A-Za-z0-9_]*)/g;
      while((match=rx.exec(declaration.sql)))used[match[1]]=true;
      declaration.parameters.forEach(function(p){if(own(declared,p.name)||!own(used,p.name))fail('Unused/duplicate named parameter '+name+'.'+p.name);declared[p.name]=true;});
      Object.keys(used).forEach(function(p){if(!own(declared,p))fail('Undeclared named parameter '+name+'.'+p);});
    });
    var config={sql:{connections:{},initializers:{},queries:queries,writes:writes},data:{providers:{sql:{implementation:'sql.table'}},sources:sources},crud:{principals:s.security.principals,demoLogin:s.security.demoLogin===true}};
    config.sql.connections[connection]={url:db.url,dialect:db.dialect,driverClass:db.driverClass,user:db.user || '',password:db.password || '',nativeRead:true,nativeWrite:true};
    config.sql.initializers[prefix]={connection:connection,schemaFile:'_flow/resources/sql/crud/schema.json',dataFile:'_flow/resources/sql/crud/data.json',demo:!!(s.seed && s.seed.demo)};
    function flow(name,inputs,body,privateFlow){body=body.replace(/^(\s*)return ([a-zA-Z]+\.[a-zA-Z]+)\((.*)\)$/gm, '$1local.responseResult = $2($3)\n$1return local.responseResult');flows[name]='const _flow = '+json({sourceVersion:2,accessibility:privateFlow?'private':'hidden',authenticatedContextRequired:!privateFlow,inputs:inputs,config:config})+'\n\nfunction '+name+'({input,config,result}) {\n'+body+'\n}\n';}
    function auth(write){return '  local.user = session.authenticatedUser({})\n  local.role = object.get({source:config.crud.principals,key:local.user})\n  if (!local.user) {\n    throw({code:"UNAUTHENTICATED",message:"Session required",status:401})\n  }\n  if ('+(write?'local.role !== "editor"':'local.role !== "editor" && local.role !== "reader"')+') {\n    throw({code:"FORBIDDEN",message:"Role denied",status:403})\n  }\n';}
    flow(prefix+'_initialize',{},'  return sql.initialize({initializer:'+JSON.stringify(prefix)+',seed:true,resetDemo:'+(s.seed && s.seed.reset===true)+'})',true);
    ordered.forEach(function(e){var n=prefix+'_'+e.name,k=e.key[0];
      flow(n+'_list',{offset:{type:'integer',default:0},limit:{type:'integer',default:20},filter:{type:'object',nullable:true,default:null},orderBy:{type:'string',default:k},direction:{type:'string',default:'asc'}},auth(false)+'  return data.read({source:"'+e.name+'_read",offset:input.offset,limit:input.limit,filter:input.filter,orderBy:input.orderBy,direction:input.direction})');
      flow(n+'_read',{id:{type:'string'}},auth(false)+'  local.response = data.read({source:"'+e.name+'_read",limit:1,filter:{field:"'+k+'",op:"eq",value:input.id}})\n  local.row = list.first({items:local.response.page.rows,fallback:null})\n  if (!local.row) {\n    throw({code:"NOT_FOUND",message:"Row absent",status:404})\n  }\n  return {row:local.row}');
      flow(n+'_count',{},auth(false)+'  return sql.query({query:"'+e.name+'_count",parameters:{}})');
      flow(n+'_options',{},auth(false)+'  return sql.query({query:"'+e.name+'_options",parameters:{},limit:200})');
      if(!e.readOnly){flow(n+'_save',{id:{type:'string',default:''},revision:{type:'string',default:''},patch:{type:'object'}},auth(true)+'  if (input.id === "") {\n    return data.write({source:"'+e.name+'_write",operation:"create",patch:input.patch})\n  }\n  return data.write({source:"'+e.name+'_write",operation:"update",key:{'+k+':input.id},revision:input.revision,patch:input.patch})');
      flow(n+'_delete',{id:{type:'string'},revision:{type:'string'}},auth(true)+'  return data.write({source:"'+e.name+'_write",operation:"delete",key:{'+k+':input.id},revision:input.revision})');}
    });
    flow(prefix+'_runtime_proof',{},'  local.initialized = sql.initialize({initializer:'+JSON.stringify(prefix)+',seed:false})\n'+ordered.map(function(e){return '  result.'+e.name+' = sql.query({query:"'+e.name+'_count",parameters:{}})';}).join('\n'),true);
    flow(prefix+'_demo_login',{user:{type:'string'}},'  if (!config.crud.demoLogin) {\n    throw({code:"FORBIDDEN",message:"Demo login disabled",status:403})\n  }\n  local.role = object.get({source:config.crud.principals,key:input.user})\n  if (local.role !== "editor" && local.role !== "reader") {\n    throw({code:"FORBIDDEN",message:"Unknown demo account",status:403})\n  }\n  local.user = session.authenticate({user:input.user})\n  return {authenticated:true}',true);
    // Login must be HTTP-reachable only in an explicitly enabled demo. Its guard always remains server-side.
    flows[prefix+'_demo_login']=flows[prefix+'_demo_login'].replace('"accessibility": "private"','"accessibility": "hidden"');
    function page(route,pid,title,structure,events,state){var statuses=[],match,seenStatus={},rx=/<CallSequence \$\$id="([^"]+)"/g;while((match=rx.exec(structure+(events||'')))){if(!seenStatus[match[1]])statuses.push('<Status $$id="status_'+match[1]+'" actionId="'+match[1]+'" text="" showSuccess={false} />');seenStatus[match[1]]=true;}structure+=statuses.join('');var root='_flow/frontbuilder/svelte/model/'+project+'/src/routes/'+route;
      files[root+'+page.flow.svelte']='<script module>\nexport const _flow = '+json({sourceVersion:2,page:{id:pid,title:title}})+';\n</script>\n<FlowComponent $$id="'+pid+'" label="'+xml(title)+'">\n'+(state?'<Variables>'+state+'</Variables>':'')+'\n<Structure><PageShell $$id="shell" padding="24px" gap="16px"><Children><Text $$id="title" text="'+xml(title)+'" />'+structure+'</Children></PageShell></Structure>\n'+(events?'<Events><OnMount $$id="load"><Actions>'+events+'</Actions></OnMount></Events>':'')+'\n</FlowComponent>\n';}
    function call(n,vars){return '<CallSequence $$id="call_'+n+'" requestable=".'+n+'"><Variables>'+(vars||'')+'</Variables></CallSequence>';}
    function variable(n,value){return '<Variable name="'+n+'" value="'+xml(value)+'" />';}
    function link(pid,label){return '<LinkButton $$id="link_'+pid+'" label="'+xml(label)+'" page="'+pid+'" />';}
    page('crud/', 'crud_home','CRUD Flow',ordered.map(function(e){return link(e.name+'_list',e.label || e.name);}).join('')+'<Button $$id="login" label="Connexion démo"><Events><OnClick $$id="loginClick"><Actions>'+call(prefix+'_demo_login',variable('user','editor'))+'<Navigate $$id="signedIn" page="'+ordered[0].name+'_list" /></Actions></OnClick></Events></Button>','');
    ordered.forEach(function(e){var n=prefix+'_'+e.name,k=e.key[0],detail=e.name+'_detail',form=e.name+'_form',list=e.name+'_list';
      var rows='<ForEach $$id="rows" source="@.'+n+'_list.page.rows" context="row"><Children>'+e.ui.listFields.map(function(f){return '<Text $$id="field_'+f+'" text="@row.values.'+f+'" />';}).join('')+'<Button $$id="open" label="Détail"><Events><OnClick $$id="openClick"><Actions><Navigate $$id="goDetail" page="'+detail+'"><Query>'+variable('id','@row.key.'+k)+'</Query></Navigate></Actions></OnClick></Events></Button></Children></ForEach>';
      page(e.name+'/',list,e.label || e.name,link('crud_home','Accueil')+link(form,'Nouveau')+rows,call(n+'_list'));
      var detailBody=link(list,'Liste')+e.fields.map(function(f){return '<Text $$id="detail_'+f.name+'" text="@.'+n+'_read.row.values.'+f.name+'" />';}).join('');
      if(!e.readOnly)detailBody+='<Button $$id="edit" label="Modifier"><Events><OnClick $$id="editClick"><Actions><Navigate $$id="goEdit" page="'+form+'"><Query>'+variable('id','@route.query.id')+'</Query></Navigate></Actions></OnClick></Events></Button><Button $$id="delete" label="Supprimer"><Events><OnClick $$id="deleteClick"><Actions>'+call(n+'_delete',variable('id','@route.query.id')+variable('revision','@.'+n+'_read.row.values.'+e.revision))+'<Navigate $$id="deleted" page="'+list+'" /></Actions></OnClick></Events></Button>';
      page(e.name+'/detail/',detail,e.name+' · détail',detailBody,call(n+'_read',variable('id','@route.query.id')));
      var defaults={};e.ui.formFields.forEach(function(f){var field=e.fields.filter(function(x){return x.name===f;})[0];defaults[f]=own(field,'default')?field.default:'';});
      var controls=e.ui.formFields.map(function(f){var field=e.fields.filter(function(x){return x.name===f;})[0],rel=relations.filter(function(r){return r.from.entity===e.name&&r.from.field===f;})[0],tag=rel?'Select':'Input';return '<'+tag+' $$id="input_'+f+'" name="'+f+'" label="'+xml(field.label || f)+'" value="@page.form.'+f+'" required={'+(!field.nullable)+'}'+(rel?' options="@.'+prefix+'_'+rel.to.entity+'_options.rows"':'')+'><Events><OnChange $$id="change_'+f+'"><Actions><JsonPut $$id="keep_'+f+'" path="page.form" key="'+f+'" value="@event.value" /></Actions></OnChange></Events></'+tag+'>';}).join('');
      var load=relations.filter(function(r){return r.from.entity===e.name;}).map(function(r){return call(prefix+'_'+r.to.entity+'_options');}).join('')+'<If $$id="editing" test="@route.query.id"><Then>'+call(n+'_read',variable('id','@route.query.id'))+'<SetValue $$id="loadForm" target="page.form" value="@.'+n+'_read.row.values" /><SetValue $$id="loadRevision" target="page.revision" value="@.'+n+'_read.row.values.'+e.revision+'" /></Then></If>';
      // Only writable values enter the patch: projected identity/revision remain outside form state.
      load=load.replace('<SetValue $$id="loadForm" target="page.form" value="@.'+n+'_read.row.values" />',function(){return e.ui.formFields.map(function(f){return '<JsonPut $$id="load_'+f+'" path="page.form" key="'+f+'" value="@.'+n+'_read.row.values.'+f+'" />';}).join('');});
      page(e.name+'/form/',form,e.name+' · formulaire',link(list,'Liste')+'<Form $$id="editorForm"><Children>'+controls+'<Button $$id="save" label="Enregistrer" type="submit" /></Children><Events><OnSubmit $$id="submit"><Actions><JsonStringify $$id="serializedPatch" value="@page.form" />'+call(n+'_save',variable('id','@route.query.id')+variable('revision','@page.revision')+variable('patch','@serializedPatch'))+'<Navigate $$id="saved" page="'+list+'" /></Actions></OnSubmit></Events></Form>',load,'<State $$id="form" type="object" value={'+JSON.stringify(defaults)+'} /><State $$id="revision" type="string" value="" />');
    });
    files['_flow/resources/sql/crud/schema.json']=json({version:s.schemaVersion,tables:tables})+'\n';
    files['_flow/resources/sql/crud/data.json']=json({tables:seed})+'\n';
    files['_flow/resources/sql/crud/spec.json']=json(raw)+'\n';
    return {files:files,flows:flows,config:config,initializer:prefix+'_initialize',entities:ordered.map(function(e){return e.name;}),schemaVersion:s.schemaVersion};
  }
  function disk(root) {
    var File=Packages.java.io.File,Utils=Packages.org.apache.commons.io.FileUtils;
    var base=new File(root).getCanonicalFile();
    function file(path){var f=new File(base,path).getCanonicalFile();if(!String(f).startsWith(String(base)+File.separator))fail('Path escapes project');return f;}
    return {read:function(p){var f=file(p);return f.isFile()?String(Utils.readFileToString(f,'UTF-8')):null;},write:function(p,t){Utils.writeStringToFile(file(p),t,'UTF-8');}};
  }
  function upsert(ctx,args) {
    if(!args.project || String(args.project).indexOf('lib_')===0)fail('Explicit application project required');
    var compiled=compile(args.spec,args.project),fs=disk(args.projectDir),manifestPath='_flow/resources/sql/crud/manifest.json',prior=JSON.parse(fs.read(manifestPath)||'{"files":{}}'),all=copy(compiled.files),changed=[];
    Object.keys(compiled.flows).forEach(function(n){all['_flow/flows/'+n+'.flow.js']=compiled.flows[n];});
    if(!/(^|\n)\/_flow\/(\r?\n|$)/.test(fs.read('.httpignore')||''))fail('Protect /_flow/ with .httpignore before generation');
    Object.keys(all).forEach(function(p){var live=fs.read(p);if(live!==null && live!==all[p] && (!own(prior.files,p)||prior.files[p]!==live))throw new Error('FLOW_CRUD_GENERATED_CONFLICT: '+p);if(live!==all[p])changed.push(p);});
    Object.keys(prior.files).forEach(function(p){if(!own(all,p))throw new Error('FLOW_CRUD_REMOVAL_UNSUPPORTED: '+p);});
    if(args.dryRun===true)return {ok:true,dryRun:true,changed:changed,entities:compiled.entities,schemaVersion:compiled.schemaVersion};
    fs.write(manifestPath,json({specVersion:1,schemaVersion:compiled.schemaVersion,pending:true,files:all})+'\n');
    Object.keys(compiled.files).forEach(function(p){if(fs.read(p)!==all[p])fs.write(p,all[p]);});
    Object.keys(compiled.flows).forEach(function(n){var p='_flow/flows/'+n+'.flow.js';if(changed.indexOf(p)<0){ctx.lib('mcp').registerFlowDbo({project:args.project,name:n,refresh:false,saveProject:false},{code:fs.read(p),format:'flowscript',flowMetadata:{authenticatedContextRequired:n!==compiled.initializer && !/_(demo_login|runtime_proof)$/.test(n)}});return;}
      var set=ctx.flowCodeSet({project:args.project,projectDir:args.projectDir,name:n,code:compiled.flows[n]});
      if(set.ok===false)throw new Error('FLOW_CRUD_COMPILE_FAILED: '+n+' '+JSON.stringify(set.error));
      var promoted=ctx.flowCodePromote({project:args.project,projectDir:args.projectDir,name:n,revision:set.revision,saveProject:true});
      if(promoted.ok===false)throw new Error('FLOW_CRUD_PROMOTE_FAILED: '+n+' '+JSON.stringify(promoted.error));
      ctx.lib('mcp').registerFlowDbo({project:args.project,name:n,refresh:false,saveProject:false},Object.assign({},promoted,{code:fs.read(p),format:'flowscript',flowMetadata:set.flowMetadata,inputDefinitions:set.inputDefinitions,inputVariables:set.inputVariables}));
    });
    ctx.cacheClear();
    var initialized=ctx.callBlock('requestable.call',{requestable:args.project+'.'+compiled.initializer,variables:{}},{trace:false});
    if(initialized && (initialized.ok===false || initialized.error || initialized.result && initialized.result.error))throw new Error('FLOW_CRUD_INITIALIZE_FAILED: '+JSON.stringify(initialized));
    fs.write(manifestPath,json({specVersion:1,schemaVersion:compiled.schemaVersion,files:all})+'\n');
    return {ok:true,changed:changed,flowCount:Object.keys(compiled.flows).length,entities:compiled.entities,schemaVersion:compiled.schemaVersion,initialized:initialized};
  }
  function proof(ctx,args){
    var fs=disk(args.projectDir),raw=fs.read('_flow/resources/sql/crud/spec.json');if(!raw)fail('No generated spec');var s=JSON.parse(raw),c=compile(s,args.project),checks=[];
    Object.keys(c.files).forEach(function(p){checks.push({kind:'artifact',path:p,ok:fs.read(p)===c.files[p]});});
    Object.keys(c.flows).forEach(function(n){checks.push({kind:'flow',name:n,ok:fs.read('_flow/flows/'+n+'.flow.js')===c.flows[n]});});
    var runtime=ctx.callBlock('requestable.call',{requestable:args.project+'.'+(s.facade && s.facade.prefix || 'crud')+'_runtime_proof',variables:{}},{trace:false});
    checks.push({kind:'runtime',ok:!!runtime && !runtime.error});
    return {ok:checks.every(function(x){return x.ok;}),schemaVersion:s.schemaVersion,checks:checks,runtime:runtime,runtimeEvidence:'HTTP session and browser checks must run with independent cookies; MCP session cannot prove end-user rights.'};
  }
  return {compile:compile,upsert:upsert,proof:proof};
}())
