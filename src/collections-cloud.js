(function(root){
 'use strict';
 // Read a single atomically published Pages snapshot; never call the browser REST API.
 function create({fetch:fetchFile,now=()=>Date.now(),url='./cloud-collections.json',ttl=20000,timeoutMs=15000}={}){
  let cached=null,expires=0,inFlight=null,retryAt=0,rateRetryAt=0,lastError=null;
  function validate(value){
   if(value?.version!==1||!value.profiles)throw Error('已发布的收藏格式无效，本机数据已保留。');
   for(const uid of root.VGTraceCollections.users){const p=value.profiles[uid];if(!p||!/^[0-9a-f]{40}$/.test(p.sha)||p.backup?.version!==2||typeof p.backup.date!=='string'||!Number.isFinite(Date.parse(p.backup.date)))throw Error('已发布的收藏版本无效，本机数据已保留。');root.VGTraceCollections.parseBackup(p.backup);}
   return value;
  }
  function limited(until){return Error('收藏读取暂时受限，请约 '+Math.max(1,Math.ceil((until-now())/1000))+' 秒后重试；本机数据已保留。');}
  function httpError(response){
   if(response.status===429){const after=response.headers?.get('retry-after'),seconds=Number(after),date=Date.parse(after);const delay=Number.isFinite(seconds)?seconds*1000:Number.isFinite(date)?date-now():60000;const until=now()+Math.max(60000,delay);return Object.assign(limited(until),{rateRetryAt:until});}
   return Error(response.status===404?'收藏文件尚未发布（HTTP 404），请等待网站更新；本机数据已保留。':'收藏服务器返回 HTTP '+response.status+'，请稍后重试；本机数据已保留。');
  }
  async function request(){
   // Some Android WebViews lack AbortSignal.timeout. Bound both headers and body
   // with an ordinary timer, and abort the transfer where AbortController exists.
   const controller=typeof root.AbortController==='function'?new root.AbortController():null;let timer;
   const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(Object.assign(Error('读取云端超时（'+Math.ceil(timeoutMs/1000)+'秒），请点击重试；本机数据已保留。'),{code:'CLOUD_TIMEOUT'}));controller?.abort();},timeoutMs);});
   const work=Promise.resolve().then(async()=>{
    const response=await fetchFile(url+(url.includes('?')?'&':'?')+'v='+now(),{cache:'no-store',...(controller?{signal:controller.signal}:{})});
    if(!response.ok)throw httpError(response);
    let value;try{value=await response.json();}catch(error){if(error?.name==='SyntaxError')throw Error('收藏服务器返回的内容不是有效 JSON；本机数据已保留。');throw error;}
    return validate(value);
   });
   try{return await Promise.race([work,deadline]);}finally{clearTimeout(timer);}
  }
  async function load(force){
   if(inFlight)return inFlight;
   if(!force&&cached&&now()<expires)return cached;
   if(now()<rateRetryAt)throw limited(rateRetryAt);
   if(!force&&now()<retryAt)throw lastError;
   // Schedule after assigning inFlight so a synchronous setup/fetch failure can
   // never leave this slot stuck pointing at an already-rejected promise.
   inFlight=Promise.resolve().then(async()=>{
    try{
     cached=await request();expires=now()+ttl;lastError=null;retryAt=0;rateRetryAt=0;return cached;
    }catch(error){cached=null;expires=0;retryAt=now()+15000;rateRetryAt=error.rateRetryAt||0;lastError=error?.name==='TypeError'?Error('无法连接收藏服务器（请求失败），请点击重试；本机数据已保留。'):error;throw lastError;}
   }).finally(()=>{inFlight=null;});return inFlight;
  }
  return {async read(uid,{force=false}={}){if(!root.VGTraceCollections.users.includes(uid))throw Error('未知用户');const snapshot=await load(force);return snapshot.profiles[uid];}};
 }
 root.VGTraceCloud={create};
})(globalThis);
