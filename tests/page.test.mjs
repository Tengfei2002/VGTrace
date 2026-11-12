import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
const manifest=JSON.parse(fs.readFileSync('data/manifest.json','utf8')),db={meta:JSON.parse(fs.readFileSync('data/meta.json','utf8')),games:manifest.chunks.flatMap(p=>JSON.parse(fs.readFileSync('data/'+p,'utf8')))};
const html=fs.readFileSync('src/template.html','utf8');
const client=['collections-core.js','collections-import.js','client.js','collections-ui.js'].map(p=>fs.readFileSync('src/'+p,'utf8')).join('\n');
test('page interactions: independent profiles, migration, read-only peer, upload, save confirmation and existing tools',async()=>{
const elements=new Map(),all=[];
class Element{
 constructor(tag='div',attrs=''){this.tagName=tag.toUpperCase();this.value='';this.checked=false;this.hidden=false;this.open=false;this.dataset={};this.listeners={};this.classes=new Set();this.classList={toggle:(n,force)=>{const on=force===undefined?!this.classes.has(n):force;on?this.classes.add(n):this.classes.delete(n);return on;},add:n=>this.classes.add(n),remove:n=>this.classes.delete(n)};for(const [,key,value] of attrs.matchAll(/([\w-]+)="([^"]*)"/g)){if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;else this[key]=value;}this.hidden=/\bhidden(?:\s|$)/.test(attrs);all.push(this);if(this.id)elements.set(this.id,this);}
 set innerHTML(value){this._html=value;parse(value);}
 get innerHTML(){return this._html||'';}
 setAttribute(k,v){this[k]=v;}
 addEventListener(k,fn){this.listeners[k]=fn;}
 showModal(){this.open=true;}close(){this.open=false;}scrollIntoView(){}focus(){document.activeElement=this;}select(){this.selected=true;}
 appendChild(){}remove(){}click(){if(this.tagName==='A')downloads.push({name:this.download,blob:blobs.get(this.href)});else this.onclick?.({target:this,preventDefault(){}});}
 getBoundingClientRect(){return {left:0,top:0,right:700,bottom:700};}
}
function parse(text){for(const [,tag,attrs] of text.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi))if(/\bid="|\bname="collection-status"|\bdata-view=|\bclass="brand"/.test(attrs))new Element(tag,attrs);}
parse(html.slice(0,html.indexOf('<script id="catalog-data"')));
elements.get('sort').value='recommended';
elements.get('catalog-data')||new Element('script','id="catalog-data"');elements.get('catalog-data').textContent=JSON.stringify(db);
const checkboxes=()=>all.filter(e=>e.name==='collection-status');
const document={getElementById:id=>elements.get(id)||null,querySelector:s=>s==='.brand'?all.find(e=>e.class==='brand'):null,querySelectorAll:s=>s==='[data-view]'?all.filter(e=>e.dataset.view):s.includes('collection-status')?checkboxes().filter(e=>!s.includes(':checked')||e.checked):[],addEventListener(){},createElement:tag=>new Element(tag),body:{appendChild(){}},execCommand:()=>true,activeElement:{tagName:'BODY'}};

const values=new Map([['next-game-atlas-favorites-v1',JSON.stringify(['stardewvalley'])]]),downloads=[],blobs=new Map();let copied='';
const remote={};for(const uid of ['0731','0425'])remote[uid]={sha:(uid==='0731'?'a':'b').repeat(40),backup:{version:2,date:'2026-11-12T00:00:00Z',collections:{},keys:[]}};
const sandbox={document,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},navigator:{clipboard:{writeText:async v=>{copied=v;}}},location:{hash:''},history:{replaceState(){}},window:{scrollTo(){},addEventListener(){}},setTimeout:()=>1,clearTimeout(){},Blob,URL:{createObjectURL:blob=>{const url='blob:test-'+blobs.size;blobs.set(url,blob);return url;},revokeObjectURL(){}},console,crypto:{randomUUID},TextDecoder,atob,AbortSignal,confirm:()=>true,fetch:async url=>{const uid=url.includes('0731.json')?'0731':'0425',r=remote[uid];return {ok:true,json:async()=>({sha:r.sha,encoding:'base64',content:Buffer.from(JSON.stringify(r.backup)).toString('base64')})};}};
vm.createContext(sandbox);vm.runInContext(client,sandbox,{timeout:20000});
const run=s=>vm.runInContext(s,sandbox,{timeout:20000}),game=id=>db.games.find(g=>g.appid===id),names=()=>JSON.parse(run('JSON.stringify(filtered.map(g=>g.key))'));
assert.ok(html.match(/id="upload-collections"[^>]*>[^<]*CSV/));assert.ok(elements.get('import-file').accept.includes('.csv'));
assert.ok(elements.get('profile-dialog').open);assert.equal(run('activeProfile'),null);
await run("chooseProfile('0731');readProfile('0731')");elements.get('legacy-import').onclick();assert.equal(run('collections.stardewvalley'),'未游玩');assert.equal(values.get('vgtrace-legacy-claimed-by'),'0731');assert.equal(values.get('next-game-atlas-favorites-v1'),'["stardewvalley"]');assert.ok(values.get('vgtrace-legacy-snapshot-v1'));
const target=game(4115450),second=game(4348910);run('resetFilters()');
for(const state of ['已通关','正在游玩','计划中','未游玩','已弃坑']){run('changeStatus('+target.id+','+JSON.stringify(state)+')');assert.equal(JSON.parse(values.get('vgtrace-profile-0731-v1')).collections[target.key],state);}
await run("chooseProfile('0425')");assert.ok(elements.get('switch-dialog').open);assert.equal(run('activeProfile'),'0731');elements.get('switch-keep').onclick();await run("readProfile('0425')");assert.equal(run('activeProfile'),'0425');assert.equal(run('Object.keys(collections).length'),0);
run('setPage("favorites");viewedProfile="0731";profileRefresh();applyFilters()');assert.ok(run('isPeerView()'));assert.ok(!names().includes(target.key),'peer view must use confirmed cloud, not the other local draft');run('changeStatus('+target.id+',"计划中")');assert.equal(run('Object.keys(collections).length'),0);
remote['0731'].backup={version:2,date:'2026-11-12T00:30:00Z',collections:{[second.key]:'计划中'},keys:[second.key]};remote['0731'].sha='c'.repeat(40);await run("readProfile('0731')");assert.ok(names().includes(second.key));assert.ok(run('statusControl(G.find(g=>g.appid===4348910))').includes('peer-status'));assert.ok(elements.get('filters').hidden);
run('viewedProfile=activeProfile;setPage("explore");resetFilters()');
await elements.get('import-file').onchange({target:{files:[{text:async()=>JSON.stringify({version:1,keys:[second.key]})}]}});assert.equal(run('collections['+JSON.stringify(second.key)+']'),'未游玩');
await elements.get('import-file').onchange({target:{files:[{text:async()=>JSON.stringify({version:2,collections:{[target.key]:'已通关'}})}]}});assert.equal(run('collections['+JSON.stringify(target.key)+']'),'已通关');assert.equal(run('profiles["0731"].collections['+JSON.stringify(target.key)+']'),'已弃坑');
elements.get('backup-favorites').onclick();const backup=JSON.parse(await downloads.at(-1).blob.text());assert.equal(backup.version,2);assert.deepEqual(backup.keys.sort(),Object.keys(backup.collections).sort());assert.equal(backup.collections[target.key],'已通关');assert.ok(downloads.at(-1).name.includes('0425'));
await run('requestSave()');assert.ok(elements.get('save-request-dialog').open);const saveURL=new URL(elements.get('save-request-open').href),body=saveURL.searchParams.get('body'),request=JSON.parse(body.match(/vgtrace-sync\s*([\s\S]*?)\x60\x60\x60/)[1]);assert.equal(request.userId,'0425');assert.equal(request.backup.version,2);assert.ok(run('profiles["0425"].pending'));assert.ok(run('profiles["0425"].dirty'));
elements.get('save-request-close').onclick();assert.equal(elements.get('cloud-save').disabled,false);assert.equal(await run('requestSave()'),true);assert.ok(elements.get('save-request-dialog').open);elements.get('save-request-close').onclick();
run('changeStatus('+second.id+',"正在游玩")');remote['0425'].backup=request.backup;remote['0425'].sha='d'.repeat(40);await run("readProfile('0425')");assert.equal(run('profiles["0425"].pending'),null);assert.ok(run('profiles["0425"].dirty'));assert.equal(run('collections['+JSON.stringify(second.key)+']'),'正在游玩');
// A conflicting read must block save until a merge decision.
remote['0425'].backup={...request.backup,collections:{...request.backup.collections,[second.key]:'已弃坑'}};remote['0425'].sha='e'.repeat(40);await run("readProfile('0425',true)");assert.ok(elements.get('conflict-dialog').open);assert.equal(await run('requestSave()'),false);elements.get('conflict-local').onclick();assert.equal(run('collections['+JSON.stringify(second.key)+']'),'正在游玩');assert.ok([...values.keys()].some(k=>k.startsWith('vgtrace-snapshot-0425-')));
// Import an actual current CSV export into only the active user's collections.
run('setPage("favorites");viewedProfile=activeProfile;resetFilters();exportCSV()');
const csvFile=await downloads.at(-1).blob.text();assert.ok(csvFile.includes('游戏标识'));assert.ok(csvFile.includes('Steam AppID'));
run('changeStatus('+target.id+',"计划中")');
await elements.get('import-file').onchange({target:{files:[{name:'VGTrace.csv',text:async()=>csvFile}]}});
assert.equal(run('collections['+JSON.stringify(target.key)+']'),'已通关');assert.equal(run('profiles["0731"].collections['+JSON.stringify(target.key)+']'),'已弃坑');
// A bad CSV must leave the entire local state unchanged.
const beforeCSV=run('JSON.stringify(collections)');
await elements.get('import-file').onchange({target:{files:[{name:'bad.csv',text:async()=> '游戏标识,收藏夹\n'+target.key+',无效状态'}]}});
assert.equal(run('JSON.stringify(collections)'),beforeCSV);
await elements.get('import-file').onchange({target:{files:[{name:'empty.csv',text:async()=> '游戏标识,收藏夹\n'+target.key+','}]}});
assert.equal(run('JSON.stringify(collections)'),beforeCSV);
run('setPage("explore")');
// Existing discovery, table, adult descriptions and maintenance exports still work.
for(const id of [4115450,4348910,3219030,3265700,1478500]){run('resetFilters()');elements.get('search').value=id===1478500?'和睦森林':game(id).zh;run('applyFilters()');assert.ok(names().includes(game(id).key));}
run('resetFilters()');for(const [id,value] of Object.entries({genre:'模拟经营',platform:'Steam',duration:'long',developer:'Questing Goose'}))elements.get(id).value=value;run('applyFilters()');assert.deepEqual(names(),[second.key]);
run('setView("table")');assert.ok(elements.get('results').innerHTML.includes('<table>'));run('randomGame()');assert.ok(elements.get('detail-content').innerHTML.includes('深空当铺'));elements.get('detail-dialog').close();
run('setPage("explore");resetFilters()');elements.get('search').value='和睦森林';run('applyFilters();exportCSV()');assert.ok((await downloads.at(-1).blob.text()).includes('和睦森林'));
run('resetFilters();setPage("adult");setView("table")');assert.equal(names().length,201);for(const word of ['扮演谁','具体怎么玩','成人内容体现'])assert.ok(elements.get('results').innerHTML.includes(word));
await elements.get('copy-maintenance').onclick();assert.equal(copied,db.meta.maintenancePrompt);elements.get('download-maintenance').onclick();assert.equal((await downloads.at(-1).blob.text()).replace(/^\ufeff/,''),copied);
});
