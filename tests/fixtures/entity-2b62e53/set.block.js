const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "runtime": "rhino",
  "private": false,
  "targets": [
    "backend"
  ],
  "description": "entity model set",
  "properties": {
    "projectDir": {
      "type": "string",
      "kind": "template",
      "default": ""
    },
    "modelJson": { "type": "string", "kind": "literal", "description": "Opaque JSON authoring payload. Internal transport alternative to model." },
    "model": {
      "type": "object",
      "kind": "expression"
    },
    "expectedRevision": {
      "type": "string",
      "kind": "template"
    }
  },
  "outputs": {
    "out": {
      "type": "object"
    }
  },
  "uses": [
    "lib_flow_entity.entity-scaffold",
    "lib_flow_entity.entity-store",
    "lib_flow_entity.entity-model",
    "lib_flow_entity.entity-traits",
    "lib_flow_entity.entity-format"
  ]
};
(function(){return {stateless:true,run:function(ctx,node){var p=ctx.props(node);
var s=ctx.lib("lib_flow_entity.entity-store"),m=ctx.lib("lib_flow_entity.entity-model"),root=String(ctx.template(p.projectDir)||ctx.read("request.projectDir")),f=s.file(root,"_flow/data/model.yaml");
try {var previous=s.read(f),rev=s.revision(previous);
var model=p.modelJson!==undefined?JSON.parse(String(p.modelJson)):ctx.expr(p.model),diagnostics=ctx.lib("lib_flow_entity.entity-format").diagnose(model,ctx.lib("lib_flow_entity.entity-traits"),function(x){return s.imports(ctx,root,x).entities;},m.resolve,s.read(s.file(root,"_flow/blocks/app/entityAccess.block.js")));
if(diagnostics.length)return {ok:false,valid:false,diagnostics:diagnostics,revision:rev};
var expected=String(ctx.template(p.expectedRevision)||"");if(!expected||expected!==rev)ctx.throwFlow({code:"ENTITY_MODEL_STALE",message:"expectedRevision must match the current model.",status:409},node);
var source=JSON.stringify(model,null,2)+"\n";if(source.length>262144)ctx.throwFlow({code:"ENTITY_MODEL_TOO_LARGE",message:"Model maximum is 256 KiB.",status:400},node);
var Files=flowEngineClass("java.nio.file.Files");f.getParentFile().mkdirs();var lockFile=s.file(root,"_private/flow/entity-model.lock");lockFile.getParentFile().mkdirs();var lock=flowEngineClass("java.nio.channels.FileChannel").open(lockFile.toPath(),flowEngineClass("java.nio.file.StandardOpenOption").CREATE,flowEngineClass("java.nio.file.StandardOpenOption").WRITE),held=lock.lock();try{if(s.revision(s.read(f))!==expected)ctx.throwFlow({code:"ENTITY_MODEL_STALE",message:"Model changed during write.",status:409},node);var tmp=Files.createTempFile(f.getParentFile().toPath(),".model-",".tmp");try{Files.writeString(tmp,source);Files.move(tmp,f.toPath(),flowEngineClass("java.nio.file.StandardCopyOption").ATOMIC_MOVE,flowEngineClass("java.nio.file.StandardCopyOption").REPLACE_EXISTING);}finally{Files.deleteIfExists(tmp);}var scaffold=ctx.lib("lib_flow_entity.entity-scaffold").ensure(ctx,root);}finally{held.release();lock.close();}
return {ok:true,path:"_flow/data/model.yaml",revision:s.revision(source),previousRevision:rev,scaffold:scaffold};
}catch(error){if(error.entity)ctx.throwFlow(error.entity,node);throw error;}
}};}())
