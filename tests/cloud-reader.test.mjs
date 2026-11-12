import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {collectionSnapshot} from '../scripts/collection-snapshot.mjs';
import {execFileSync} from 'node:child_process';
const sandbox={setTimeout,clearTimeout};for(const name of ['collections-core.js','collections-cloud.js'])vm.runInNewContext(fs.readFileSync(new URL('../src/'+name,import.meta.url),'utf8'),sandbox);
const factory=sandbox.VGTraceCloud,C=sandbox.VGTraceCollections;
const data=()=>({version:1,profiles:{'0731':{sha:'a'.repeat(40),backup:C.backup({one:'正在游玩'},'2026-11-12T00:00:00Z')},'0425':{sha:'b'.repeat(40),backup:C.backup({},'2026-11-12T00:00:00Z')}}});
test('Pages reads coalesce simultaneous users and cache clicks without using REST',async()=>{
 const urls=[];let time=1000;const reader=factory.create({now:()=>time,fetch:async url=>{urls.push(url);return {ok:true,json:async()=>data()};}});
 const [a,b]=await Promise.all([reader.read('0731'),reader.read('0425')]);assert.equal(a.backup.collections.one,'正在游玩');assert.equal(Object.keys(b.backup.collections).length,0);assert.equal(urls.length,1);
 for(let i=0;i<10;i++)await reader.read('0731');assert.equal(urls.length,1);time+=21000;await reader.read('0731');assert.equal(urls.length,2);assert.ok(urls.every(u=>u.startsWith('./cloud-collections.json?')));
});
test('manual read and save checks bypass short cache and do not falsely confirm a pending save',async()=>{
 let count=0,current=data();const reader=factory.create({fetch:async()=>{count++;return {ok:true,json:async()=>current};}});
 const p=C.profile(),initial=await reader.read('0731');C.reconcile(p,initial.backup,initial.sha);p.collections.one='已通关';p.dirty=true;p.pending={backup:C.backup(p.collections,'2026-11-12T01:00:00Z')};
 const old=await reader.read('0731',{force:true});assert.ok(!C.reconcile(p,old.backup,old.sha).saved);assert.ok(p.pending);
 current=data();current.profiles['0731']={sha:'c'.repeat(40),backup:p.pending.backup};const fresh=await reader.read('0731',{force:true});assert.ok(C.reconcile(p,fresh.backup,fresh.sha).saved);assert.equal(p.dirty,false);assert.equal(count,3);
});
test('rate limiting honors Retry-After across profiles instead of retrying in a loop',async()=>{
 let count=0,time=1000;const reader=factory.create({now:()=>time,fetch:async()=>{count++;if(count===1)return {ok:false,status:429,headers:{get:()=> '120'}};return {ok:true,json:async()=>data()};}});
 await assert.rejects(reader.read('0731'),/暂时受限/);for(let i=0;i<4;i++)await assert.rejects(reader.read('0425',{force:true}));assert.equal(count,1);
 time+=121000;await reader.read('0731',{force:true});assert.equal(count,2);
});
test('invalid or unavailable snapshots are rejected and existing local drafts survive',async()=>{
 for(const response of [{ok:false,status:404},{ok:true,json:async()=>({version:1,profiles:{}})},{ok:true,json:async()=>{const d=data();d.profiles['0731'].backup.collections.one='invalid';return d;}}]){
  const p=C.profile();p.collections={draft:'计划中'};p.dirty=true;const reader=factory.create({fetch:async()=>response});await assert.rejects(reader.read('0731'));assert.equal(p.collections.draft,'计划中');assert.ok(p.dirty);
 }
});
test('published snapshot pins the actual collections branch and exact Git blob hashes',()=>{
 const snapshot=collectionSnapshot();for(const uid of C.users){const object=snapshot.commit+':collections/'+uid+'.json';assert.equal(snapshot.profiles[uid].sha,execFileSync('git',['rev-parse',object],{encoding:'utf8'}).trim());assert.deepEqual(snapshot.profiles[uid].backup,JSON.parse(execFileSync('git',['show',object],{encoding:'utf8'})));}
});

test('ordinary network failure can be retried manually immediately; automatic retries back off',async()=>{
 let calls=0;const reader=factory.create({fetch:()=>{if(++calls===1)throw new TypeError('fetch failed');return Promise.resolve({ok:true,json:async()=>data()});}});
 await assert.rejects(reader.read('0731'),/请求失败/);await assert.rejects(reader.read('0731'));assert.equal(calls,1);const result=await reader.read('0731',{force:true});assert.equal(result.backup.collections.one,'正在游玩');assert.equal(calls,2);
});
test('Android without AbortSignal.timeout can read, time out and recover without a sticky promise',async()=>{
 let calls=0;const reader=factory.create({timeoutMs:15,fetch:()=>++calls===1?new Promise(()=>{}):Promise.resolve({ok:true,json:async()=>data()})});
 await assert.rejects(reader.read('0731'),/超时/);const result=await reader.read('0731',{force:true});assert.equal(result.sha,'a'.repeat(40));assert.equal(calls,2);
});
test('the timeout also bounds a stalled JSON response body',async()=>{
 const reader=factory.create({timeoutMs:15,fetch:async()=>({ok:true,json:()=>new Promise(()=>{})})});await assert.rejects(reader.read('0731'),/超时/);
});
test('HTTP and invalid JSON errors retain their actual cause instead of a generic network warning',async()=>{
 for(const [response,pattern] of [[{ok:false,status:503},/HTTP 503/],[{ok:true,json:async()=>{throw new SyntaxError('invalid');}},/有效 JSON/]]){const reader=factory.create({fetch:async()=>response});await assert.rejects(reader.read('0731'),pattern);}
});
