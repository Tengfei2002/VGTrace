(function(root){
 'use strict';
 // Read a single atomically published Pages snapshot; never call the browser REST API.
 function create({fetch:fetchFile,now=()=>Date.now(),url='./cloud-collections.json',ttl=20000}={}){
  let cached=null,expires=0,inFlight=null,retryAt=0,lastError=null;
  function validate(value){
   if(value?.version!==1||!value.profiles)throw Error('已发布的收藏格式无效，本机数据已保留。');
   for(const uid of root.VGTraceCollections.users){const p=value.profiles[uid];if(!p||!/^[0-9a-f]{40}$/.test(p.sha)||p.backup?.version!==2||typeof p.backup.date!=='string'||!Number.isFinite(Date.parse(p.backup.date)))throw Error('已发布的收藏版本无效，本机数据已保留。');root.VGTraceCollections.parseBackup(p.backup);}
   return value;
  }
  async function load(force){
   if(inFlight)return inFlight;
   if(!force&&cached&&now()<expires)return cached;
   if(now()<retryAt)throw lastError;
   inFlight=(async()=>{
    try{
     const response=await fetchFile(url+(url.includes('?')?'&':'?')+'v='+now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});
     if(!response.ok){if(response.status===429){const after=response.headers?.get('retry-after'),seconds=Number(after);retryAt=now()+Math.max(60000,Number.isFinite(seconds)?seconds*1000:Math.max(0,Date.parse(after)-now())||60000);}throw Error(response.status===404?'收藏快照尚未发布，请等待网站更新；本机数据已保留。':response.status===429?'收藏读取暂时受限，请稍后重试；本机数据已保留。':'暂时无法读取云端收藏，请检查网络；本机数据已保留。');}
     cached=validate(await response.json());expires=now()+ttl;lastError=null;retryAt=0;return cached;
    }catch(error){cached=null;expires=0;retryAt=Math.max(retryAt,now()+15000);lastError=error?.name==='TimeoutError'||error?.name==='TypeError'?Error('暂时无法读取云端收藏，请检查网络；本机数据已保留。'):error;throw lastError;}
    finally{inFlight=null;}
   })();return inFlight;
  }
  return {async read(uid,{force=false}={}){if(!root.VGTraceCollections.users.includes(uid))throw Error('未知用户');const snapshot=await load(force);return snapshot.profiles[uid];}};
 }
 root.VGTraceCloud={create};
})(globalThis);
