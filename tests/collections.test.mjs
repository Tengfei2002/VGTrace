import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
const sandbox={};vm.runInNewContext(fs.readFileSync(new URL('../src/collections-core.js',import.meta.url),'utf8'),sandbox);
const C=sandbox.VGTraceCollections, plain=x=>JSON.parse(JSON.stringify(x));
const require=createRequire(import.meta.url),save=require('../.github/scripts/save-collections.cjs');
const oldSha='a'.repeat(40),newSha='b'.repeat(40);
const storage=()=>{const values=new Map();return {values,getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};};
test('original v1/v2 backups, five states and unknown stable keys survive round trips',()=>{
 assert.deepEqual(plain(C.parseBackup({version:1,keys:['a','old-unknown']})),{a:'未游玩','old-unknown':'未游玩'});
 const all=Object.fromEntries(C.states.map((s,i)=>['game'+i,s]));assert.deepEqual(plain(C.parseBackup(C.backup(all))),all);
 for(const invalid of [{version:3,collections:{}},{version:2,collections:{a:'invalid'}},{version:2,collections:JSON.parse('{"__proto__":"未游玩"}') }])assert.throws(()=>C.parseBackup(invalid));
});
test('two independent caches and migration snapshots leave legacy storage untouched',()=>{
 const s=storage(),old=JSON.stringify({first:'已通关'});s.setItem('next-game-atlas-collections-v2',old);s.setItem('next-game-atlas-favorites-v1','["first","second"]');
 assert.deepEqual(plain(C.legacy(s)),{first:'已通关',second:'未游玩'});const snapshot=s.getItem('vgtrace-legacy-snapshot-v1');C.legacy(s);assert.equal(s.getItem('vgtrace-legacy-snapshot-v1'),snapshot);
 const p=C.profile();p.collections=C.legacy(s);p.dirty=true;C.persist(s,'0731',p);C.persist(s,'0425',C.profile());
 assert.deepEqual(plain(C.read(s,'0425').collections),{});assert.equal(C.read(s,'0731').collections.first,'已通关');assert.equal(s.getItem('next-game-atlas-collections-v2'),old);
});
test('cloud confirmation must match the submitted snapshot and retain later local changes',()=>{
 const p=C.profile();C.reconcile(p,C.backup({},'2026-11-12T00:00:00Z'),oldSha);p.collections={a:'正在游玩'};p.dirty=true;p.pending={backup:C.backup(p.collections,'2026-11-12T01:00:00Z')};
 assert.ok(!C.reconcile(p,C.backup(p.collections,'2026-11-12T00:30:00Z'),oldSha).saved);assert.ok(p.pending);
 p.collections.b='计划中';assert.ok(C.reconcile(p,p.pending.backup,newSha).saved);assert.equal(p.pending,null);assert.ok(p.dirty);assert.equal(p.collections.b,'计划中');
});
test('stale cloud revisions never silently overwrite drafts; merges handle deletion and conflicts',()=>{
 const p=C.profile();C.reconcile(p,C.backup({a:'未游玩'}),oldSha);p.collections.a='已通关';p.dirty=true;C.reconcile(p,C.backup({a:'已弃坑'}),newSha);assert.equal(p.collections.a,'已通关');assert.ok(p.error);
 let m=C.merge({a:'未游玩',b:'未游玩'},{a:'已通关',b:'未游玩'},{a:'未游玩'});assert.deepEqual(plain(m),{collections:{a:'已通关'},conflicts:[]});
 m=C.merge({a:'未游玩'},{a:'已通关'},{a:'已弃坑'});assert.deepEqual(plain(m.conflicts),['a']);
});
function fixture(overrides={}){
 const request={version:1,userId:'0731',requestId:'request-12345678',baseSha:oldSha,backup:C.backup({a:'已通关'},'2026-11-12T03:00:00Z'),...overrides};
 const issue={title:'VGTrace 收藏同步 · 0731 · request-12345678',body:'```vgtrace-sync\n'+JSON.stringify(request)+'\n```',user:{login:'Tengfei2002'},author_association:'OWNER'};
 const calls={writes:[],comments:[],closed:[],failures:[],reads:[]};
 const current={sha:oldSha,encoding:'base64',content:Buffer.from(JSON.stringify(C.backup({},'2026-11-12T00:00:00Z'))).toString('base64')};
 const github={rest:{issues:{get:async()=>({data:issue}),createComment:async x=>calls.comments.push(x),update:async x=>calls.closed.push(x)},repos:{getContent:async x=>{calls.reads.push(x);return {data:current};},createOrUpdateFileContents:async x=>{calls.writes.push(x);return {data:{commit:{html_url:'https://github.com/Tengfei2002/VGTrace/commit/test'}}};}},git:{getBlob:async()=>({data:{encoding:'base64',content:Buffer.from(JSON.stringify(C.backup({}))).toString('base64')}})}}};
 return {request,issue,calls,current,args:{github,context:{repo:{owner:'Tengfei2002',repo:'VGTrace'},issue:{number:1},payload:{issue:{body:'stale body'}}},core:{setFailed:x=>calls.failures.push(x)}}};
}
test('Actions rereads the issue, writes only the selected user on collections, and closes success',async()=>{
 const f=fixture();await save(f.args);assert.equal(f.calls.failures.length,0);assert.equal(f.calls.writes.length,1);const w=f.calls.writes[0];assert.equal(w.path,'collections/0731.json');assert.equal(w.branch,'collections');assert.equal(w.sha,oldSha);assert.deepEqual(JSON.parse(Buffer.from(w.content,'base64')).collections,{a:'已通关'});assert.equal(f.calls.closed[0].state,'closed');
});
test('Actions supports the second user without changing the first user',async()=>{
 const f=fixture({userId:'0425'});await save(f.args);assert.equal(f.calls.writes[0].path,'collections/0425.json');
});
test('Actions rejects unauthorized authors and invalid fields before writing',async()=>{
 for(const mode of ['outsider','bad-user','bad-status','bad-date']){
  const f=fixture();if(mode==='outsider'){f.issue.user.login='outsider';f.issue.author_association='NONE';}if(mode==='bad-user')f.request.userId='../main';if(mode==='bad-status')f.request.backup.collections.a='wrong';if(mode==='bad-date')f.request.backup.date='invalid';
  f.issue.body='```vgtrace-sync\n'+JSON.stringify(f.request)+'\n```';await save(f.args);assert.equal(f.calls.writes.length,0,mode);assert.equal(f.calls.failures.length,1,mode);
 }
});
test('duplicate requests close idempotently; attachment requests require exactly one trusted JSON URL',async()=>{
 const f=fixture();f.current.content=Buffer.from(JSON.stringify(f.request.backup)).toString('base64');await save(f.args);assert.equal(f.calls.writes.length,0);assert.equal(f.calls.failures.length,0);assert.equal(f.calls.closed.length,1);
 const a=fixture({attachment:true,backup:undefined});a.issue.body+='\nhttps://example.org/evil.json';await save(a.args);assert.equal(a.calls.writes.length,0);assert.equal(a.calls.failures.length,1);
});
test('Actions fetches and validates original-format JSON attachments',async()=>{
 const f=fixture({attachment:true,backup:undefined});f.issue.body+='\n[backup.json](https://github.com/user-attachments/files/123456/backup.json)';
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify(C.backup({game:'计划中'},'2026-11-12T04:00:00Z')));
 try{await save(f.args);assert.equal(f.calls.failures.length,0);assert.equal(f.calls.writes.length,1);}finally{globalThis.fetch=original;}
});

test('explicit save replaces an older cloud revision using the actual current SHA',async()=>{
 const f=fixture();f.current.sha=newSha;await save(f.args);assert.equal(f.calls.failures.length,0);assert.equal(f.calls.writes.length,1);assert.equal(f.calls.writes[0].sha,newSha);assert.equal(f.calls.writes[0].path,'collections/0731.json');
});
test('atomic update collisions retry with the new SHA, and persistent failure never closes the request',async()=>{
 const f=fixture();let attempts=0;const write=f.args.github.rest.repos.createOrUpdateFileContents;
 f.args.github.rest.repos.createOrUpdateFileContents=async x=>{if(++attempts===1){f.current.sha=newSha;throw Object.assign(Error('conflict'),{status:409});}return write(x);};await save(f.args);assert.equal(attempts,2);assert.equal(f.calls.failures.length,0);assert.equal(f.calls.writes[0].sha,newSha);
 const bad=fixture();bad.args.github.rest.repos.createOrUpdateFileContents=async()=>{throw Object.assign(Error('busy'),{status:409});};await save(bad.args);assert.equal(bad.calls.closed.length,0);assert.equal(bad.calls.failures.length,1);assert.equal(bad.calls.reads.length,3);
});
test('repair queue retries only authorized user requests, in submission order',async()=>{
 const processQueue=require('../.github/scripts/process-collection-queue.cjs');const f=fixture(),numbers=[],logs=[];f.args.context=Object.create({get repo(){return {owner:'Tengfei2002',repo:'VGTrace'};},get issue(){return {number:0};}});
 const issue=n=>({...f.issue,number:n});const other={...issue(4),user:{login:'outsider'},author_association:'NONE'};
 f.args.github.paginate=async()=>[issue(6),other,issue(5)];f.args.github.rest.issues.listForRepo=async()=>{};f.args.github.rest.issues.get=async x=>{numbers.push(x.issue_number);return {data:issue(x.issue_number)};};f.args.core={warning:x=>logs.push(x),info:x=>logs.push(x)};
 await processQueue(f.args);assert.deepEqual(numbers,[5,6]);assert.equal(f.calls.closed.length,2);assert.equal(f.calls.writes.length,2);
});

test('equal cloud contents clear an obsolete dirty flag without inventing save confirmation',()=>{
 const p=C.profile();p.base={a:'未游玩'};p.collections={a:'已通关'};p.dirty=true;p.sha=oldSha;const r=C.reconcile(p,C.backup({a:'已通关'}),newSha);assert.equal(p.dirty,false);assert.equal(p.sha,newSha);assert.ok(!r.saved);
 p.pending={backup:C.backup(p.collections,'2026-11-12T01:00:00Z')};C.reconcile(p,C.backup(p.collections,'2026-11-12T00:00:00Z'),newSha);assert.ok(p.pending);assert.equal(p.dirty,false);
});
