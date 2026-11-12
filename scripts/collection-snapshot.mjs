import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import fs from 'node:fs';
const sandbox={};vm.runInNewContext(fs.readFileSync(new URL('../src/collections-core.js',import.meta.url),'utf8'),sandbox);
export function collectionSnapshot(ref='refs/remotes/origin/collections'){
 if(!/^refs\/[A-Za-z0-9/_.-]+$/.test(ref))throw Error('Invalid collections ref');
 // Pin one commit so both users and blob hashes come from the same repository revision.
 const commit=execFileSync('git',['rev-parse','--verify',ref],{encoding:'utf8'}).trim();
 const profiles={};
 for(const uid of sandbox.VGTraceCollections.users){
  const object=commit+':collections/'+uid+'.json';
  const sha=execFileSync('git',['rev-parse',object],{encoding:'utf8'}).trim();
  const backup=JSON.parse(execFileSync('git',['show',object],{encoding:'utf8',maxBuffer:8*1024*1024}));
  sandbox.VGTraceCollections.parseBackup(backup);
  if(!/^[0-9a-f]{40}$/.test(sha)||backup.version!==2||typeof backup.date!=='string'||!Number.isFinite(Date.parse(backup.date)))throw Error('Invalid cloud backup: '+uid);
  profiles[uid]={sha,backup};
 }
 return {version:1,commit,profiles};
}
