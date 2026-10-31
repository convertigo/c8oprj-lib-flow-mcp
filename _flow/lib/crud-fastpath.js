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
    // Optional sections take the defaults of the normalizer, whichever format and caller.
    s.facade=s.facade||{};s.ui=s.ui||{};s.ui.title=s.ui.title||project;s.seed=s.seed||{};s.relations=s.relations||[];
    var entities={}, relations=s.relations, files={}, flows={}, tables=[], seed=[], sources={}, queries={}, writes={};
    id(project);if(['__proto__','constructor','prototype'].indexOf(project)>=0)fail('Reserved project name');
    if(s.specVersion!==1 || !Number.isInteger(s.schemaVersion) || s.schemaVersion<1) fail('specVersion:1 and positive schemaVersion required');
    if(!Array.isArray(s.entities) || !s.entities.length || s.entities.length>32) fail('1..32 entities required');
    if(s.seed && s.seed.reset===true && s.seed.demo!==true)fail('Reset needs explicit demo:true');
    var prefix=id(s.facade && s.facade.prefix || 'crud'), db=s.database || {}, connection=id(db.connection || 'crud');
    if(['hsqldb','postgresql','mariadb'].indexOf(db.dialect)<0) fail('Only Querydsl-qualified HSQLDB/PostgreSQL/MariaDB');
    if(db.dialect==='hsqldb' && /;shutdown=true/i.test(db.url || '')) fail('Use shutdown=false for concurrent requests');
    function quote(n){return db.dialect==='mariadb'?'`'+id(n)+'`':'\"'+id(n)+'\"';}
    if(db.schema)id(db.schema);
    if(db.password && !/^\$\{[A-Za-z0-9_.-]+\.secret=?\}$/.test(db.password)) fail('Use server secret symbols; literal passwords are not accepted');
    s.security=s.security||{};s.security.principals=s.security.principals||{};
    Object.keys(s.security.principals).forEach(function(p){id(s.security.principals[p]);});
    s.entities.forEach(function(e){
      id(e.name); if(own(entities,e.name)) fail('Duplicate entity'); entities[e.name]=e;
      if(e.permissions!==undefined && (!e.permissions||typeof e.permissions!=='object'||Array.isArray(e.permissions)))fail('permissions must be an operation map');
      Object.keys(e.permissions||{}).forEach(function(operation){if(['list','read','count','create','update','save','delete'].indexOf(operation)<0)fail('Unknown permission operation '+operation);});
      e.generate=e.generate===undefined?'full':e.generate;if(['full','data','schema'].indexOf(e.generate)<0)fail('entities[].generate is "full", "data" or "schema"');
      if(!Array.isArray(e.fields) || e.fields.length>120) fail('Bounded fields required');
      var seen={}; e.fields.forEach(function(f){id(f.name);if(own(seen,f.name))fail('Duplicate field');seen[f.name]=true;
        if(['string','int64','decimal','boolean','date','timestamp'].indexOf(f.type)<0)fail('Unsupported type');
        if(f.type==='string' && (!Number.isInteger(f.length) || f.length<1 || f.length>65536))fail('Bounded string length required');
        if(own(f,'default') && f.default!==null){if((f.type==='int64'||f.type==='decimal') && typeof f.default!=='string')fail('Exact numeric defaults are strings');if(f.type==='boolean' && typeof f.default!=='boolean')fail('Boolean default required');}
      });
      if(!e.key || e.key.length!==1 || !e.fields.some(function(f){return f.name===e.key[0] && f.type==='int64' && f.identity===true;}))fail('Prototype requires single generated int64 key');
      if(e.revision){id(e.revision);if(!own(seen,e.revision)) e.fields.push({name:e.revision,type:'int64',default:'1'});else {var r=e.fields.filter(function(f){return f.name===e.revision;})[0];if(r.type!=='int64'||r.nullable||r.identity)fail('Revision must be nonnullable int64');}}

      // rowPolicy: the owner form only, {field, equals:"user"|"account.<field>", unrestricted:[roles]}.
      if(e.rowPolicy!==undefined){var rp=e.rowPolicy,owner=rp&&e.fields.filter(function(f){return f.name===rp.field;})[0];
        if(!rp||typeof rp!=='object'||Object.keys(rp).some(function(k){return ['field','equals','unrestricted'].indexOf(k)<0;})||!owner||owner.identity||!(rp.equals==='user'||/^account\.[A-Za-z_][A-Za-z0-9_]*$/.test(String(rp.equals)))||(rp.unrestricted!==undefined&&!Array.isArray(rp.unrestricted)))fail('rowPolicy of '+e.name+' supports only the owner form {field, equals:"user"|"account.<field>", unrestricted:[roles]} on a non-key field');
        rp.unrestricted=(rp.unrestricted||[]).map(id);}
      e.ui=e.ui || {};e.ui.labelField=e.ui.labelField || e.key[0];
      ['labelField'].forEach(function(k){if(!e.fields.some(function(f){return f.name===e.ui[k];}))fail('Unknown UI field');});
      ['listFields','formFields'].forEach(function(k){e.ui[k]=e.ui[k] || e.fields.filter(function(f){return !f.identity && f.name!==e.revision;}).map(function(f){return f.name;});e.ui[k].forEach(function(n){if(!e.fields.some(function(f){return f.name===n;}))fail('Unknown UI field '+n);});});
    });
    var accounts=s.security.accounts||null;
    if(accounts){var accountEntity=entities[accounts.entity];if(!accountEntity)fail('security.accounts.entity must name a model entity');
      function accountField(n,type){var f=accountEntity.fields.filter(function(x){return x.name===n;})[0];if(!f||f.type!==type)fail('security.accounts: '+n+' must be a '+type+' field of '+accounts.entity);}
      accountField(accounts.login,'string');if(accounts.active!==undefined)accountField(accounts.active,'boolean');}
    s.entities.forEach(function(e){if(e.rowPolicy&&e.rowPolicy.equals!=='user'){var column=e.rowPolicy.equals.slice(8);if(!accounts||!entities[accounts.entity].fields.some(function(f){return f.name===column;}))fail('rowPolicy of '+e.name+' equals '+e.rowPolicy.equals+': declare security.accounts with that field');}});
    if(s.ui.generate!==undefined&&['full','none'].indexOf(s.ui.generate)<0)fail('ui.generate is "full" or "none"');
    relations.forEach(function(r){id(r.name);if(r.kind!=='many-to-one')fail('Prototype supports many-to-one');
      var from=entities[r.from.entity],to=entities[r.to.entity];if(!from||!to)fail('Unknown relation entity');
      var ff=from.fields.filter(function(f){return f.name===r.from.field;})[0],tf=to.fields.filter(function(f){return f.name===r.to.field;})[0];
      if(!ff||!tf||ff.type!==tf.type||r.to.field!==to.key[0])fail('Relation must target compatible primary key');
      if(r.labelField&&!to.fields.some(function(f){return f.name===r.labelField;}))fail('Unknown relation optionLabelField');
      if(to.generate==='schema'&&from.generate==='full'&&s.ui.generate!=='none')fail('Relation '+r.name+': the generated form of '+from.name+' lists the options of '+to.name+', which generate: "schema" does not generate; generate '+to.name+' as "data", or '+from.name+' as "data" or "schema"');

    });
    var visited={},active={};function visit(e){if(active[e.name])fail('Cyclic relations unsupported');if(visited[e.name])return;active[e.name]=true;relations.filter(function(r){return r.from.entity===e.name;}).forEach(function(r){visit(entities[r.to.entity]);});delete active[e.name];visited[e.name]=true;tables.push(e);}
    s.entities.forEach(visit);
    var ordered=tables;tables=[];
    ordered.forEach(function(e){
      var columns=e.fields.map(function(f){var c={name:f.column||f.name,type:f.type};['nullable','identity','length','precision','scale','default','auto'].forEach(function(k){if(own(f,k))c[k]=f[k];});return c;});
      var table={name:e.name,columns:columns,primaryKey:e.key};
      table.unique=e.fields.filter(function(f){return f.unique;}).map(function(f){return {name:id(e.name+'_'+f.name+'_uq'),columns:[f.name]};});
      table.foreignKeys=relations.filter(function(r){return r.from.entity===e.name;}).map(function(r){return {name:r.name,columns:[r.from.field],references:{table:r.to.entity,columns:[r.to.field]}};});tables.push(table);
      seed.push({table:e.name,key:e.key,rows:(s.seed && s.seed.data && s.seed.data[e.name]) || []});
      var source={provider:'sql',connection:connection,schema:db.schema,table:e.name,readOnly:true,includeTotal:true,requireProjection:true,fields:e.fields.map(function(f){var out={name:f.name,column:f.column||f.name,label:f.label || f.name};if(f.auto)out.auto=f.auto;return out;})};
      sources[e.name+'_read']=source;
      if(!e.readOnly){var writable=copy(source);writable.readOnly=false;if(e.revision)writable.versionColumn=e.revision;writable.writableFields=e.fields.filter(function(f){return !f.identity && f.name!==e.revision && !f.readOnly;}).map(function(f){return f.name;});sources[e.name+'_write']=writable;}
      var qtable=quote(db.schema || (db.dialect==='postgresql'?'public':'PUBLIC'))+'.'+quote(e.name), cols=e.fields.map(function(f){return quote(f.column||f.name);}).join(', ');
      queries[e.name+'_count']={connection:connection,readOnly:true,expose:false,sql:'SELECT COUNT(*) AS "total" FROM '+qtable,parameters:[],columns:[{name:'total',type:'int64',nullable:false}]};
      if(e.generate==='schema')return; // Table, seed and data sources: business Flows own every access.
      queries[e.name+'_read']={connection:connection,readOnly:true,expose:false,sql:'SELECT '+cols+' FROM '+qtable+' WHERE '+quote(e.key[0])+'=:id',parameters:[{name:'id',type:'int64'}],columns:e.fields.map(function(f){return {name:f.name,type:f.type,nullable:f.nullable===true};})};
      if(e.rowPolicy){var ownerField=e.fields.filter(function(f){return f.name===e.rowPolicy.field;})[0];
        queries[e.name+'_owned']={connection:connection,readOnly:true,expose:false,sql:'SELECT '+quote(e.key[0])+' AS "id" FROM '+qtable+' WHERE '+quote(e.key[0])+'=:id AND '+quote(ownerField.column||ownerField.name)+'=:owner',parameters:[{name:'id',type:'int64'},{name:'owner',type:ownerField.type}],columns:[{name:'id',type:'int64',nullable:false}]};
        queries[e.name+'_count_owned']={connection:connection,readOnly:true,expose:false,sql:'SELECT COUNT(*) AS "total" FROM '+qtable+' WHERE '+quote(ownerField.column||ownerField.name)+'=:owner',parameters:[{name:'owner',type:ownerField.type}],columns:[{name:'total',type:'int64',nullable:false}]};}
      queries[e.name+'_options']={connection:connection,readOnly:true,expose:false,maxRows:200,sql:'SELECT '+quote(e.key[0])+' AS "value", '+quote(e.ui.labelField)+' AS "label" FROM '+qtable+' ORDER BY '+quote(e.key[0]),parameters:[],columns:[{name:'value',type:'int64',nullable:false},{name:'label',type:e.fields.filter(function(f){return f.name===e.ui.labelField;})[0].type,nullable:false}]};
      if(!e.readOnly){var fields=e.fields.filter(function(f){return !f.identity && f.name!==e.revision && (!f.readOnly||f.auto);}),updateFields=fields.filter(function(f){return f.auto!=='create';});function parameters(items){return items.map(function(f){var p={name:f.name,type:f.type,nullable:f.nullable===true};if(f.auto)p.auto=f.auto;if(own(f,'default'))p.default=f.default;return p;});}var params=parameters(fields);
        writes[e.name+'_insert']={connection:connection,operation:'insert',sql:'INSERT INTO '+qtable+' ('+fields.map(function(f){return quote(f.column||f.name);}).join(', ')+') VALUES ('+fields.map(function(f){return ':'+f.name;}).join(', ')+')',parameters:params,generatedKey:{column:e.key[0],type:'int64'},minAffectedRows:1,maxAffectedRows:1};
        writes[e.name+'_update']={connection:connection,operation:'update',sql:'UPDATE '+qtable+' SET '+updateFields.map(function(f){return quote(f.column||f.name)+'=:'+f.name;}).join(', ')+(e.revision?', '+quote(e.revision)+'='+quote(e.revision)+'+1':'')+' WHERE '+quote(e.key[0])+'=:id'+(e.revision?' AND '+quote(e.revision)+'=:revision':''),parameters:parameters(updateFields).concat([{name:'id',type:'int64'}]).concat(e.revision?[{name:'revision',type:'int64'}]:[]),minAffectedRows:1,maxAffectedRows:1};
        writes[e.name+'_delete']={connection:connection,operation:'delete',sql:'DELETE FROM '+qtable+' WHERE '+quote(e.key[0])+'=:id'+(e.revision?' AND '+quote(e.revision)+'=:revision':''),parameters:[{name:'id',type:'int64'}].concat(e.revision?[{name:'revision',type:'int64'}]:[]),minAffectedRows:1,maxAffectedRows:1};
      }
    });
    var optionQueries={},ownedOptionQueries={};ordered.forEach(function(e){if(e.generate==='schema')return;var choices={};choices[e.ui.labelField]=e.name+'_options';relations.filter(function(r){return r.to.entity===e.name&&r.labelField;}).forEach(function(r){if(own(choices,r.labelField))return;var name=id(e.name+'_opt_'+r.labelField),q=copy(queries[e.name+'_options']),f=e.fields.filter(function(f){return f.name===r.labelField;})[0];q.sql=q.sql.replace(quote(e.ui.labelField)+' AS \"label\"',quote(r.labelField)+' AS \"label\"');q.columns[1].type=f.type;q.columns[1].nullable=f.nullable===true;queries[name]=q;choices[r.labelField]=name;});optionQueries[e.name]=choices;
      // The options of a row-policy entity, for a restricted role: only the rows it owns.
      if(e.rowPolicy){var ownerField=e.fields.filter(function(f){return f.name===e.rowPolicy.field;})[0],owned={};Object.keys(choices).forEach(function(label){var q=copy(queries[choices[label]]);q.sql=q.sql.replace(' ORDER BY ',' WHERE '+quote(ownerField.column||ownerField.name)+'=:owner ORDER BY ');q.parameters=[{name:'owner',type:ownerField.type}];queries[choices[label]+'_owned']=q;owned[label]=choices[label]+'_owned';});ownedOptionQueries[e.name]=owned;}});
    // Validate declarations at authoring time, before any generated file is written.
    Object.keys(queries).concat(Object.keys(writes)).forEach(function(name){
      var declaration=queries[name] || writes[name],used={},declared={},match,rx=/:([A-Za-z_][A-Za-z0-9_]*)/g;
      while((match=rx.exec(declaration.sql)))used[match[1]]=true;
      declaration.parameters.forEach(function(p){if(own(declared,p.name)||!own(used,p.name))fail('Unused/duplicate named parameter '+name+'.'+p.name);declared[p.name]=true;});
      Object.keys(used).forEach(function(p){if(!own(declared,p))fail('Undeclared named parameter '+name+'.'+p);});
    });
    // The demo sign-in exists only with the generated sign-in page and an explicit security.demoLogin: true.
    var loginGenerated=s.ui.generate!=='none'&&s.ui.loginPage!==false,demoLogin=s.security.demoLogin===true&&loginGenerated;
    var config={sql:{connections:{},initializers:{},queries:queries,writes:writes},data:{providers:{sql:{implementation:'sql.table'}},sources:sources},crud:{principals:s.security.principals,hasPrincipalMap:Object.keys(s.security.principals).length>0,demoLogin:s.security.demoLogin===true&&loginGenerated}};
    config.crud.optionQueries=optionQueries;config.crud.ownedOptionQueries=ownedOptionQueries;
    config.crud.enums={};ordered.forEach(function(e){config.crud.enums[e.name]={};e.fields.forEach(function(f){if(f.enum)config.crud.enums[e.name][f.name]=f.enum;});});
    config.crud.generated={owner:services.model?services.model.path:'_flow/data/model.yaml',queries:Object.keys(queries),writes:Object.keys(writes),sources:Object.keys(sources)};
    config.sql.connections[connection]={url:db.url,dialect:db.dialect,driverClass:db.driverClass,user:db.user || '',password:db.password || '',nativeRead:true,nativeWrite:true};
    config.sql.initializers[prefix]={connection:connection,schema:db.schema,schemaFile:'_flow/resources/sql/crud/schema.json',dataFile:'_flow/resources/sql/crud/data.json',demo:!!(s.seed && s.seed.demo)};
    function flow(name,inputs,body,privateFlow,outputs){body=body.replace(/^(\s*)return ([a-zA-Z]+\.[a-zA-Z]+)\((.*)\)$/gm, '$1local.responseResult = $2($3)\n$1return local.responseResult');flows[name]='// @generated by flow-crud; owner: _flow/data/model.yaml; edit the model, call this Flow from business Flows.\nconst _flow = '+json({sourceVersion:2,accessibility:privateFlow?'private':'hidden',authenticatedContextRequired:!privateFlow,inputs:inputs,config:config,outputs:outputs||undefined})+'\n\nfunction '+name+'({input,config,result}) {\n'+body+'\n}\n';}
    // The roles of an operation. A data entity grants no generic write unless its permissions name the roles.
    function roleList(e,operation){
      var isWrite=['create','update','delete','save'].indexOf(operation)>=0,permissions=e.permissions||{},roles=permissions[operation];
      if(roles===undefined && isWrite)roles=permissions.save;
      if(roles===undefined)roles=isWrite?(e.generate==='data'?[]:['authenticated','editor']):['authenticated','reader','editor'];
      if(roles===false)roles=[];if(typeof roles==='string')roles=[roles];
      if(!Array.isArray(roles))fail('permissions.'+operation+' must contain server roles');roles.forEach(id);
      return roles;
    }
    function hasSave(e){return !e.readOnly&&(e.generate!=='data'||roleList(e,'create').length>0||roleList(e,'update').length>0);}
    function hasDelete(e){return !e.readOnly&&(e.generate!=='data'||roleList(e,'delete').length>0);}
    // security.accounts: the account row of the signed-in user; unknown or inactive accounts are refused.
    function accountLookup(user,onMissing){
      if(!accounts)return '';
      var out='  local.accountPage = data.read({source:"'+accounts.entity+'_read",limit:1,filter:{field:"'+accounts.login+'",op:"eq",value:'+user+'}})\n  local.account = list.first({items:local.accountPage.page.rows,fallback:null})\n  if (!local.account) {\n'+onMissing('Unknown account')+'  }\n';
      if(accounts.active)out+='  if (local.account.values.'+accounts.active+' !== true && local.account.values.'+accounts.active+' !== "true") {\n'+onMissing('Inactive account')+'  }\n';
      return out;
    }
    function refuse(message){return '    throw({code:"FORBIDDEN",message:"'+message+'",status:403})\n';}
    function auth(entity,operation){
      var roles=roleList(entity,operation);
      var denied=roles.length?roles.map(function(role){return 'local.role !== '+JSON.stringify(role);}).join(' && '):'true';
      var body='  local.user = session.authenticatedUser({})\n  local.role = "authenticated"\n  if (config.crud.hasPrincipalMap) {\n    local.role = object.get({source:config.crud.principals,key:local.user})\n  }\n  if (!local.user) {\n    throw({code:"UNAUTHENTICATED",message:"Session required",status:401})\n  }\n'+accountLookup('local.user',refuse)+'  if ('+denied+') {\n    throw({code:"FORBIDDEN",message:"Role denied",status:403})\n  }\n';
      // rowPolicy: a restricted role sees and writes only the rows whose owner field equals its session value.
      if(entity.rowPolicy){body+='  local.restricted = true\n'+entity.rowPolicy.unrestricted.map(function(role){return '  if (local.role === '+JSON.stringify(role)+') {\n    local.restricted = false\n  }\n';}).join('')+'  local.owner = '+(entity.rowPolicy.equals==='user'?'local.user':'local.account.values.'+entity.rowPolicy.equals.slice(8))+'\n';}
      return body;
    }
    function owned(e,idExpression){return e.rowPolicy?'  if (local.restricted) {\n    local.owned = sql.query({query:"'+e.name+'_owned",parameters:{id:'+idExpression+',owner:local.owner}})\n    local.ownedRow = list.first({items:local.owned.rows,fallback:null})\n    if (!local.ownedRow) {\n      throw({code:"NOT_FOUND",message:"Row absent",status:404})\n    }\n  }\n':'';}
    function ownerPatch(e){var f=e.rowPolicy&&e.fields.filter(function(x){return x.name===e.rowPolicy.field;})[0];return f&&!f.readOnly?'  if (local.restricted) {\n    json.put({path:"local.patch",key:"'+f.name+'",value:local.owner})\n  }\n':'';}
    function allowed(e,op){
      if(e.readOnly&&['create','update','delete'].indexOf(op)>=0)return 'false';
      if(op==='create'||op==='update'){if(!hasSave(e))return 'false';}else if(op==='delete'&&!hasDelete(e))return 'false';
      var roles=roleList(e,op);
      return roles.length?roles.map(function(r){return 'local.role === '+JSON.stringify(r);}).join(' || '):'false';
    }
    function rowSchema(e){var values={},keys={};e.fields.forEach(function(f){values[f.name]={type:f.type==='boolean'?'boolean':'string',nullable:f.nullable===true};});e.key.forEach(function(k){keys[k]={type:'string'};});return {type:'object',properties:{key:{type:'object',properties:keys},values:{type:'object',properties:values},displayValues:{type:'object',properties:values},revision:{type:'string'},canRead:{type:'boolean'},canUpdate:{type:'boolean'},canDelete:{type:'boolean'}}};}
    var accessSchema={},accessExpression=[];
    ordered.forEach(function(e){if(e.generate==='schema')return;var props={},members=[];['list','read','count','create','update','delete'].forEach(function(op){props[op]={type:'boolean'};members.push(JSON.stringify(op)+': '+(e.readOnly&&['create','update','delete'].indexOf(op)>=0?'false':'('+allowed(e,op)+')'));});accessSchema[e.name]={type:'object',properties:props};accessExpression.push(JSON.stringify(e.name)+': {'+members.join(',')+'}');});
    var sessionBody='  local.user = session.authenticatedUser({})\n  local.role = null\n'+(accounts?'  if (local.user) {\n'+accountLookup('local.user',function(){return '    local.user = null\n';}).replace(/^  if \(local\.account\.values/m,'  if (local.account && local.account.values')+'  }\n':'')+'  if (local.user) {\n    local.role = "authenticated"\n    if (config.crud.hasPrincipalMap) {\n      local.role = object.get({source:config.crud.principals,key:local.user})\n    }\n  }\n  result.authenticated = !!local.user\n  result.user = local.user\n  result.role = local.role\n  result.demoEnabled = config.crud.demoLogin\n  result.permissions = {'+accessExpression.join(',')+'}';
    flow(prefix+'_session',{},sessionBody,false,{type:'object',properties:{authenticated:{type:'boolean'},user:{type:'string',nullable:true},role:{type:'string',nullable:true},demoEnabled:{type:'boolean'},permissions:{type:'object',properties:accessSchema}}});
    flows[prefix+'_session']=flows[prefix+'_session'].replace('"authenticatedContextRequired": true','"authenticatedContextRequired": false');
    flow(prefix+'_logout',{},'  local.cleared = session.authenticate({user:""})\n  return {authenticated:false}',false,{type:'object',properties:{authenticated:{type:'boolean'}}});
    flows[prefix+'_logout']=flows[prefix+'_logout'].replace('"authenticatedContextRequired": true','"authenticatedContextRequired": false');
    function patchBody(e){
      var body='  local.patch = object.merge({target:{},source:input.patch})\n';
      e.fields.filter(function(f){return !f.identity&&f.name!==e.revision&&!f.readOnly;}).forEach(function(f){
        if(!f.enum&&f.type==='string')return;
        body+='  local.value = object.get({source:local.patch,key:"'+f.name+'",defaultValue:null})\n';
        if(f.nullable)body+='  if (local.value === "") {\n    json.put({path:"local.patch",key:"'+f.name+'",value:null})\n    local.value = null\n  }\n';
        if(f.type==='boolean')body+='  if (local.value === "true") {\n    json.put({path:"local.patch",key:"'+f.name+'",value:true})\n    local.value = true\n  }\n  if (local.value === "false") {\n    json.put({path:"local.patch",key:"'+f.name+'",value:false})\n    local.value = false\n  }\n';
        if(f.enum)body+='  if (local.value !== null) {\n    local.enumValid = config.crud.enums.'+e.name+'.'+f.name+'.includes(local.value)\n    if (!local.enumValid) {\n      throw({code:"INVALID_ENUM",message:"Invalid value for '+f.name+'",status:400})\n    }\n  }\n';
      });return body;
    }
    flow(prefix+'_initialize',{},'  return sql.initialize({initializer:'+JSON.stringify(prefix)+',seed:'+(s.seed && s.seed.enabled!==false && db.schemaPolicy!=='observe')+',verifyOnly:'+(db.schemaPolicy==='observe')+',resetDemo:'+(s.seed && s.seed.reset===true)+'})',true);
    ordered.forEach(function(e){if(e.generate==='schema')return;var n=prefix+'_'+e.name,k=e.key[0];
      var listBody=auth(e,'list')+'  local.filter = input.filter\n  local.orderBy = input.orderBy\n  if (local.orderBy === "") {\n    local.orderBy = "'+k+'"\n  }\n  local.direction = "asc"\n  if (input.direction === "desc") {\n    local.direction = "desc"\n  }\n';
      var label=e.fields.filter(function(f){return f.name===e.ui.labelField;})[0];
      if(label.type==='string')listBody+='  if (input.search !== "") {\n    local.filter = {field:"'+e.ui.labelField+'",op:"contains",value:input.search}\n  }\n';
      if(e.rowPolicy)listBody+='  if (local.restricted) {\n    local.filter = {field:"'+e.rowPolicy.field+'",op:"eq",value:local.owner}\n  }\n';
      listBody+='  local.response = data.read({source:"'+e.name+'_read",offset:input.offset,limit:input.limit,filter:local.filter,orderBy:local.orderBy,direction:local.direction})\n  local.rows = list.map({items:local.response.page.rows,select:{key:current.key,values:current.values'+(e.revision?',revision:current.values.'+e.revision:'')+',canRead:('+allowed(e,'read')+'),canUpdate:('+allowed(e,'update')+'),canDelete:('+allowed(e,'delete')+')}})\n  local.response.page.rows = local.rows\n  return local.response';
      flow(n+'_list',{offset:{type:'integer',default:0},limit:{type:'integer',default:20},filter:{type:'object',nullable:true,default:null},search:{type:'string',default:''},orderBy:{type:'string',default:k},direction:{type:'string',default:'asc'}},listBody,false,{type:'object',properties:{resource:{type:'object'},page:{type:'object',properties:{rows:{type:'array',items:rowSchema(e)},offset:{type:'integer'},limit:{type:'integer'},total:{type:'number'}}}}});
      var displayBody='  local.row.displayValues = object.merge({target:{},source:local.row.values})\n';
      s.relations.filter(function(r){return r.from.entity===e.name;}).forEach(function(r,i){
        var target=ordered.filter(function(t){return t.name===r.to.entity;})[0],fk=r.from.field;
        var free=target.rowPolicy?(target.rowPolicy.unrestricted.length?' && ('+target.rowPolicy.unrestricted.map(function(r){return 'local.role === '+JSON.stringify(r);}).join(' || ')+')':' && false'):'';
        displayBody+='  if (('+allowed(target,'read')+')'+free+' && local.row.values.'+fk+' !== null) {\n    local.related = data.read({source:"'+target.name+'_read",limit:1,filter:{field:"'+r.to.field+'",op:"eq",value:local.row.values.'+fk+'}})\n    local.relatedRow = list.first({items:local.related.page.rows,fallback:null})\n    if (local.relatedRow) {\n      json.put({path:"local.row.displayValues",key:"'+fk+'",value:local.relatedRow.values.'+(r.labelField||target.ui.labelField)+'})\n    }\n  }\n';
      });
      flow(n+'_read',{id:{type:'string'}},auth(e,'read')+owned(e,'input.id')+'  local.response = data.read({source:"'+e.name+'_read",limit:1,filter:{field:"'+k+'",op:"eq",value:input.id}})\n  local.row = list.first({items:local.response.page.rows,fallback:null})\n  if (!local.row) {\n    throw({code:"NOT_FOUND",message:"Row absent",status:404})\n  }\n'+(e.revision?'  local.row.revision = local.row.values.'+e.revision+'\n':'')+displayBody+'  return {row:local.row}',false,{type:'object',properties:{row:rowSchema(e)}});
      flow(n+'_count',{},auth(e,'count')+(e.rowPolicy?'  if (local.restricted) {\n    return sql.query({query:"'+e.name+'_count_owned",parameters:{owner:local.owner}})\n  }\n':'')+'  return sql.query({query:"'+e.name+'_count",parameters:{}})',false,{type:'object',properties:{rows:{type:'array',items:{type:'object',properties:{total:{type:'string'}}}}}});
      flow(n+'_options',{labelField:{type:'string',default:e.ui.labelField}},auth(e,'list')+'  local.query = object.get({source:config.crud.optionQueries.'+e.name+',key:input.labelField,defaultValue:null})\n  if (!local.query) {\n    throw({code:"INVALID_OPTION_LABEL",message:"Unknown option label",status:400})\n  }\n'+(e.rowPolicy?'  if (local.restricted) {\n    local.query = object.get({source:config.crud.ownedOptionQueries.'+e.name+',key:input.labelField,defaultValue:null})\n    return sql.query({query:local.query,parameters:{owner:local.owner},limit:200})\n  }\n':'')+'  return sql.query({query:local.query,parameters:{},limit:200})',false,{type:'object',properties:{rows:{type:'array',items:{type:'object',properties:{value:{type:'string'},label:{type:'string',nullable:true}}}}}});
      if(hasSave(e))flow(n+'_save',{id:{type:'string',default:''},revision:{type:'string',default:''},patch:{type:'object'}},'  if (input.id === "") {\n'+auth(e,'create')+patchBody(e)+ownerPatch(e)+'    return data.write({source:"'+e.name+'_write",operation:"create",patch:local.patch})\n  }\n'+auth(e,'update')+owned(e,'input.id')+patchBody(e)+ownerPatch(e)+'  return data.write({source:"'+e.name+'_write",operation:"update",key:{'+k+':input.id},revision:input.revision,patch:local.patch})');
      if(hasDelete(e))flow(n+'_delete',{id:{type:'string'},revision:{type:'string',default:''}},auth(e,'delete')+owned(e,'input.id')+'  return data.write({source:"'+e.name+'_write",operation:"delete",key:{'+k+':input.id},revision:input.revision})');
    });
    flow(prefix+'_runtime_proof',{},'  local.initialized = sql.initialize({initializer:'+JSON.stringify(prefix)+',seed:false,dryRun:true,verifyOnly:'+(db.schemaPolicy==='observe')+'})\n'+ordered.map(function(e){return '  result.'+e.name+' = sql.query({query:"'+e.name+'_count",parameters:{}})';}).join('\n'),true);
    if(demoLogin){
      flow(prefix+'_demo_login',{user:{type:'string'}},'  if (!config.crud.demoLogin) {\n    throw({code:"FORBIDDEN",message:"Demo login disabled",status:403})\n  }\n  local.role = object.get({source:config.crud.principals,key:input.user})\n  if (!local.role) {\n    throw({code:"FORBIDDEN",message:"Unknown demo account",status:403})\n  }\n'+accountLookup('input.user',refuse)+'  local.user = session.authenticate({user:input.user})\n  return {authenticated:true}',true);
      // Login must be HTTP-reachable only in an explicitly enabled demo. Its guard always remains server-side.
      flows[prefix+'_demo_login']=flows[prefix+'_demo_login'].replace('"accessibility": "private"','"accessibility": "hidden"');
    }
    var frontend=services.ui?services.ui.render(s):{status:'renderer-not-loaded',pages:[],components:[]};
    if(frontend.files){Object.keys(frontend.files).forEach(function(p){files[p]=frontend.files[p];});delete frontend.files;}
    files['_flow/data/ui.generated.json']=json(frontend)+'\n';
    files['_flow/resources/sql/crud/schema.json']=json({version:s.schemaVersion,tables:tables})+'\n';
    files['_flow/resources/sql/crud/data.json']=json({tables:seed})+'\n';
    files['_flow/data/config.generated.json']=json(config)+'\n';
    // The names the model generates per entity. The legacy format names an entity by its plural (order_line gives
    // order_lines): a renamed entity says so, with how to keep the given name.
    var names=s.entities.map(function(e){var route=e.routeSegment||e.name,noPage=e.generate!=='full'||s.ui.generate==='none',out={entity:e.name,flows:e.generate==='schema'?'':prefix+'_'+e.name+'_list|read|count|options'+(hasSave(e)?'|save':'')+(hasDelete(e)?'|delete':''),pages:noPage?'':e.name+'_list|detail'+(e.readOnly?'':'|form'),route:noPage?'':'/'+route,generate:e.generate,sources:e.name+'_read'+(e.readOnly?'':'|'+e.name+'_write')};
      if(e.sourceName!==undefined&&e.sourceName!==null&&String(e.sourceName)!==e.name){out.given=String(e.sourceName);out.message='The legacy CRUD format names an entity by its plural: "'+out.given+'" generates the table, Flows, pages and route of "'+e.name+'".';out.fix='Name the entity "'+e.name+'" in the model (relations, seed.data, permissions and ui.navigation then use that name), or add "plural": "'+out.given+'" to the entity to keep "'+out.given+'".';}
      return out;});
    return {files:files,flows:flows,frontend:frontend,config:config,initializer:prefix+'_initialize',entities:ordered.map(function(e){return e.name;}),names:names,schemaVersion:s.schemaVersion,normalized:s,legacy:isLegacy,diagnostics:normalized.diagnostics||[]};
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
  // Workspace libraries the generated Flows and pages call: sql.* (lib_flow_sql), data.* (lib_flow_crud_data), shared pages.
  var LIBRARIES={sql:'lib_flow_sql',data:'lib_flow_crud_data'},FRONTEND_LIBRARY='lib_flow_frontbuilder_svelte';
  function requiredReferences(c){var names=['lib_flow_sql','lib_flow_crud_data'];if(c&&c.frontend&&c.frontend.pages&&c.frontend.pages.length)names.push(FRONTEND_LIBRARY);return names;}
  function projectReferences(args,fs){
    var names=[];
    try{var project=Packages.com.twinsoft.convertigo.engine.Engine.theApp.databaseObjectsManager.getOriginalProjectByName(String(args.project),false);
      if(project){var it=project.getReferenceList().iterator();while(it.hasNext()){var reference=it.next();try{names.push(String(reference.getParser().getProjectName()));}catch(ignore){}}return names;}}
    catch(noStudio){}
    // Standalone runtimes read the saved project definition.
    var text=fs.read('c8oProject.yaml')||'',rx=/\[references\.ProjectSchemaReference\]:\s*\n\s*projectName:\s*['"]?([A-Za-z_][A-Za-z0-9_]*)/g,m;
    while((m=rx.exec(text)))names.push(m[1]);
    return names;
  }
  function referencePlan(args,fs,c){var present=projectReferences(args,fs),required=requiredReferences(c);return {required:required,present:required.filter(function(n){return present.indexOf(n)>=0;}),missing:required.filter(function(n){return present.indexOf(n)<0;})};}
  function referenceFix(project,reference){return 'flow-project-reference({project:"'+project+'", reference:"'+reference+'"})';}
  // The real causes of a failed SQL plan, never only the wrapper (FLOWSCRIPT_CANONICAL_INVALID): code, line, block, fix.
  function planError(error,project){
    error=error||{};
    var out={code:String(error.code||error.flowSql&&error.flowSql.code||'FLOW_CRUD_SQL_PLAN_FAILED'),message:String(error.message||'SQL preview failed')};
    if(error.hint)out.hint=String(error.hint);
    var details=Array.isArray(error.details)?error.details:Array.isArray(error.diagnostics)?error.diagnostics:[];
    out.diagnostics=details.filter(function(d){return d&&d.severity!=='warning'&&d.severity!=='info';}).slice(0,8).map(function(d){
      var item={code:String(d.code||out.code),message:String(d.message||'')};
      ['line','column','path','nodeId','hint','fix'].forEach(function(k){if(d[k]!==undefined&&d[k]!==null)item[k]=d[k];});
      var block=d.block||(/Unknown Flow block:\s*([A-Za-z0-9_.$-]+)/.exec(item.message)||[])[1];
      if(block){item.block=String(block);var library=LIBRARIES[item.block.split('.')[0]];
        if(item.code==='UNKNOWN_BLOCK'&&library){item.reference=library;item.fix='Add the reference: '+referenceFix(project,library)+' (flow-crud-upsert adds it on apply), then preview again.';}}
      return item;
    });
    return out;
  }
  function retiredFlow(name){return '// @generated by flow-crud; owner: _flow/data/model.yaml; retired: the model no longer generates this Flow.\nconst _flow = '+json({sourceVersion:2,accessibility:'private',authenticatedContextRequired:true,inputs:{}})+'\n\nfunction '+id(name)+'({input,config,result}) {\n  throw({code:"GONE",message:"'+name+' is no longer generated by the model: call the business Flows",status:410})\n}\n';}
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
    var source='const _flow = {sourceVersion:2}\nfunction CrudPlan({input,config,result}) {\n local.validation = sql.configCheck({live:false,onError:"throw"})\n local.plan = sql.initialize({initializer:'+JSON.stringify(prefix)+',dryRun:true,seed:'+(c.normalized.seed.enabled!==false && c.normalized.database.schemaPolicy!=='observe')+',verifyOnly:'+(c.normalized.database.schemaPolicy==='observe')+'})\n return local.plan\n}';
    var run;try{run=ctx.runFlowSource(source,cfg,{project:args.project,projectDir:args.projectDir,input:{},includeTrace:false});}
    catch(error){return {ok:false,error:planError(error,args.project)};}
    if(run.ok===false||run.error)return {ok:false,error:planError(run.error||run,args.project)};
    var result=run.result || run;result.newDatabase=newDatabase;return result;
  }
  function prepare(ctx,args){
    if(!args.project||String(args.project).indexOf('lib_')===0)fail('Explicit application project required');
    var model=ctx.lib('crud-model'),legacy=ctx.lib('crud-legacy'),ui=ctx.lib('crud-ui'),starter=ctx.lib('project-starter'),fs=disk(args.projectDir),modelText=fs.read(model.path),oldText=fs.read('_flow/resources/sql/crud/spec.json');
    var raw=args.spec!==undefined?copy(args.spec):modelText?parseModel(modelText):oldText?JSON.parse(oldText):null;
    if(!raw)fail('Supply spec or create '+model.path);
    var normalized=model.normalize(raw,args.project,legacy),manifestPath='_flow/resources/sql/crud/manifest.json',priorText=fs.read(manifestPath),prior=JSON.parse(priorText||'{"files":{}}');
    var diagnostics=normalized.diagnostics.slice(),c=null,changed=[],conflicts=[],sql=null,references=null,all={},version=raw.schemaVersion||prior.schemaVersion||1;
    if(prior.pending===true && prior.modelHash!==digest(stable(raw)))diagnostics.push({code:'FLOW_CRUD_PENDING_DIFFERENT_MODEL',severity:'error',message:'Resume the pending model before applying a different model.'});
    if(!diagnostics.some(function(d){return d.severity==='error';})){
      c=compile(raw,args.project,{model:model,legacy:legacy,ui:ui,schemaVersion:version});
      var previousSchema=fs.read('_flow/resources/sql/crud/schema.json');
      if(raw.schemaVersion===undefined && previousSchema && schemaShape(JSON.parse(previousSchema))!==schemaShape(JSON.parse(c.files['_flow/resources/sql/crud/schema.json']))){version=JSON.parse(previousSchema).version+1;c=compile(raw,args.project,{model:model,legacy:legacy,ui:ui,schemaVersion:version});}
      all=copy(c.files);Object.keys(c.flows).forEach(function(n){all['_flow/flows/'+n+'.flow.js']=c.flows[n];});
      // Additive switches (full -> data, ui.generate none, demo sign-in off): a Flow the model no longer generates stays
      // owned and refuses every call (never a leftover generic write); a page stays on disk, unlinked and released.
      // A removed entity is not migrated: its table and its callers stay.
      var priorConfig=prior.files['_flow/data/config.generated.json'];
      if(priorConfig)Object.keys((JSON.parse(priorConfig).crud||{}).enums||{}).forEach(function(name){if(!own(c.config.crud.enums,name))diagnostics.push({code:'FLOW_CRUD_REMOVAL_UNSUPPORTED',severity:'error',entity:name,message:'The model no longer declares the applied entity '+name+'.',fix:'Keep the entity; generate: "data" drops its pages and generic writes.'});});
      Object.keys(prior.files).forEach(function(p){
        if(own(all,p)||p==='_flow/resources/sql/crud/spec.json')return;
        var m=/^_flow\/flows\/([A-Za-z_][A-Za-z0-9_]*)\.flow\.js$/.exec(p);
        if(m){c.flows[m[1]]=retiredFlow(m[1]);all[p]=c.flows[m[1]];return;}
        diagnostics.push({code:'FLOW_CRUD_FILE_RELEASED',severity:'warning',path:p,message:'The model no longer generates this file: apply keeps it on disk, unlinked from the generated pages, and the model stops owning it.',fix:'Delete it, or keep it as a hand-written page.'});
      });
      Object.keys(all).forEach(function(p){var live=fs.read(p),adoptStarter=!priorText&&p==='_flow/frontbuilder/svelte/model/'+args.project+'/src/routes/+page.flow.svelte'&&live===starter.initialSveltePage(args.project),recoverable=prior.pending===true&&prior.previousFiles&&prior.previousFiles[p]===live;if(live!==null&&live!==all[p]&&!recoverable&&!adoptStarter&&(!own(prior.files,p)||prior.files[p]!==live))conflicts.push(p);if(live!==all[p])changed.push(p);});
      if(!/(^|\n)\/_flow\/(\r?\n|$)/.test(fs.read('.httpignore')||''))diagnostics.push({code:'FLOW_CRUD_HTTPIGNORE_REQUIRED',severity:'error'});
      conflicts.forEach(function(p){diagnostics.push({code:'FLOW_CRUD_GENERATED_CONFLICT',severity:'error',path:p});});
      references=referencePlan(args,fs,c);
      if(!diagnostics.some(function(d){return d.severity==='error';})){
        if(references.missing.length)sql={ok:true,skipped:true,reason:'FLOW_CRUD_REFERENCES_MISSING',message:'The SQL plan needs '+references.missing.join(', ')+'; apply adds the references, then plans and applies the schema of a new database (an existing database asks for a new preview).'};
        else {sql=runtimePlan(ctx,args,c,fs);if(sql.ok===false||sql.error){var failure=sql.error||sql;
          if(failure.diagnostics&&failure.diagnostics.length)failure.diagnostics.forEach(function(d){diagnostics.push(Object.assign({severity:'error',stage:'sql-plan',via:failure.code},d));});
          else diagnostics.push({code:failure.code||'FLOW_CRUD_PLAN_FAILED',severity:'error',stage:'sql-plan',message:failure.message,details:failure});}}
      }
    }
    var databaseApplied=sql&&sql.ok!==false&&sql.plan&&sql.plan.statements.length===0&&(normalized.internal.database.schemaPolicy==='observe'||sql.previousVersion===version);
    var applied=!!databaseApplied && prior.pending!==true && prior.modelHash===digest(stable(raw)) && changed.length===0 && !diagnostics.length;
    var plan={version:1,names:c?c.names:[],modelPath:model.path,modelRevision:digest(modelText||''),modelHash:digest(stable(raw)),schemaVersion:version,applied:applied,applicable:!diagnostics.some(function(d){return d.severity==='error';}),changed:changed,conflicts:conflicts,references:references,sql:sql,diagnostics:diagnostics,frontend:c?c.frontend:model.visual,generated: c?Object.keys(all).map(function(p){return {path:p,generated:true,owner:model.path,readOnly:true};}):[]};
    plan.planHash=digest(stable({raw:raw,prior:priorText,model:modelText,artifacts:Object.keys(all).map(function(p){return [p,fs.read(p)];}),expected:all,sql:sql,version:3}));
    plan.studio=model.studio(raw,c,plan); // Avoid a cyclic plan -> studio -> plan value.
    plan.studio.migration={applied:plan.applied,applicable:plan.applicable,schemaVersion:version,sql:sql,diagnostics:diagnostics,planHash:plan.planHash};
    return {plan:plan,compiled:c,fs:fs,raw:raw,all:all,prior:prior,manifestPath:manifestPath,modelText:modelText,model:model};
  }
  function applyOrPreview(ctx,args){
    var prepared=prepare(ctx,args),plan=prepared.plan,c=prepared.compiled,fs=prepared.fs;
    if(args.dryRun===true || !args.planHash){
      var status=plan.applied?'applied':plan.applicable?'pending':'blocked',preview=Object.assign({ok:true,dryRun:true,status:status,requiresPlanHash:true},plan);
      var renamed=plan.names.filter(function(n){return n.given;});
      var generatedNames=plan.names.map(function(n){return n.flows;}).join(', ');
      preview.next='Generated Flows: '+generatedNames+'. '+(c&&c.config.crud.demoLogin?'security.demoLogin is on: anyone may open a session as any security.principals account in one anonymous call; turn it off outside a demo. ':'')+(renamed.length?'Entities renamed by the plural rule: '+renamed.map(function(n){return n.given+' -> '+n.entity;}).join(', ')+' (names[].fix keeps a given name). ':'')+(status==='blocked'?'Fix each error diagnostic (code, message, fix), then preview again.':status==='applied'?'Nothing to apply; flow-crud-proof checks the generated artifacts.':'Apply: flow-crud-upsert({project:"'+args.project+'", planHash:"'+plan.planHash+'"}) with the same spec (or none to apply _flow/data/model.yaml)'+(plan.references&&plan.references.missing.length?'; it first adds the references '+plan.references.missing.join(', '):'')+'.');
      // Compact by default: studio repeats the model (entities, portable entities, diagram nodes) and generated the
      // files that changed already lists; detail "full" keeps them for a caller that draws the model
      if(args.detail!=='full'){delete preview.studio;preview.generatedFiles=preview.generated.length;delete preview.generated;preview.detail='compact';preview.next+=' detail:"full" adds studio (model, diagram, pages) and the generated files.';}
      return preview;
    }
    if(!plan.applicable)throw Error('FLOW_CRUD_PLAN_BLOCKED: '+JSON.stringify(plan.diagnostics));
    if(args.planHash!==plan.planHash)throw Error('FLOW_CRUD_PLAN_STALE: preview again; model, generated files or database plan changed');
    var addedReferences=[];
    if(plan.references&&plan.references.missing.length){
      // The preview listed them: add each one, then plan the SQL that needed them.
      plan.references.missing.forEach(function(reference){
        var added=ctx.callBlock('project.reference',{project:args.project,reference:reference,dryRun:false},{trace:false}),value=added&&added.result!==undefined?added.result:added;
        if(!value||value.ok===false||added.ok===false||added.error)throw Error('FLOW_CRUD_REFERENCE_FAILED: '+reference+' '+JSON.stringify(added&&added.error||added)+'; add it with '+referenceFix(args.project,reference)+', then preview again.');
        addedReferences.push(reference);
      });
      ctx.cacheClear();
      prepared=prepare(ctx,args);plan=prepared.plan;c=prepared.compiled;fs=prepared.fs;
      if(!plan.applicable)throw Error('FLOW_CRUD_PLAN_BLOCKED: references '+addedReferences.join(', ')+' added; '+JSON.stringify(plan.diagnostics));
      if(plan.references.missing.length)throw Error('FLOW_CRUD_REFERENCE_FAILED: still missing '+plan.references.missing.join(', '));
      if(!plan.sql||plan.sql.newDatabase!==true&&plan.sql.plan&&plan.sql.plan.statements.length)throw Error('FLOW_CRUD_PLAN_STALE: references '+addedReferences.join(', ')+' added; the database already exists: preview again to review its SQL plan.');
    }
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
      ctx.lib('mcp').registerFlowDbo({project:args.project,name:n,refresh:false,saveProject:false},{code:fs.read(p),format:'flowscript',flowMetadata:{authenticatedContextRequired:n!==c.initializer&&!/_(demo_login|runtime_proof|session|logout)$/.test(n)},inputDefinitions:set&&set.inputDefinitions,inputVariables:set&&set.inputVariables});
    });
    ctx.cacheClear();
    var initialized=ctx.callBlock('requestable.call',{requestable:args.project+'.'+c.initializer,variables:{}},{trace:false});
    if(initialized&&(initialized.ok===false||initialized.error||initialized.result&&initialized.result.error))throw Error('FLOW_CRUD_INITIALIZE_FAILED: '+JSON.stringify(initialized));
    fs.write(prepared.manifestPath,json({version:2,owner:prepared.model.path,modelHash:plan.modelHash,schemaVersion:plan.schemaVersion,pending:false,files:prepared.all})+'\n');
    if(own(prepared.prior.files,'_flow/resources/sql/crud/spec.json'))fs.remove('_flow/resources/sql/crud/spec.json');
    plan.studio.applied=true;plan.studio.migration.applied=true;plan.studio.migration.planWasApplied=true;
    return {ok:true,applied:true,addedReferences:addedReferences,modelPath:prepared.model.path,modelHash:plan.modelHash,schemaVersion:plan.schemaVersion,changed:plan.changed,flowCount:Object.keys(c.flows).length,initialized:initialized,frontend:plan.frontend,studio:plan.studio};
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
  // applyUnlocked: callers that already hold the project lock (standalone tests).
  return {compile:compile,upsert:upsert,proof:proof,prepare:prepare,applyUnlocked:applyOrPreview,assertWritable:assertWritable};
}())
