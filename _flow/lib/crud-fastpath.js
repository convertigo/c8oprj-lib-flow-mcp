/* MCP authoring compiler. No SQL runtime: generated Flows call the SQL/data libraries. */
(function () {
  function fail(message) { throw new Error('FLOW_CRUD_SPEC_INVALID: ' + message); }
  function id(value) { if (['__proto__','constructor','prototype'].indexOf(String(value))>=0 || !/^[A-Za-z_][A-Za-z0-9_]{0,47}$/.test(String(value))) fail('Invalid identifier: ' + value); return String(value); }
  function json(value) { return JSON.stringify(value, null, 2); }
  function own(o,k) { return Object.prototype.hasOwnProperty.call(o,k); }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function quote(n) { return '"' + id(n) + '"'; }
  function xml(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
  function compile(raw, project, services) {
    services=services||{};
    var normalized=services.model?services.model.normalize(raw,project,services.legacy):{internal:copy(raw),legacy:false,diagnostics:[]};
    if(normalized.diagnostics.some(function(d){return d.severity==='error';}))fail(JSON.stringify(normalized.diagnostics));
    var isLegacy=normalized.legacy,s=normalized.internal; if(services.schemaVersion)s.schemaVersion=services.schemaVersion;
    var entities={}, relations=s.relations || [], files={}, flows={}, tables=[], seed=[], sources={}, queries={}, writes={};
    id(project);if(['__proto__','constructor','prototype'].indexOf(project)>=0)fail('Reserved project name');
    if(s.specVersion!==1 || !Number.isInteger(s.schemaVersion) || s.schemaVersion<1) fail('specVersion:1 and positive schemaVersion required');
    if(!Array.isArray(s.entities) || !s.entities.length || s.entities.length>32) fail('1..32 entities required');
    if(s.seed && s.seed.reset===true && s.seed.demo!==true)fail('Reset needs explicit demo:true');
    var prefix=id(s.facade && s.facade.prefix || 'crud'), db=s.database || {}, connection=id(db.connection || 'crud');
    if(['hsqldb','postgresql'].indexOf(db.dialect)<0) fail('Only Querydsl-qualified HSQLDB/PostgreSQL');
    if(db.dialect==='hsqldb' && /;shutdown=true/i.test(db.url || '')) fail('Use shutdown=false for concurrent requests');
    if(db.schema)id(db.schema);
    if(db.password && !/^\$\{[A-Za-z0-9_.-]+\.secret=?\}$/.test(db.password)) fail('Use server secret symbols; literal passwords are not accepted');
    s.security=s.security||{};s.security.principals=s.security.principals||{};
    Object.keys(s.security.principals).forEach(function(p){id(s.security.principals[p]);});
    s.entities.forEach(function(e){
      id(e.name); if(own(entities,e.name)) fail('Duplicate entity'); entities[e.name]=e;
      if(e.permissions!==undefined && (!e.permissions||typeof e.permissions!=='object'||Array.isArray(e.permissions)))fail('permissions must be an operation map');
      Object.keys(e.permissions||{}).forEach(function(operation){if(['list','read','count','create','update','save','delete'].indexOf(operation)<0)fail('Unknown permission operation '+operation);});
      if(!Array.isArray(e.fields) || e.fields.length>120) fail('Bounded fields required');
      var seen={}; e.fields.forEach(function(f){id(f.name);if(own(seen,f.name))fail('Duplicate field');seen[f.name]=true;
        if(['string','int64','decimal','boolean','date'].indexOf(f.type)<0)fail('Unsupported type');
        if(f.type==='string' && (!Number.isInteger(f.length) || f.length<1 || f.length>65536))fail('Bounded string length required');
        if(own(f,'default') && f.default!==null){if((f.type==='int64'||f.type==='decimal') && typeof f.default!=='string')fail('Exact numeric defaults are strings');if(f.type==='boolean' && typeof f.default!=='boolean')fail('Boolean default required');}
      });
      if(!e.key || e.key.length!==1 || !e.fields.some(function(f){return f.name===e.key[0] && f.type==='int64' && f.identity===true;}))fail('Prototype requires single generated int64 key');
      if(e.revision){id(e.revision);if(!own(seen,e.revision)) e.fields.push({name:e.revision,type:'int64',default:'1'});else {var r=e.fields.filter(function(f){return f.name===e.revision;})[0];if(r.type!=='int64'||r.nullable||r.identity)fail('Revision must be nonnullable int64');}}

      e.ui=e.ui || {};e.ui.labelField=e.ui.labelField || e.key[0];
      ['labelField'].forEach(function(k){if(!e.fields.some(function(f){return f.name===e.ui[k];}))fail('Unknown UI field');});
      ['listFields','formFields'].forEach(function(k){e.ui[k]=e.ui[k] || e.fields.filter(function(f){return !f.identity && f.name!==e.revision;}).map(function(f){return f.name;});e.ui[k].forEach(function(n){if(!e.fields.some(function(f){return f.name===n;}))fail('Unknown UI field '+n);});});
    });
    relations.forEach(function(r){id(r.name);if(r.kind!=='many-to-one')fail('Prototype supports many-to-one');
      var from=entities[r.from.entity],to=entities[r.to.entity];if(!from||!to)fail('Unknown relation entity');
      var ff=from.fields.filter(function(f){return f.name===r.from.field;})[0],tf=to.fields.filter(function(f){return f.name===r.to.field;})[0];
      if(!ff||!tf||ff.type!==tf.type||r.to.field!==to.key[0])fail('Relation must target compatible primary key');

    });
    var visited={},active={};function visit(e){if(active[e.name])fail('Cyclic relations unsupported');if(visited[e.name])return;active[e.name]=true;relations.filter(function(r){return r.from.entity===e.name;}).forEach(function(r){visit(entities[r.to.entity]);});delete active[e.name];visited[e.name]=true;tables.push(e);}
    s.entities.forEach(visit);
    var ordered=tables;tables=[];
    ordered.forEach(function(e){
      var columns=e.fields.map(function(f){var c={name:f.column||f.name,type:f.type};['nullable','identity','length','precision','scale','default'].forEach(function(k){if(own(f,k))c[k]=f[k];});return c;});
      var table={name:e.name,columns:columns,primaryKey:e.key};
      table.unique=e.fields.filter(function(f){return f.unique;}).map(function(f){return {name:id(e.name+'_'+f.name+'_uq'),columns:[f.name]};});
      table.foreignKeys=relations.filter(function(r){return r.from.entity===e.name;}).map(function(r){return {name:r.name,columns:[r.from.field],references:{table:r.to.entity,columns:[r.to.field]}};});tables.push(table);
      seed.push({table:e.name,key:e.key,rows:(s.seed && s.seed.data && s.seed.data[e.name]) || []});
      var source={provider:'sql',connection:connection,schema:db.schema,table:e.name,readOnly:true,includeTotal:true,requireProjection:true,fields:e.fields.map(function(f){return {name:f.name,column:f.column||f.name,label:f.label || f.name};})};
      sources[e.name+'_read']=source;
      if(!e.readOnly){var writable=copy(source);writable.readOnly=false;if(e.revision)writable.versionColumn=e.revision;else writable.optimisticConcurrency=false;writable.writableFields=e.fields.filter(function(f){return !f.identity && f.name!==e.revision && !f.readOnly;}).map(function(f){return f.name;});sources[e.name+'_write']=writable;}
      var qtable=quote(db.schema || (db.dialect==='postgresql'?'public':'PUBLIC'))+'.'+quote(e.name), cols=e.fields.map(function(f){return quote(f.column||f.name);}).join(', ');
      queries[e.name+'_count']={connection:connection,readOnly:true,expose:false,sql:'SELECT COUNT(*) AS "total" FROM '+qtable,parameters:[],columns:[{name:'total',type:'int64',nullable:false}]};
      queries[e.name+'_read']={connection:connection,readOnly:true,expose:false,sql:'SELECT '+cols+' FROM '+qtable+' WHERE '+quote(e.key[0])+'=:id',parameters:[{name:'id',type:'int64'}],columns:e.fields.map(function(f){return {name:f.name,type:f.type,nullable:f.nullable===true};})};
      queries[e.name+'_options']={connection:connection,readOnly:true,expose:false,maxRows:200,sql:'SELECT '+quote(e.key[0])+' AS "value", '+quote(e.ui.labelField)+' AS "label" FROM '+qtable+' ORDER BY '+quote(e.key[0]),parameters:[],columns:[{name:'value',type:'int64',nullable:false},{name:'label',type:e.fields.filter(function(f){return f.name===e.ui.labelField;})[0].type,nullable:false}]};
      if(!e.readOnly){var fields=e.fields.filter(function(f){return !f.identity && f.name!==e.revision && !f.readOnly;}),params=fields.map(function(f){var p={name:f.name,type:f.type,nullable:f.nullable===true};if(own(f,'default'))p.default=f.default;return p;});
        writes[e.name+'_insert']={connection:connection,operation:'insert',sql:'INSERT INTO '+qtable+' ('+fields.map(function(f){return quote(f.column||f.name);}).join(', ')+') VALUES ('+fields.map(function(f){return ':'+f.name;}).join(', ')+')',parameters:params,generatedKey:{column:e.key[0],type:'int64'},minAffectedRows:1,maxAffectedRows:1};
        writes[e.name+'_update']={connection:connection,operation:'update',sql:'UPDATE '+qtable+' SET '+fields.map(function(f){return quote(f.column||f.name)+'=:'+f.name;}).join(', ')+(e.revision?', '+quote(e.revision)+'='+quote(e.revision)+'+1':'')+' WHERE '+quote(e.key[0])+'=:id'+(e.revision?' AND '+quote(e.revision)+'=:revision':''),parameters:params.concat([{name:'id',type:'int64'}]).concat(e.revision?[{name:'revision',type:'int64'}]:[]),minAffectedRows:1,maxAffectedRows:1};
        writes[e.name+'_delete']={connection:connection,operation:'delete',sql:'DELETE FROM '+qtable+' WHERE '+quote(e.key[0])+'=:id'+(e.revision?' AND '+quote(e.revision)+'=:revision':''),parameters:[{name:'id',type:'int64'}].concat(e.revision?[{name:'revision',type:'int64'}]:[]),minAffectedRows:1,maxAffectedRows:1};
      }
    });
    // Validate declarations at authoring time, before any generated file is written.
    Object.keys(queries).concat(Object.keys(writes)).forEach(function(name){
      var declaration=queries[name] || writes[name],used={},declared={},match,rx=/:([A-Za-z_][A-Za-z0-9_]*)/g;
      while((match=rx.exec(declaration.sql)))used[match[1]]=true;
      declaration.parameters.forEach(function(p){if(own(declared,p.name)||!own(used,p.name))fail('Unused/duplicate named parameter '+name+'.'+p.name);declared[p.name]=true;});
      Object.keys(used).forEach(function(p){if(!own(declared,p))fail('Undeclared named parameter '+name+'.'+p);});
    });
    var config={sql:{connections:{},initializers:{},queries:queries,writes:writes},data:{providers:{sql:{implementation:'sql.table'}},sources:sources},crud:{principals:s.security.principals,hasPrincipalMap:Object.keys(s.security.principals).length>0,demoLogin:s.security.demoLogin===true}};
    config.crud.generated={owner:services.model?services.model.path:'_flow/data/model.yaml',queries:Object.keys(queries),writes:Object.keys(writes),sources:Object.keys(sources)};
    config.sql.connections[connection]={url:db.url,dialect:db.dialect,driverClass:db.driverClass,user:db.user || '',password:db.password || '',nativeRead:true,nativeWrite:true};
    config.sql.initializers[prefix]={connection:connection,schema:db.schema,schemaFile:'_flow/resources/sql/crud/schema.json',dataFile:'_flow/resources/sql/crud/data.json',demo:!!(s.seed && s.seed.demo)};
    function flow(name,inputs,body,privateFlow){body=body.replace(/^(\s*)return ([a-zA-Z]+\.[a-zA-Z]+)\((.*)\)$/gm, '$1local.responseResult = $2($3)\n$1return local.responseResult');flows[name]='// @generated by flow-crud; owner: _flow/data/model.yaml; edit the model, call this Flow from business Flows.\nconst _flow = '+json({sourceVersion:2,accessibility:privateFlow?'private':'hidden',authenticatedContextRequired:!privateFlow,inputs:inputs,config:config})+'\n\nfunction '+name+'({input,config,result}) {\n'+body+'\n}\n';}
    function auth(entity,operation){
      var isWrite=['create','update','delete','save'].indexOf(operation)>=0,permissions=entity.permissions||{},roles=permissions[operation];
      if(roles===undefined && isWrite)roles=permissions.save;
      if(roles===undefined)roles=isWrite?['authenticated','editor']:['authenticated','reader','editor'];
      if(roles===false)roles=[];if(typeof roles==='string')roles=[roles];
      if(!Array.isArray(roles))fail('permissions.'+operation+' must contain server roles');roles.forEach(id);
      var denied=roles.length?roles.map(function(role){return 'local.role !== '+JSON.stringify(role);}).join(' && '):'true';
      return '  local.user = session.authenticatedUser({})\n  local.role = "authenticated"\n  if (config.crud.hasPrincipalMap) {\n    local.role = object.get({source:config.crud.principals,key:local.user})\n  }\n  if (!local.user) {\n    throw({code:"UNAUTHENTICATED",message:"Session required",status:401})\n  }\n  if ('+denied+') {\n    throw({code:"FORBIDDEN",message:"Role denied",status:403})\n  }\n';
    }
    flow(prefix+'_initialize',{},'  return sql.initialize({initializer:'+JSON.stringify(prefix)+',seed:'+(s.seed && s.seed.enabled!==false && db.schemaPolicy!=='observe')+',verifyOnly:'+(db.schemaPolicy==='observe')+',resetDemo:'+(s.seed && s.seed.reset===true)+'})',true);
    ordered.forEach(function(e){var n=prefix+'_'+e.name,k=e.key[0];
      flow(n+'_list',{offset:{type:'integer',default:0},limit:{type:'integer',default:20},filter:{type:'object',nullable:true,default:null},orderBy:{type:'string',default:k},direction:{type:'string',default:'asc'}},auth(e,'list')+'  return data.read({source:"'+e.name+'_read",offset:input.offset,limit:input.limit,filter:input.filter,orderBy:input.orderBy,direction:input.direction})');
      flow(n+'_read',{id:{type:'string'}},auth(e,'read')+'  local.response = data.read({source:"'+e.name+'_read",limit:1,filter:{field:"'+k+'",op:"eq",value:input.id}})\n  local.row = list.first({items:local.response.page.rows,fallback:null})\n  if (!local.row) {\n    throw({code:"NOT_FOUND",message:"Row absent",status:404})\n  }\n  return {row:local.row}');
      flow(n+'_count',{},auth(e,'count')+'  return sql.query({query:"'+e.name+'_count",parameters:{}})');
      flow(n+'_options',{},auth(e,'list')+'  return sql.query({query:"'+e.name+'_options",parameters:{},limit:200})');
      if(!e.readOnly){flow(n+'_save',{id:{type:'string',default:''},revision:{type:'string',default:''},patch:{type:'object'}},'  if (input.id === "") {\n'+auth(e,'create')+'    return data.write({source:"'+e.name+'_write",operation:"create",patch:input.patch})\n  }\n'+auth(e,'update')+'  return data.write({source:"'+e.name+'_write",operation:"update",key:{'+k+':input.id},revision:input.revision,patch:input.patch})');
      flow(n+'_delete',{id:{type:'string'},revision:{type:'string',default:''}},auth(e,'delete')+'  return data.write({source:"'+e.name+'_write",operation:"delete",key:{'+k+':input.id},revision:input.revision})');}
    });
    flow(prefix+'_runtime_proof',{},'  local.initialized = sql.initialize({initializer:'+JSON.stringify(prefix)+',seed:false,dryRun:true,verifyOnly:'+(db.schemaPolicy==='observe')+'})\n'+ordered.map(function(e){return '  result.'+e.name+' = sql.query({query:"'+e.name+'_count",parameters:{}})';}).join('\n'),true);
    flow(prefix+'_demo_login',{user:{type:'string'}},'  if (!config.crud.demoLogin) {\n    throw({code:"FORBIDDEN",message:"Demo login disabled",status:403})\n  }\n  local.role = object.get({source:config.crud.principals,key:input.user})\n  if (local.role !== "editor" && local.role !== "reader") {\n    throw({code:"FORBIDDEN",message:"Unknown demo account",status:403})\n  }\n  local.user = session.authenticate({user:input.user})\n  return {authenticated:true}',true);
    // Login must be HTTP-reachable only in an explicitly enabled demo. Its guard always remains server-side.
    flows[prefix+'_demo_login']=flows[prefix+'_demo_login'].replace('"accessibility": "private"','"accessibility": "hidden"');
    function page(route,pid,title,structure,events,state){var statuses=[],match,seenStatus={},rx=/<CallSequence \$\$id="([^"]+)"/g;while((match=rx.exec(structure+(events||'')))){if(!seenStatus[match[1]])statuses.push('<Status $$id="status_'+match[1]+'" actionId="'+match[1]+'" text="" showSuccess={false} />');seenStatus[match[1]]=true;}structure+=statuses.join('');var root='_flow/frontbuilder/svelte/model/'+project+'/src/routes/'+route;
      files[root+'+page.flow.svelte']='<!-- @generated by flow-crud; owner: _flow/data/model.yaml -->\n<script module>\nexport const _flow = '+json({sourceVersion:2,page:{id:pid,title:title}})+';\n</script>\n<FlowComponent $$id="'+pid+'" label="'+xml(title)+'">\n'+(state?'<Variables>'+state+'</Variables>':'')+'\n<Structure><PageShell $$id="shell" padding="24px" gap="16px"><Children><Text $$id="title" text="'+xml(title)+'" />'+structure+'</Children></PageShell></Structure>\n'+(events?'<Events><OnMount $$id="load"><Actions>'+events+'</Actions></OnMount></Events>':'')+'\n</FlowComponent>\n';}
    function call(n,vars){return '<CallSequence $$id="call_'+n+'" requestable=".'+n+'"><Variables>'+(vars||'')+'</Variables></CallSequence>';}
    function variable(n,value){return '<Variable name="'+n+'" value="'+xml(value)+'" />';}
    function link(pid,label){return '<LinkButton $$id="link_'+pid+'" label="'+xml(label)+'" page="'+pid+'" />';}
    if(!isLegacy){
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
    }
    var frontend=isLegacy?services.model.frontend(s):{status:'previous-prototype-pages',target:services.model&&services.model.visual};
    if(isLegacy)files['_flow/data/ui.generated.json']=json(frontend)+'\n';
    files['_flow/resources/sql/crud/schema.json']=json({version:s.schemaVersion,tables:tables})+'\n';
    files['_flow/resources/sql/crud/data.json']=json({tables:seed})+'\n';
    files['_flow/data/config.generated.json']=json(config)+'\n';
    return {files:files,flows:flows,frontend:frontend,config:config,initializer:prefix+'_initialize',entities:ordered.map(function(e){return e.name;}),schemaVersion:s.schemaVersion,normalized:s,legacy:isLegacy,diagnostics:normalized.diagnostics||[]};
  }
  function disk(root) {
    var File=Packages.java.io.File,Utils=Packages.org.apache.commons.io.FileUtils,base=new File(root).getCanonicalFile();
    function file(path){var f=new File(base,path).getCanonicalFile();if(!String(f).startsWith(String(base)+File.separator))fail('Path escapes project');return f;}
    return {root:base,read:function(p){var f=file(p);return f.isFile()?String(Utils.readFileToString(f,'UTF-8')):null;},write:function(p,t){Utils.writeStringToFile(file(p),t,'UTF-8');},exists:function(p){return file(p).isFile();},remove:function(p){Packages.java.nio.file.Files.deleteIfExists(file(p).toPath());}};
  }
  function digest(value){
    var bytes=Packages.java.security.MessageDigest.getInstance('SHA-256').digest(new Packages.java.lang.String(String(value)).getBytes('UTF-8')),out='';
    for(var i=0;i<bytes.length;i++)out+=('0'+((bytes[i]&255).toString(16))).slice(-2);return out;
  }
  function stable(value){if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(function(k){return JSON.stringify(k)+':'+stable(value[k]);}).join(',')+'}';return JSON.stringify(value);}
  function parseModel(text){
    try{return JSON.parse(text);}catch(notJson){
      var options=new Packages.org.yaml.snakeyaml.LoaderOptions();options.setAllowDuplicateKeys(false);options.setMaxAliasesForCollections(20);options.setCodePointLimit(524288);
      var yaml=new Packages.org.yaml.snakeyaml.Yaml(new Packages.org.yaml.snakeyaml.constructor.SafeConstructor(options));
      function convert(v){if(v===null)return null;if(['string','number','boolean'].indexOf(typeof v)>=0)return v;if(v instanceof Packages.java.util.Map){var o={},it=v.entrySet().iterator();while(it.hasNext()){var e=it.next(),k=String(e.getKey());if(['__proto__','constructor','prototype'].indexOf(k)>=0)fail('Reserved YAML key');o[k]=convert(e.getValue());}return o;}if(v instanceof Packages.java.util.List){var a=[];for(var i=0;i<v.size();i++)a.push(convert(v.get(i)));return a;}if(v instanceof Packages.java.lang.Boolean)return v.booleanValue();if(v instanceof Packages.java.lang.Number)return Number(v);if(v instanceof Packages.java.util.Date)fail('Quote YAML date/timestamp scalar values');return String(v);}
      return convert(yaml.load(text));
    }
  }
  function schemaShape(value){var d=copy(value);delete d.version;return stable(d);}
  function runtimePlan(ctx,args,c,fs){
    var cfg=copy(c.config),prefix=c.normalized.facade.prefix||'crud',definition=cfg.sql.initializers[prefix],schema=JSON.parse(c.files['_flow/resources/sql/crud/schema.json']);
    definition.schemaDocument=schema;definition.dataDocument=JSON.parse(c.files['_flow/resources/sql/crud/data.json']);
    var connection=cfg.sql.connections[definition.connection],newDatabase=false;
    if(connection.dialect==='hsqldb' && /^jdbc:hsqldb:file:/.test(connection.url)){
      var path=connection.url.substring('jdbc:hsqldb:file:'.length).split(';')[0].replace(/^\.\/\//,'');
      if(!fs.exists(path+'.properties')){
        if(c.normalized.database.schemaPolicy==='observe')return {ok:false,error:{code:'SQL_SCHEMA_DRIFT',message:'Observed database does not exist; no database was created.'}};
        newDatabase=true;connection.url='jdbc:hsqldb:mem:flow_crud_plan_'+String(Packages.java.lang.System.nanoTime())+';shutdown=true';
      }
    }
    var source='const _flow = {sourceVersion:2}\nfunction CrudPlan({input,config,result}) {\n local.plan = sql.initialize({initializer:'+JSON.stringify(prefix)+',dryRun:true,seed:'+(c.normalized.seed.enabled!==false && c.normalized.database.schemaPolicy!=='observe')+',verifyOnly:'+(c.normalized.database.schemaPolicy==='observe')+'})\n return local.plan\n}';
    var run;try{run=ctx.runFlowSource(source,cfg,{project:args.project,projectDir:args.projectDir,input:{},includeTrace:false});}
    catch(error){return {ok:false,error:{code:String(error.code||error.flowSql&&error.flowSql.code||'FLOW_CRUD_SQL_PLAN_FAILED'),message:String(error.message||'SQL preview failed')}};}
    if(run.ok===false||run.error)return {ok:false,error:run.error||run};
    var result=run.result || run;result.newDatabase=newDatabase;return result;
  }
  function prepare(ctx,args){
    if(!args.project||String(args.project).indexOf('lib_')===0)fail('Explicit application project required');
    var model=ctx.lib('crud-model'),legacy=ctx.lib('crud-legacy'),fs=disk(args.projectDir),modelText=fs.read(model.path),oldText=fs.read('_flow/resources/sql/crud/spec.json');
    var raw=args.spec!==undefined?copy(args.spec):modelText?parseModel(modelText):oldText?JSON.parse(oldText):null;
    if(!raw)fail('Supply spec or create '+model.path);
    var normalized=model.normalize(raw,args.project,legacy),manifestPath='_flow/resources/sql/crud/manifest.json',priorText=fs.read(manifestPath),prior=JSON.parse(priorText||'{"files":{}}');
    var diagnostics=normalized.diagnostics.slice(),c=null,changed=[],conflicts=[],sql=null,all={},version=raw.schemaVersion||prior.schemaVersion||1;
    if(prior.pending===true && prior.modelHash!==digest(stable(raw)))diagnostics.push({code:'FLOW_CRUD_PENDING_DIFFERENT_MODEL',severity:'error',message:'Resume the pending model before applying a different model.'});
    if(!diagnostics.some(function(d){return d.severity==='error';})){
      c=compile(raw,args.project,{model:model,legacy:legacy,schemaVersion:version});
      var previousSchema=fs.read('_flow/resources/sql/crud/schema.json');
      if(raw.schemaVersion===undefined && previousSchema && schemaShape(JSON.parse(previousSchema))!==schemaShape(JSON.parse(c.files['_flow/resources/sql/crud/schema.json']))){version=JSON.parse(previousSchema).version+1;c=compile(raw,args.project,{model:model,legacy:legacy,schemaVersion:version});}
      all=copy(c.files);Object.keys(c.flows).forEach(function(n){all['_flow/flows/'+n+'.flow.js']=c.flows[n];});
      Object.keys(all).forEach(function(p){var live=fs.read(p),recoverable=prior.pending===true&&prior.previousFiles&&prior.previousFiles[p]===live;if(live!==null&&live!==all[p]&&!recoverable&&(!own(prior.files,p)||prior.files[p]!==live))conflicts.push(p);if(live!==all[p])changed.push(p);});
      Object.keys(prior.files).forEach(function(p){if(!own(all,p)&&p!=='_flow/resources/sql/crud/spec.json')diagnostics.push({code:'FLOW_CRUD_REMOVAL_UNSUPPORTED',severity:'error',path:p});});
      if(!/(^|\n)\/_flow\/(\r?\n|$)/.test(fs.read('.httpignore')||''))diagnostics.push({code:'FLOW_CRUD_HTTPIGNORE_REQUIRED',severity:'error'});
      conflicts.forEach(function(p){diagnostics.push({code:'FLOW_CRUD_GENERATED_CONFLICT',severity:'error',path:p});});
      if(!diagnostics.some(function(d){return d.severity==='error';})){
        sql=runtimePlan(ctx,args,c,fs);if(sql.ok===false||sql.error)diagnostics.push({code:sql.error&&sql.error.code||'FLOW_CRUD_PLAN_FAILED',severity:'error',details:sql.error||sql});
      }
    }
    var databaseApplied=sql&&sql.ok!==false&&sql.plan&&sql.plan.statements.length===0&&(normalized.internal.database.schemaPolicy==='observe'||sql.previousVersion===version);
    var applied=!!databaseApplied && prior.pending!==true && prior.modelHash===digest(stable(raw)) && changed.length===0 && !diagnostics.length;
    var plan={version:1,modelPath:model.path,modelRevision:digest(modelText||''),modelHash:digest(stable(raw)),schemaVersion:version,applied:applied,applicable:!diagnostics.some(function(d){return d.severity==='error';}),changed:changed,conflicts:conflicts,sql:sql,diagnostics:diagnostics,frontend:c?c.frontend:model.visual,generated: c?Object.keys(all).map(function(p){return {path:p,generated:true,owner:model.path,readOnly:true};}):[]};
    plan.planHash=digest(stable({raw:raw,prior:priorText,model:modelText,artifacts:Object.keys(all).map(function(p){return [p,fs.read(p)];}),expected:all,sql:sql,version:3}));
    plan.studio=model.studio(raw,c,plan); // Avoid a cyclic plan -> studio -> plan value.
    plan.studio.migration={applied:plan.applied,applicable:plan.applicable,schemaVersion:version,sql:sql,diagnostics:diagnostics,planHash:plan.planHash};
    return {plan:plan,compiled:c,fs:fs,raw:raw,all:all,prior:prior,manifestPath:manifestPath,modelText:modelText,model:model};
  }
  function applyOrPreview(ctx,args){
    var prepared=prepare(ctx,args),plan=prepared.plan,c=prepared.compiled,fs=prepared.fs;
    if(args.dryRun===true || !args.planHash)return Object.assign({ok:true,dryRun:true,status:plan.applied?'applied':plan.applicable?'pending':'blocked',requiresPlanHash:true},plan);
    if(!plan.applicable)throw Error('FLOW_CRUD_PLAN_BLOCKED: '+JSON.stringify(plan.diagnostics));
    if(args.planHash!==plan.planHash)throw Error('FLOW_CRUD_PLAN_STALE: preview again; model, generated files or database plan changed');
    var modelSource=args.spec!==undefined?json(args.spec)+'\n':prepared.modelText || json(prepared.raw)+'\n';
    fs.write(prepared.model.path,modelSource);
    fs.write(prepared.manifestPath,json({version:2,owner:prepared.model.path,modelHash:plan.modelHash,schemaVersion:plan.schemaVersion,pending:true,files:prepared.all,previousFiles:prepared.prior.pending?prepared.prior.previousFiles||{}:prepared.prior.files})+'\n');
    Object.keys(c.files).forEach(function(p){if(fs.read(p)!==c.files[p])fs.write(p,c.files[p]);});
    Object.keys(c.flows).forEach(function(n){
      var p='_flow/flows/'+n+'.flow.js',set,promoted;
      if(plan.changed.indexOf(p)>=0){
        set=ctx.flowCodeSet({project:args.project,projectDir:args.projectDir,name:n,code:c.flows[n]});if(set.ok===false)throw Error('FLOW_CRUD_COMPILE_FAILED: '+n+' '+JSON.stringify(set.error));
        promoted=ctx.flowCodePromote({project:args.project,projectDir:args.projectDir,name:n,revision:set.revision,saveProject:false});if(promoted.ok===false)throw Error('FLOW_CRUD_PROMOTE_FAILED: '+n);
      }
      ctx.lib('mcp').registerFlowDbo({project:args.project,name:n,refresh:false,saveProject:false},{code:fs.read(p),format:'flowscript',flowMetadata:{authenticatedContextRequired:n!==c.initializer&&!/_(demo_login|runtime_proof)$/.test(n)},inputDefinitions:set&&set.inputDefinitions,inputVariables:set&&set.inputVariables});
    });
    ctx.cacheClear();
    var initialized=ctx.callBlock('requestable.call',{requestable:args.project+'.'+c.initializer,variables:{}},{trace:false});
    if(initialized&&(initialized.ok===false||initialized.error||initialized.result&&initialized.result.error))throw Error('FLOW_CRUD_INITIALIZE_FAILED: '+JSON.stringify(initialized));
    fs.write(prepared.manifestPath,json({version:2,owner:prepared.model.path,modelHash:plan.modelHash,schemaVersion:plan.schemaVersion,pending:false,files:prepared.all})+'\n');
    if(own(prepared.prior.files,'_flow/resources/sql/crud/spec.json'))fs.remove('_flow/resources/sql/crud/spec.json');
    plan.studio.applied=true;plan.studio.migration.applied=true;plan.studio.migration.planWasApplied=true;
    return {ok:true,applied:true,modelPath:prepared.model.path,modelHash:plan.modelHash,schemaVersion:plan.schemaVersion,changed:plan.changed,flowCount:Object.keys(c.flows).length,initialized:initialized,frontend:plan.frontend,studio:plan.studio};
  }
  function upsert(ctx,args){
    if(args.dryRun===true||!args.planHash)return applyOrPreview(ctx,args);
    var name=id(args.project),servlet=Packages.com.twinsoft.convertigo.engine.Engine.getServletContext();
    if(!servlet)throw Error('FLOW_CRUD_LOCK_UNAVAILABLE: apply requires the server project lock');
    var attribute='lib_flow_mcp.crudModelLocks';
    new Packages.org.mozilla.javascript.Synchronizer(function(){if(!servlet.getAttribute(attribute))servlet.setAttribute(attribute,new Packages.java.util.concurrent.ConcurrentHashMap());},servlet)();
    var locks=servlet.getAttribute(attribute);locks.putIfAbsent(name,new Packages.java.util.concurrent.locks.ReentrantLock());var lock=locks.get(name);
    if(!lock.tryLock(30,Packages.java.util.concurrent.TimeUnit.SECONDS))throw Error('FLOW_CRUD_APPLY_BUSY: another application is running');
    try{return applyOrPreview(ctx,args);}finally{lock.unlock();}
  }
  function proof(ctx,args){
    var p=prepare(ctx,args),plan=p.plan,checks=[];
    if(p.compiled){Object.keys(p.all).forEach(function(path){checks.push({path:path,generated:true,owner:p.model.path,ok:p.fs.read(path)===p.all[path]});});}
    checks.push({kind:'model-applied',ok:plan.applied});
    return {ok:checks.every(function(c){return c.ok;})&&plan.applicable,modelPath:p.model.path,modelRevision:plan.modelRevision,schemaVersion:plan.schemaVersion,status:plan.applied?'applied':'pending',checks:checks,sql:plan.sql,diagnostics:plan.diagnostics,studio:plan.studio,runtimeEvidence:'Read-only SQL plan and artifact checks; end-user permissions and UI require independent HTTP/browser proof.'};
  }
  function assertWritable(ctx,args){
    if(!args.project||!args.name)return;
    var root=args.projectDir;
    if(!root){var project=Packages.com.twinsoft.convertigo.engine.Engine.theApp.databaseObjectsManager.getOriginalProjectByName(String(args.project),false);if(!project)return;root=String(project.getDirPath());}
    var fs=disk(root),path='_flow/flows/'+id(args.name)+'.flow.js',text=fs.read('_flow/resources/sql/crud/manifest.json'),manifest=JSON.parse(text||'{\"files\":{}}');
    if(own(manifest.files,path)||(fs.read(path)||'').indexOf('// @generated by flow-crud;')===0){var error=Error('This Flow belongs to _flow/data/model.yaml. Edit the model and apply its plan; call the generated Flow from a business Flow.');error.code='FLOW_CRUD_GENERATED_READ_ONLY';throw error;}
  }
  return {compile:compile,upsert:upsert,proof:proof,prepare:prepare,assertWritable:assertWritable};
}())
