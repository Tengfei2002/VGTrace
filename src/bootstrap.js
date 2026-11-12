const box=document.getElementById('vgtrace-loading');
const label=document.getElementById('vgtrace-loading-text');
document.getElementById('vgtrace-retry').addEventListener('click',()=>location.reload());
async function json(path){const response=await fetch(new URL(path,import.meta.url));if(!response.ok)throw Error(`HTTP ${response.status}: ${path}`);return response.json();}
try{
 const manifest=await json('./data/manifest.json');let count=0;
 const [meta,...chunks]=await Promise.all([json('./data/meta.json'),...manifest.chunks.map(async p=>{const rows=await json('./data/'+p);label.textContent=`正在载入游戏资料 ${++count} / ${manifest.chunks.length}…`;return rows;})]);
 const games=chunks.flat();if(games.length!==manifest.count||games.length!==meta.count)throw Error('Incomplete game library');
 globalThis.__VGTRACE_DATA__={meta,games};await import('./client.js');delete globalThis.__VGTRACE_DATA__;
 document.querySelector('.shell').inert=false;box.remove();
}catch(error){console.error(error);label.textContent='资料加载失败，请检查网络后重试。';document.getElementById('vgtrace-retry').hidden=false;}
