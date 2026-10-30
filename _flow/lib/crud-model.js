/* Shared legacy-shaped model adapter. No database access or inference. */
(function(){
 var MODEL='_flow/data/model.yaml';
 function clone(v){return JSON.parse(JSON.stringify(v));}
 function has(o,k){return Object.prototype.hasOwnProperty.call(o,k);}
 function error(message){throw Error('FLOW_CRUD_MODEL_INVALID: '+message);}
 function portable(type){
  var t=String(type||'VARCHAR(255)').trim().toUpperCase(),m;
  if((m=/^(?:VAR)?CHAR(?:ACTER)?(?: VARYING)?\((\d+)\)$/.exec(t)))return {type:'string',length:Number(m[1])};
  if(['STRING','VARCHAR','TEXT','LONGVARCHAR','CLOB'].indexOf(t)>=0)return {type:'string',length:t==='STRING'||t==='VARCHAR'?255:65536};
  if(/^(INT|INTEGER|BIGINT|SMALLINT|TINYINT|SERIAL|BIGSERIAL|INT64)$/.test(t))return {type:'int64'};
  if((m=/^(DECIMAL|NUMERIC|NUMBER)(?:\((\d+)(?:,\s*(\d+))?\))?$/.exec(t)))return {type:'decimal',precision:Number(m[2]||12),scale:Number(m[3]|| (m[2]?0:2))};
  if(t==='DECIMAL')return {type:'decimal',precision:12,scale:2};
  if(t==='BOOLEAN'||t==='BOOL'||t==='BIT')return {type:'boolean'};
  if(t==='DATE')return {type:'date'};
  if(/^(TIMESTAMP|DATETIME)(?:\(\d+\))?(?: WITH(?:OUT)? TIME ZONE)?$/.test(t))return {type:'timestamp',timezone:/WITH TIME ZONE$/.test(t)?'offset':'local'};
  error('Unsupported SQL type '+t+'; no lossy conversion is performed');
 }
 function scalar(value,field){
  if(value===null)return null;
  if(field.type==='int64'||field.type==='decimal'){
   if(typeof value==='number' && (!Number.isSafeInteger(value)&&field.type==='int64'))error('Unsafe numeric int64 literal; use exact text');
   return String(value);
  }
  if(field.type==='boolean')return value===true||value===1||value==='true';
  return String(value);
 }
 function normalize(raw,project,legacy){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))error('Expected an entity model');
  if(raw.modelVersion!==undefined && raw.modelVersion!==1)error('Unsupported modelVersion');
  if(raw.project && raw.project!==project)error('spec.project differs from target project');
  // Read compatibility for the earlier experiment, without making it the public format.
  if(raw.specVersion===1){var old=clone(raw);old.project=project;old.database.schemaPolicy=old.database.schemaPolicy||'managed';return {internal:old,legacy:false,diagnostics:[],model:clone(raw)};}
  if(!legacy)error('Legacy normalizer unavailable');
  var input=clone(raw);input.project=project;input.database=input.database||{};
  var normalized=legacy.normalize(input),diagnostics=[],rawEntities=input.entities||[],security=clone(input.security||{});
  security.principals=security.principals||{};
  var db=normalized.database,mode=db.mode,s={project:project,specVersion:1,schemaVersion:input.schemaVersion||1,security:security,facade:clone(normalized.facade),ui:clone(normalized.ui),entities:[],relations:[],seed:{demo:normalized.seed.reset===true||input.seed&&input.seed.demo===true,enabled:normalized.seed.enabled,reset:normalized.seed.reset,data:{}}};
  s.database={dialect:mode,connection:input.database.connection||db.connector,url:input.database.url||'',driverClass:input.database.driverClass||db.driver.jdbcDriverClassName,user:db.user,password:db.password,schema:input.database.schema,schemaPolicy:input.database.schemaPolicy||'managed'};
  if(['managed','observe'].indexOf(s.database.schemaPolicy)<0)error('database.schemaPolicy must be managed or observe');
  if(!s.database.url){
   if(mode==='hsqldb')s.database.url='jdbc:hsqldb:file:.//_flow/resources/sql/crud/database/'+db.database+';shutdown=false';
   else s.database.url=db.driver.urlBuilder?db.driver.urlBuilder(db):'jdbc:'+mode+'://'+db.host+':'+db.port+'/'+db.database;
  }
  // JSON cloning removes driver functions in the upstream normalizer. Compose only approved connection forms.
  if(!s.database.url || s.database.url.indexOf('jdbc:')!==0)error('Configure a server-owned JDBC connection');
  if(mode==='hsqldb')s.database.driverClass='org.hsqldb.jdbc.JDBCDriver';
  if(['hsqldb','postgresql'].indexOf(mode)<0)diagnostics.push({code:'SQL_DIALECT_NOT_QUALIFIED',severity:'error',dialect:mode,message:'Model accepted; portable schema application is qualified only on HSQLDB/PostgreSQL.'});
  if(s.database.password && !/^\$\{[A-Za-z0-9_.-]+\.secret=?\}$/.test(s.database.password))diagnostics.push({code:'MODEL_SECRET_REFERENCE_REQUIRED',severity:'error',message:'Legacy model parsed; move inline credentials to a server secret symbol before storing/applying the model.'});
  s.ui.title=input.ui&&input.ui.title||project;
  var aliases={};
  normalized.entities.forEach(function(e,i){
   var re=rawEntities[i],key=e.primaryField.column,out={name:e.name,label:e.displayLabel,sourceName:re.name,routeSegment:e.routeSegment,key:[key],revision:re.revision||null,readOnly:re.readOnly===true,permissions:clone(re.permissions||{}),fields:[],ui:clone(e.ui),indexes:clone(re.indexes||[])};
   if(re.permissions!==undefined&&(!re.permissions||typeof re.permissions!=='object'||Array.isArray(re.permissions)))error('permissions must be an operation map');
   if(re.revision!==undefined&&re.revision!==null&&typeof re.revision!=='string')error('revision must name a column, or be null');
   if(re.indexes!==undefined&&!Array.isArray(re.indexes))error('indexes must be an array');
   if(out.indexes.length)diagnostics.push({code:'SQL_PORTABLE_INDEX_NOT_IMPLEMENTED',severity:'error',entity:e.name,message:'Index declarations are preserved; generic additive index planning is not implemented by this prototype.'});
   if(re.rowPolicy)diagnostics.push({code:'FLOW_CRUD_ROW_POLICY_NOT_IMPLEMENTED',severity:'error',entity:e.name,message:'Row policies must be enforced across every read, count and mutation; this prototype refuses partial enforcement.'});
   aliases[re.name]=out;aliases[e.name]=out;
   e.fields.forEach(function(f){
    var p=portable(f.type),rf=(re.fields||[]).filter(function(x){return String(x.column||x.name).toLowerCase()===f.column||x.name===f.name;})[0]||{};
    var field=Object.assign({name:f.column,column:f.column,label:f.label,sourceName:f.name,nullable:!f.required},p);
    // Legacy makes the column named id an identity regardless of the generated flag.
    if(f.primary){field.nullable=false;field.identity=f.column==='id'||f.generated===true;}
    else if(f.unique)field.unique=true;
    if(f.defaultValue!==null && f.defaultValue!==undefined)field.default=scalar(f.defaultValue,field);
    if(rf.readOnly===true)field.readOnly=true;
    if(rf.enum!==undefined){if(!Array.isArray(rf.enum)||!rf.enum.length||rf.enum.length>128)error('enum is a bounded nonempty array');field.enum=rf.enum.map(function(v){if(v===null||typeof v==='object')error('enum contains only non-null scalars');return scalar(v,field);});if(field.enum.some(function(v,i){return field.enum.indexOf(v)!==i;}))error('enum contains duplicate values');if(has(field,'default')&&field.enum.indexOf(field.default)<0)error('default must belong to enum');}
    if(p.type==='timestamp')diagnostics.push({code:'SQL_PORTABLE_TIMESTAMP_REQUIRED',severity:'error',entity:e.name,field:f.column,portableType:'timestamp',timezone:p.timezone,message:'TIMESTAMP is preserved as a timestamp; this SQL library does not yet implement a lossless portable timestamp. No DATE/string substitution.'});
    out.fields.push(field);
   });
   if(out.key.length!==1 || !out.fields.some(function(f){return f.name===key&&f.identity&&f.type==='int64';}))diagnostics.push({code:'FLOW_CRUD_KEY_NOT_QUALIFIED',severity:'error',entity:e.name,message:'Model accepted; runtime create currently requires a generated int64 key.'});
   if(out.ui.fieldLabels)out.fields.forEach(function(f){f.label=out.ui.fieldLabels[f.name]||f.label;});
   ['listFields','detailFields','formFields'].forEach(function(k){if(!out.ui[k]||!out.ui[k].length)delete out.ui[k];});
   ['listFields','detailFields','formFields'].forEach(function(k){if(out.ui[k])out.ui[k]=out.ui[k].map(function(n){var f=out.fields.filter(function(f){return f.name.replace(/_/g,'')===String(n).replace(/_/g,'');})[0];return f?f.name:n;});});
   var label=out.fields.filter(function(f){return f.type==='string'&&!f.identity;})[0];out.ui.labelField=label?label.name:key;
   s.entities.push(out);
  });
  normalized.relations.forEach(function(r){s.relations.push({name:r.name,kind:'many-to-one',from:{entity:r.fromEntity,field:r.fromField},to:{entity:r.toEntity,field:r.toField},labelField:r.ui.optionLabelField});});
  normalized.entities.forEach(function(e,i){
   var out=s.entities[i],explicit=has(normalized.seed.data,e.name),rows=explicit?normalized.seed.data[e.name]:[],count=explicit?rows.length:normalized.seed.rowsPerEntity;
   if(!normalized.seed.enabled || s.database.schemaPolicy==='observe'){s.seed.data[e.name]=[];return;}
   if(count>2000)error('Seed is bounded to 2000 rows');
   var result=[];for(var rowIndex=0;rowIndex<count;rowIndex++){
    var row={};out.fields.forEach(function(f){
     var original=e.fields.filter(function(x){return x.column===f.column;})[0],value;
     if(explicit){if(!has(rows[rowIndex],f.column))return;value=rows[rowIndex][f.column];}
     else {
      var relation=s.relations.filter(function(r){return r.from.entity===e.name&&r.from.field===f.name;})[0];
      if(relation){var target=s.entities.filter(function(t){return t.name===relation.to.entity;})[0],targetRows=normalized.seed.data[target.name];var ix=rowIndex%(targetRows?targetRows.length:count);value=targetRows?targetRows[ix][relation.to.field]:ix+1;}
      else value=original.primary?rowIndex+1:has(f,'default')?f.default:legacy.sample(e,original,rowIndex);
     }
     row[f.column]=scalar(value,f);
    });if(out.revision)row[out.revision]='1';result.push(row);
   }s.seed.data[e.name]=result;
  });
  return {internal:s,legacy:true,diagnostics:diagnostics,model:clone(raw)};
 }
 var visual={version:1,provider:'lib_flow_frontbuilder_svelte',requiredProviderVersion:'0.2.6',status:'available',capabilities:{shell:'application shell with navigation and user zone',pageHeader:'page title and primary action',table:'server sorting/pagination, empty state, row actions',formSection:'grouped fields and relation selects',kpi:'dashboard counts',statusBadge:'semantic status',emptyState:'empty/error/loading',toast:'mutation feedback'},theme:{resource:'theme.flow.css',tokens:true,palettes:true,applicationCss:false},namesAreProvisional:false};
 function frontend(s){
  var plan=clone(visual),prefix=s.facade.prefix;plan.generatedPages=[];plan.plannedPages=[{id:'crud_dashboard',kind:'dashboard',components:['shell','pageHeader','kpi'],counts:s.entities.map(function(e){return prefix+'_'+e.name+'_count';})}];
  s.entities.forEach(function(e){
   var base={entity:e.name,route:e.routeSegment||e.name,permissions:clone(e.permissions),owner:MODEL,generated:true};
   plan.plannedPages.push(Object.assign({},base,{id:e.name+'_list',kind:'list',components:['shell','pageHeader','table','statusBadge','emptyState','toast'],fields:e.ui.listFields,sort:'server',pagination:'server',actions:e.readOnly?['read']:['read','create','update','delete'],requestable:prefix+'_'+e.name+'_list'}));
   plan.plannedPages.push(Object.assign({},base,{id:e.name+'_detail',kind:'detail',components:['shell','pageHeader','formSection','statusBadge'],fields:e.ui.detailFields||e.ui.listFields,requestable:prefix+'_'+e.name+'_read'}));
   if(!e.readOnly)plan.plannedPages.push(Object.assign({},base,{id:e.name+'_form',kind:'form',components:['shell','pageHeader','formSection','toast'],sections:[{fields:e.ui.formFields.map(function(name){var relation=s.relations.filter(function(r){return r.from.entity===e.name&&r.from.field===name;})[0];return {field:name,control:relation?'select':e.ui.fieldOptions&&e.ui.fieldOptions[name]?'select':'input',optionsRequestable:relation?prefix+'_'+relation.to.entity+'_options':undefined};})}],requestable:prefix+'_'+e.name+'_save'}));
  });return plan;
 }
 function studio(model,compiled,plan){
  var entities=model.entities||[];
  var normalized=compiled?compiled.normalized:model;
  return {node:{id:'flowEngine.dataModel',label:'Modèle de données',resource:MODEL},entities:entities,portableEntities:normalized.entities,relations:normalized.relations||[],diagram:{format:'entities-relations',nodes:(normalized.entities||[]).map(function(e){return {id:e.name,label:e.displayLabel||e.label||e.name,fields:e.fields};}),edges:normalized.relations||[]},applied:plan.applied||false,migration:{applied:plan.applied,applicable:plan.applicable},generated:compiled?{flows:Object.keys(compiled.flows),pages:compiled.frontend.pages||[],layouts:Object.keys(compiled.files).filter(function(p){return /\+layout\.flow\.svelte$/.test(p);}),plannedPages:compiled.frontend.plannedPages||[],readOnly:true,owner:MODEL}:null,frontend:compiled?compiled.frontend:visual,actions:[{id:'preview',label:'Plan à blanc',mutates:false},{id:'apply',label:'Appliquer',requires:'current planHash and model revision'}]};
 }
 return {path:MODEL,normalize:normalize,portable:portable,visual:visual,frontend:frontend,studio:studio};
}())
