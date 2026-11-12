import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const sandbox={};
for(const f of ['collections-core.js','collections-import.js'])vm.runInNewContext(fs.readFileSync(new URL('../src/'+f,import.meta.url),'utf8'),sandbox);
const I=sandbox.VGTraceCollectionImport,plain=x=>JSON.parse(JSON.stringify(x));
const games=[{key:'first',id:10,appid:100,name:'Game, "One"',zh:'第一款',aliases:['常用名']},{key:'second',id:20,appid:200,name:'Second',zh:'同名'},{key:'third',id:30,name:'Third',zh:'同名'}];
test('UTF-8 BOM, CRLF, quoted commas, escaped quotes and multiline fields',()=>{
 const text='\ufeff游戏标识,原名,玩法概要,收藏夹\r\nfirst,"Game, ""One""","line 1\r\nline 2",正在游玩\r\nsecond,Second,,\r\n';
 const r=I.parse(text,games,'export.csv');assert.deepEqual(plain(r.collections),{first:'正在游玩'});assert.equal(r.stats.empty,1);
});
test('legacy export IDs, AppIDs and unique existing names all match without fuzzy guesses',()=>{
 assert.deepEqual(plain(I.parseCSV('编号,收藏夹\n10,已通关',games).collections),{first:'已通关'});
 assert.deepEqual(plain(I.parseCSV('Steam AppID,收藏状态\n200,计划中',games).collections),{second:'计划中'});
 const r=I.parseCSV('名称,状态\n常用名,未游玩\n同名,已弃坑\nUnknown,计划中',games);assert.deepEqual(plain(r.collections),{first:'未游玩'});assert.equal(r.stats.ambiguous,1);assert.equal(r.stats.unknown,1);
});
test('stable keys take priority; unknown keys never fall back to unrelated IDs or names',()=>{
 const r=I.parseCSV('游戏标识,编号,名称,收藏夹\nmissing,10,第一款,已通关',games);assert.equal(Object.keys(r.collections).length,0);assert.equal(r.stats.unknown,1);
 assert.throws(()=>I.parseCSV('游戏标识,Steam AppID,收藏夹\nfirst,200,计划中',games),/不一致/);
});
test('missing headers, malformed quoting, uneven rows and invalid statuses reject the entire file',()=>{
 for(const text of ['名称\n第一款','收藏夹\n计划中','游戏标识,收藏夹\nfirst,invalid','游戏标识,收藏夹\nfirst,已通关\nsecond,计划中,extra','游戏标识,收藏夹\n"first,已通关','游戏标识,收藏夹\n"first"oops,已通关','游戏标识,收藏夹,收藏夹\nfirst,已通关,已通关'])assert.throws(()=>I.parseCSV(text,games));
});
test('duplicate games merge once, conflicting statuses reject and blank states never delete',()=>{
 const r=I.parseCSV('游戏标识,收藏夹\nfirst,已通关\nfirst,已通关\nsecond,',games);assert.deepEqual(plain(r.collections),{first:'已通关'});assert.equal(r.stats.duplicates,1);assert.equal(r.stats.empty,1);
 assert.throws(()=>I.parseCSV('游戏标识,收藏夹\nfirst,已通关\nfirst,已弃坑',games),/不同收藏状态/);
});
test('Excel separator directive and the original JSON backup formats remain compatible',()=>{
 assert.deepEqual(plain(I.parseCSV('sep=;\r\n游戏标识;收藏夹\r\nfirst;已弃坑',games).collections),{first:'已弃坑'});
 for(const [value,expected] of [[{version:1,keys:['old-key']},{'old-key':'未游玩'}],[{version:2,collections:{first:'计划中'}},{first:'计划中'}]])assert.deepEqual(plain(I.parse('\ufeff'+JSON.stringify(value),games,'backup.json').collections),expected);
});
