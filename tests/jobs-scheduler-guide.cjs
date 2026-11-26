const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const guide=fs.readFileSync(path.join(__dirname,'../_flow/resources/guide/entities/jobs.md'),'utf8');
test('jobs guide uses the relayed legacy schema, lists first and creates disabled',()=>{
 assert.match(guide,/scheduler_list/);
 assert(guide.indexOf('`scheduler-list`')<guide.indexOf('enabled:false'));
 assert.match(guide,/sequence:"RunReminders"/);assert.match(guide,/enabled:false/);
 assert.doesNotMatch(guide,/dryRun\s*:\s*(true|false)/);
 assert.match(guide,/supersedes the scheduler paragraph/);
});
test('scheduler zone is read from timeZone and nextFireTimes; a mismatch keeps the job disabled',()=>{
 assert.match(guide,/`timeZone`/);assert.match(guide,/`nextFireTimes`/);
 assert.match(guide,/leave the job disabled/);
 assert.match(guide,/`Échéance\.timeZone` controls deadline evaluation/);
});
