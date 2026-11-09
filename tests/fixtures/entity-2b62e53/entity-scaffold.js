/* Two project-owned sources; model edits never overwrite application policy. */
(function () {
  var policy = "const _meta = {sourceVersion:2,version:1,private:true,properties:{request:{type:\"object\",kind:\"expression\"}},outputs:{out:{type:\"object\"}}}\n\nfunction block({ input, config, result }) {\n  // The request of the operation is an object: anything else is refused.\n  if (!input.request || typeof input.request !== \"object\") {\n    throw { code: \"ENTITY_FORBIDDEN\", message: \"Invalid access request.\" }\n  }\n  // Entities readable without sign-in: for example [\"Room\"], or [\"*\"].\n  local.publicRead = []\n  if (!input.request.write && (local.publicRead.includes(\"*\") || local.publicRead.includes(input.request.entity))) {\n    return {}\n  }\n  if (!input.request.user) {\n    throw { code: \"ENTITY_UNAUTHENTICATED\", message: \"Sign in to read entities.\" }\n  }\n  // Rows per role, for reads and writes: ADMIN every ticket, SUPPORT the tickets assigned\n  // to it, anyone else the tickets they requested (creation imposes requesterId).\n  // input.request.roles needs config.entities.actorProvider (flow://guide/entities).\n  // Uncommented, it also opens delete and field rewrites (SUPPORT may rewrite requesterId, a requester choose assigneeId): restrict by input.request.operation or a model ACL.\n  // if (input.request.entity === \"Ticket\") {\n  //   if (input.request.roles.includes(\"ADMIN\")) {\n  //     return {}\n  //   }\n  //   if (input.request.roles.includes(\"SUPPORT\")) {\n  //     return { scope: { assigneeId: input.request.user } }\n  //   }\n  //   return { scope: { requesterId: input.request.user } }\n  // }\n  if (input.request.write) {\n    throw { code: \"ENTITY_FORBIDDEN\", message: \"Writes are disabled by the application policy.\" }\n  }\n  return {}\n}\n";
  var gateway = 'const _flow={sourceVersion:2,accessibility:"public",inputs:{entity:{type:"string"},operation:{type:"string"},payload:{type:"object",default:{}}}}\n' +
    'function EntityGateway({input,config,result}) {\n' +
    '  local.response=entity.applyGateway({entity:input.entity,operation:input.operation,payload:input.payload})\n' +
    '  return local.response\n' +
    '}\n';
  function ensure(ctx, root) {
    var store = ctx.lib("lib_flow_entity.entity-store"), Files = flowEngineClass("java.nio.file.Files"), created = [], kept = [];
    var block = store.file(root, "_flow/blocks/app/entityAccess.block.js");
    block.getParentFile().mkdirs();
    try {
      Files.writeString(block.toPath(), policy, flowEngineClass("java.nio.file.StandardOpenOption").CREATE_NEW);
      created.push("block:app.entityAccess");
    } catch (e) { if (block.isFile()) kept.push("block:app.entityAccess"); else throw e; }
    var source = store.file(root, "_flow/flows/EntityGateway.flow.js");
    var declaration=store.read(store.file(root,"c8oProject.yaml")) || "";
    if (source.isFile() || /(?:^|\n)\s*↓EntityGateway \[/.test(declaration)) kept.push("EntityGateway");
    else {
      var args = {projectDir: root, name: "EntityGateway", code: gateway};
      var written = ctx.flowCodeSet(args);
      if (!written.ok) throw Error("EntityGateway scaffold could not be checked: " + JSON.stringify(written.error));
      var promoted = ctx.flowCodePromote({projectDir: root, name: "EntityGateway", revision: written.revision});
      if (!promoted.ok) throw Error("EntityGateway scaffold could not be saved: " + JSON.stringify(promoted.error));
      created.push("EntityGateway");
    }
    return {created: created, preserved: kept,
      message: "Project-local EntityGateway and app.entityAccess are application-owned; existing sources are preserved. Reads require sign-in; publicRead opens anonymous reads explicitly. Writes stay denied until the application decides its policy and scope: the commented example scopes rows per role (return { scope: { requesterId: input.request.user } }) and needs config.entities.actorProvider for roles. initialize/demoReset are never gateway operations."};
  }
  return {stateless: true, ensure: ensure, policySource: policy, gatewaySource: gateway};
}())
