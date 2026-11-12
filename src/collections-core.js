(function(root){
 'use strict';
 const users=['0731','0425'],states=['已通关','正在游玩','计划中','未游玩','已弃坑'];
 function clean(value){if(!value||typeof value!=='object'||Array.isArray(value))throw Error('收藏数据应为对象');const result={};for(const [key,status] of Object.entries(value)){if(!key||key.length>256||['__proto__','constructor','prototype'].includes(key)||!states.includes(status))throw Error('收藏状态或标识无效');result[key]=status;}return result;}
 function parseBackup(value){if(value?.version===1&&Array.isArray(value.keys)&&value.keys.every(k=>typeof k==='string'))return clean(Object.fromEntries(value.keys.map(k=>[k,'未游玩'])));if(value?.version===2&&value.collections)return clean(value.collections);throw Error('请选择原格式的 version 1 或 version 2 收藏 JSON');}
 function backup(collections,date=new Date().toISOString()){const c=clean(collections);return {version:2,date,collections:c,keys:Object.keys(c)};}
 function same(a,b){const ka=Object.keys(a).sort(),kb=Object.keys(b).sort();return ka.length===kb.length&&ka.every((k,i)=>k===kb[i]&&a[k]===b[k]);}
 function profile(){return {collections:{},base:{},remote:null,sha:null,loaded:false,dirty:false,error:'',pending:null};}
 function read(storage,uid){if(!users.includes(uid))throw Error('未知用户');try{const p=JSON.parse(storage.getItem('vgtrace-profile-'+uid+'-v1')||'null');return p?{...profile(),...p,collections:clean(p.collections),base:clean(p.base||{})}:profile();}catch{return profile();}}
 function persist(storage,uid,p){storage.setItem('vgtrace-profile-'+uid+'-v1',JSON.stringify(p));}
 function legacy(storage){const old=storage.getItem('next-game-atlas-collections-v2'),v1=storage.getItem('next-game-atlas-favorites-v1');if(!storage.getItem('vgtrace-legacy-snapshot-v1')&&(old||v1))storage.setItem('vgtrace-legacy-snapshot-v1',JSON.stringify({date:new Date().toISOString(),v2:old,v1}));let result={};try{result=clean(JSON.parse(old||'{}'));}catch{}try{for(const key of JSON.parse(v1||'[]'))if(typeof key==='string'&&!result[key])Object.assign(result,clean({[key]:'未游玩'}));}catch{}return result;}
 function reconcile(p,remote,sha){const value=parseBackup(remote);const saved=p.pending&&p.pending.backup.date===remote.date&&same(p.pending.backup.collections,value);if(saved){p.sha=sha;p.base=value;p.pending=null;p.dirty=!same(p.collections,value);p.error='';}
  else if(!p.dirty&&!p.pending){p.collections=value;p.base=value;p.sha=sha;p.dirty=false;p.error='';}
  else if(!p.sha&&p.dirty&&!p.pending){const m=merge(p.base,p.collections,value);if(!m.conflicts.length){p.collections=m.collections;p.base=value;p.sha=sha;p.dirty=!same(p.collections,value);p.error='';}else p.error='本机原有收藏与云端有冲突；请点击读取云端处理。';}
  else if(p.sha!==sha){p.error='云端有新版本，本机修改已保留；保存会直接替换当前用户，也可读取云端合并。';}
  else p.error='';
  p.loaded=true;return {saved,conflict:!!p.error};
 }
 function merge(base,local,remote){const out={},conflicts=[];for(const k of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){const a=base[k],l=local[k],r=remote[k];let value;if(l===r)value=l;else if(l===a)value=r;else if(r===a)value=l;else{conflicts.push(k);continue;}if(value!==undefined)out[k]=value;}return {collections:out,conflicts};}
 root.VGTraceCollections={users,states,clean,parseBackup,backup,same,profile,read,persist,legacy,reconcile,merge};
 if(typeof module!=='undefined')module.exports=root.VGTraceCollections;
})(globalThis);
