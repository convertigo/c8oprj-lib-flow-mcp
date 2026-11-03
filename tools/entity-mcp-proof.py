#!/usr/bin/env python3
"""Build an entity exercise only via authenticated HTTP MCP tools, without an LLM.

The input fixture contains declarative model, engine config and complete source
strings; no project source is ever written by this client. It records every MCP
response and tool name, but neither the bearer nor request headers. A failure
keeps a partial transcript and explicit complete:false; it is not a proof.
"""
import argparse, copy, http.cookiejar, json, pathlib, time, urllib.error, urllib.parse, urllib.request

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',default='http://127.0.0.1:19580/convertigo/api/flow-mcp')
parser.add_argument('--token-file',required=True)
parser.add_argument('--project',default='EntityMcpExercise')
parser.add_argument('--fixture',required=True)
parser.add_argument('--evidence',required=True)
parser.add_argument('--credentials-file')
parser.add_argument('--rebuild-only',action='store_true',help='With --resume-from: rebuild existing authored sources after a shared provider change.')
parser.add_argument('--resume-from',help='Continue a partial proof summary for this same project; prior attempted tool calls remain counted.')
parser.add_argument('--cookie-file',help='Private persistent cookie jar for repeated authoring attempts; never place under published evidence.')
parser.add_argument('--username',default='admin@example.test')
parser.add_argument('--deploy',action='store_true',help='Initialize through a real application ADMIN session after construction, never through the MCP bearer identity.')
args=parser.parse_args()
assert not args.rebuild_only or args.resume_from,"--rebuild-only requires --resume-from"
fixture=json.loads(pathlib.Path(args.fixture).read_text())
bearer=pathlib.Path(args.token_file).read_text().strip()
assert bearer and '\n' not in bearer,'Expected a single bearer in private token file'
output=pathlib.Path(args.evidence);output.mkdir(parents=True,exist_ok=True)
transcript=[];tool_calls=0;protocol_calls=0;checks=[]
http_setup_calls=0
if args.resume_from:
 previous_path=pathlib.Path(args.resume_from)
 previous=json.loads(previous_path.read_text())
 assert previous['project']==args.project,'Resume project must match the partial proof'
 assert previous['sourceWritesViaMcpOnly'],'Only MCP-authored proofs can be resumed'
 transcript=json.loads(previous_path.with_name('transcript.json').read_text())
 tool_calls=previous['toolCalls'];protocol_calls=previous['protocolCalls'];checks=previous['checks']
 http_setup_calls=previous.get('httpSessionAcceptanceCalls',0)
frontend_prepared=False
published_url=None
cookies=http.cookiejar.MozillaCookieJar(args.cookie_file) if args.cookie_file else http.cookiejar.CookieJar()
if args.cookie_file and pathlib.Path(args.cookie_file).exists():cookies.load(ignore_discard=True,ignore_expires=True)
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))
def save_cookies():
 if args.cookie_file:
  import os
  cookies.save(ignore_discard=True,ignore_expires=True)
  os.chmod(args.cookie_file,0o600)

def rpc(method,params):
 global protocol_calls,tool_calls
 protocol_calls+=1
 if method=='tools/call': tool_calls+=1
 request={'jsonrpc':'2.0','id':protocol_calls,'method':method,'params':params}
 start=time.perf_counter()
 body=json.dumps(request).encode()
 http=urllib.request.Request(args.url,body,{'Content-Type':'application/json','Authorization':'Bearer '+bearer})
 try:
  with opener.open(http,timeout=300) as result: raw=result.read().decode()
 except urllib.error.HTTPError as error:
  raw=error.read().decode();raise RuntimeError('MCP HTTP '+str(error.code)+': '+raw[:500]) from error
 save_cookies()
 response=json.loads(raw)
 transcript.append({'index':protocol_calls,'method':method,'tool':params.get('name'),
                    'elapsedMs':round((time.perf_counter()-start)*1000,3),'response':response})
 (output/'transcript.json').write_text(json.dumps(transcript,indent=2,ensure_ascii=False))
 if response.get('error'):raise RuntimeError(json.dumps(response['error']))
 return response.get('result',{})

def tool(name,arguments,refusal=False):
 result=rpc('tools/call',{'name':name,'arguments':arguments})
 content=result.get('structuredContent')
 if content is None: raise AssertionError(name+' omitted structuredContent: '+json.dumps(result)[:1000])
 failed=result.get('isError') or content.get('error') or content.get('ok') is False
 if not refusal and failed: raise AssertionError(name+' failed: '+json.dumps(content)[:1500])
 if refusal and not failed: raise AssertionError(name+' should have refused')
 return content

def check(name,value):
 if not value: raise AssertionError(name)
 checks.append(name)

def render(value):
 return value.replace('${PROJECT}',args.project)

def source_create(source):
 global frontend_prepared
 params={'project':args.project,'code':render(source['code'])}
 for key in ['name','qname','sourceFile','block']:
  if key in source:params[key]=render(source[key])
 current=None
 if args.resume_from:
  selector={'sourceFile':params['sourceFile']} if 'sourceFile' in params else {'qname':params.get('qname',args.project+'.'+params['name'])}
  current=tool('code-get',{'project':args.project,**selector})
  if current.get('code','').strip()==params['code'].strip():return current
 if 'sourceFile' in params:
  if current is None and source.get('existing'):current=tool('code-get',{'project':args.project,'sourceFile':params['sourceFile']})
  if current and current.get('revision'):params['revision']=current['revision']
  if not frontend_prepared:
   tool('frontend-svelte-action',{'project':args.project,'actionId':'dev.ensure','wait':False})
   frontend_prepared=True
 saved=tool('code-set',params)
 if 'sourceFile' not in params and 'block' not in params:
  selector={'project':args.project,'qname':params.get('qname',args.project+'.'+params['name'])}
  run=tool('code-run',{**selector,'input':source.get('input',{})}) if source.get('run') else None
  tool('code-promote',{**selector,**({'revision':saved['revision']} if saved.get('revision') else {})})
 return saved

def deploy():
 global http_setup_calls
 assert args.credentials_file,'--deploy requires credentials for an actual application ADMIN account'
 credentials=json.loads(pathlib.Path(args.credentials_file).read_text())
 application_opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 base=args.url.split('/api/flow-mcp')[0]+'/projects/'+args.project+'/.json'
 def call(sequence,parameters=None):
  global http_setup_calls
  body=urllib.parse.urlencode({'__sequence':sequence,**(parameters or {})}).encode()
  try:
   with application_opener.open(base,body,timeout=300) as response:value=json.load(response)
  except urllib.error.HTTPError as error:
   raise RuntimeError('Application deployment HTTP '+str(error.code)) from error
  http_setup_calls+=1
  return value.get('document',value)
 plan=fixture['deployment']
 try:
  anonymous=call(plan.get('currentSession','CurrentSession'))
  check('Application deployment session starts anonymous without MCP bearer',anonymous.get('authenticated') is False)
  account=call(plan['signIn'],{'user':args.username,'password':credentials['password']})
  check('Deployment uses a real ADMIN account',account.get('user')==args.username and 'ADMIN' in account.get('roles',[]))
  first=call(plan['initialize'])
  check('ADMIN initialization succeeded',not first.get('error'))
  second=call(plan['initialize'])
  check('ADMIN initialization is repeatable',not second.get('error'))
  (output/'deployment.json').write_text(json.dumps({'anonymous':anonymous,'account':{'user':account['user'],'roles':account['roles']},'first':first,'second':second},indent=2,ensure_ascii=False))
 finally:
  call(plan['signOut'],{'__disableAutologin':'true'})

complete=False
try:
 if args.resume_from:
  if args.rebuild_only:tool('flow-cache-clear',{'project':args.project})
  current=tool('flow-entity-model-get',{'project':args.project})
  check('Resumed model matches the canonical fixture',current.get('model')==fixture['model'])
  revision=current['revision']
 else:
  rpc('initialize',{'protocolVersion':'2024-11-05','capabilities':{},'clientInfo':{'name':'entity-mcp-proof','version':'1'}})
  descriptor=rpc('tools/list',{})
  names={item['name'] for item in descriptor.get('tools',[])}
  check('Three model tools advertised',all('flow-entity-model-'+op in names for op in ['get','check','set']))
  for uri in ['flow://guide/entities','flow://guide/multipage-entities']:
   resource=rpc('resources/read',{'uri':uri});check(uri+' readable',bool(resource.get('contents')))
  boot=tool('flow-project-bootstrap',{'project':args.project,'ui':True,'references':fixture['references']})
  check('Blank project created',boot.get('imported') is True or boot.get('created') is True)
  before=tool('flow-entity-model-get',{'project':args.project})
  check('Model initially absent',before.get('revision')=='missing')
  checked=tool('flow-entity-model-check',{'project':args.project,'model':fixture['model']})
  check('Model valid without write',checked.get('valid') is True)
  unchanged=tool('flow-entity-model-get',{'project':args.project})
  check('Check has no write',unchanged.get('revision')=='missing')
  saved=tool('flow-entity-model-set',{'project':args.project,'model':fixture['model'],'expectedRevision':'missing'})
  revision=tool('flow-entity-model-get',{'project':args.project})['revision']
  stale=tool('flow-entity-model-set',{'project':args.project,'model':fixture['model'],'expectedRevision':'missing'},refusal=True)
  check('Stale model refused',True)
  invalid=copy.deepcopy(fixture['model']);invalid['version']=999
  bad=tool('flow-entity-model-check',{'project':args.project,'model':invalid},refusal=True)
  check('Invalid model diagnostics',bool(bad.get('diagnostics') or bad.get('error')))
  tool('flow-entity-model-set',{'project':args.project,'model':invalid,'expectedRevision':revision},refusal=True)
  after=tool('flow-entity-model-get',{'project':args.project})
  check('Refusals preserve model revision',after.get('revision')==revision)
  for resource in fixture.get('resources',[]):
   path=render(resource['path']);current=tool('flow-resource-get',{'project':args.project,'path':path})
   patch={'project':args.project,'path':path,'baseHash':current.get('hash',current.get('baseHash','missing'))}
   if 'content' in resource:patch['content']=render(resource['content'])
   else:patch['edits']=[{k:render(v) for k,v in edit.items()} for edit in resource['edits']]
   tool('flow-resource-patch',patch)
 if not args.rebuild_only:
  for source in fixture.get('sources',[]):source_create(source)
  tool('project-save',{'project':args.project})
  tree=tool('authoring-tree',{'project':args.project,'surface':'frontend','builder':'svelte','includeFrontendCatalog':True,'maxDepth':14})
  (output/'authoring-tree.json').write_text(json.dumps(tree,indent=2,ensure_ascii=False))
  parent=fixture.get('paletteParentPath')
  if not parent:
   candidates=[]
   def scan(value):
    if isinstance(value,dict):
     if value.get('kind')=='frontendStructure' and value.get('parentPath'):candidates.append(value['parentPath'])
     for child in value.values():scan(child)
    elif isinstance(value,list):
     for child in value:scan(child)
   scan(tree)
   parent=next((p for p in candidates if p.startswith(args.project+'::')),None)
  check('Palette insertion parent found',bool(parent))
  if parent:
   for query in ['EntityTable','EntityForm']:
    palette=tool('authoring-palette',{'parentPath':render(parent),'surface':'frontend','builder':'svelte','query':query})
    check(query+' in palette',any(query.lower() in json.dumps(item).lower() for item in palette.get('items',[])))
 if fixture.get('build',True):
  build=tool('frontend-svelte-action',{'project':args.project,'actionId':'build','wait':True})
  check('Production build published',all(step.get('ok') for step in build.get('details',{}).get('steps',[])) and build.get('details',{}).get('production',{}).get('status')=='current')
  published_path=urllib.parse.urlsplit(build.get('openUrl','')).path
  server=urllib.parse.urlsplit(args.url)
  published_url=urllib.parse.urlunsplit((server.scheme,server.netloc,published_path,'',''))
  (output/'build.json').write_text(json.dumps(build,indent=2,ensure_ascii=False))
 if args.deploy:deploy()
 if not args.rebuild_only:
  viewer=tool('frontend-svelte-action',{'project':args.project,'actionId':'dev.open','wait':True})
  (output/'viewer.json').write_text(json.dumps(viewer,indent=2,ensure_ascii=False))
  if frontend_prepared or viewer.get('ok'):tool('frontend-svelte-action',{'project':args.project,'actionId':'dev.stop','wait':True})
 complete=True
finally:
 save_cookies()
 report={'complete':complete,'project':args.project,'toolCalls':tool_calls,'protocolCalls':protocol_calls,'httpSessionAcceptanceCalls':http_setup_calls,'checks':checks,'sourceWritesViaMcpOnly':True,'modelRevision':locals().get('revision'),'productionUrl':published_url,'browserControlReady':locals().get('viewer',{}).get('browserControlReady',False),'limits':fixture.get('limits',[])}
 (output/'summary.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
 print(json.dumps(report,ensure_ascii=False))
