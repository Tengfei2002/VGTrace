function displayedCollections(){return activeView==='favorites'&&viewedProfile&&viewedProfile!==activeProfile?(profiles[viewedProfile].remote||profiles[viewedProfile].base):collections;}
function isPeerView(){return activeView==='favorites'&&viewedProfile&&viewedProfile!==activeProfile;}
function storeProfile(uid){try{CollectionCore.persist(profileStorage,uid,profiles[uid]);/* Keep the existing storage availability flag. */}catch{storageOK=false;toast('本机存储受限，请先下载收藏备份。');}}
function profileRefresh(){
 const p=activeProfile?profiles[activeProfile]:null;
 const readUid=isPeerView()?viewedProfile:activeProfile,reading=!!cloudReadState[readUid],readTime=cloudReadAt[readUid]?new Date(cloudReadAt[readUid]).toLocaleTimeString('zh-CN',{hour12:false}):'';
 $('choose-profile').textContent=activeProfile?'用户 '+activeProfile+' ▾':'选择用户 ▾';
 $('cloud-save').disabled=!activeProfile;$('cloud-save').textContent=p?.pending?'查看保存请求':'保存到云端';
 $('cloud-read').disabled=!readUid||reading;$('cloud-read').textContent=reading?'读取中…':isPeerView()?'读取对方收藏':'读取云端';$('cloud-read').setAttribute('aria-busy',String(reading));$('upload-collections').disabled=!activeProfile;
 const readProfileData=readUid?profiles[readUid]:null;
 $('cloud-status').textContent=reading?'正在读取 '+readUid+' 的云端收藏…':pendingConflict?.uid===readUid?'已读取云端，请选择保留哪份收藏':isPeerView()?(readProfileData.error||('正在查看 '+readUid+' 的云端收藏 · 只读')):!p?'选择 0731 或 0425，载入独立收藏夹':p.pending?(p.error?'保存请求待确认 · '+p.error+' 可查看请求并停止本机等待后重试':'保存请求待确认 · 等待GitHub保存并发布收藏'):p.error||(!p.loaded?'尚未读取云端收藏':p.dirty?'本机有未保存到云端的修改':'已与云端同步');
 if(!reading&&readTime)$('cloud-status').textContent+=' · 最近读取 '+readTime;

 $('profile-tabs').hidden=activeView!=='favorites';
 $('profile-tabs').innerHTML=CollectionCore.users.map(uid=>`<button data-peek="${uid}" class="chip ${(viewedProfile||activeProfile)===uid?'selected':''}">${uid} 的收藏${uid===activeProfile?' · 我':''}</button>`).join('')+(isPeerView()?'<span class="peer-note">正在查看对方收藏 · 只读</span>':'');
 if(activeView==='favorites'){$('catalog-heading').textContent=(viewedProfile||activeProfile||'未选择用户')+' · '+(folder||'全部收藏');$('catalog-description').textContent=isPeerView()?'可查看对方的五类收藏；编辑和保存只针对当前选择的用户。':'修改先保存在本机，点击“保存到云端”并在GitHub确认后同步其他设备。';}
}
const cloudReader=globalThis.VGTraceCloud.create({fetch:(...args)=>fetch(...args),url:location.protocol==='file:'?'https://tengfei2002.github.io/VGTrace/cloud-collections.json':'./cloud-collections.json'});
async function getCloud(uid,force=false){return cloudReader.read(uid,{force});}
function refreshProfileView(uid){
 if(uid===activeProfile){collections=profiles[uid].collections;favorites=new Set(Object.keys(collections));}
 profileRefresh();drawFolders();applyFilters(false);
}
function offerCloudChoice(uid,remote){
 const p=profiles[uid],cloud=remote.backup.collections;
 const differences=[...new Set([...Object.keys(p.collections),...Object.keys(cloud)])].filter(k=>p.collections[k]!==cloud[k]);
 const merge=CollectionCore.merge(p.base,p.collections,cloud);pendingConflict={uid,remote,merge};
 const lines=differences.slice(0,5).map(k=>{const g=G.find(g=>g.key===k);return (g?title(g):k)+'：本机 '+(p.collections[k]||'未收藏')+' ／ 云端 '+(cloud[k]||'未收藏');});
 $('conflict-text').textContent='用户 '+uid+'：本机 '+Object.keys(p.collections).length+' 款，云端 '+Object.keys(cloud).length+' 款；'+differences.length+' 款不同。'+(merge.conflicts.length?'其中 '+merge.conflicts.length+' 款两边都有不同修改。':'')+'\n'+lines.join('\n')+(differences.length>5?'\n…其余 '+(differences.length-5)+' 款':'')+'\n保留本机只保留本机这一份；合并会纳入两边修改，冲突项采用本机。选择前会保留本机快照。'+(p.pending?'\n仍有保存请求等待发布；使用云端只停止本机等待，不会撤销已提交到GitHub的请求。':'');
 if(!$('conflict-dialog').open)$('conflict-dialog').showModal();profileRefresh();
}
function readProfile(uid,manual=false){
 if(!CollectionCore.users.includes(uid))return Promise.resolve();
 if(cloudReadTasks[uid]){if(manual)cloudReadState[uid].manual=true;return cloudReadTasks[uid];}
 if(!manual&&pendingConflict?.uid===uid)return Promise.resolve();
 const state={manual};cloudReadState[uid]=state;profileRefresh();
 const task=(async()=>{
  const p=profiles[uid];
  try{
   const remote=await getCloud(uid,state.manual||!!p.pending);p.remote=CollectionCore.clean(remote.backup.collections);cloudReadAt[uid]=Date.now();p.error='';
   let result={saved:false};
   // A real save confirmation may clear a pending request while retaining edits made later.
   if(p.pending&&p.pending.backup.date===remote.backup.date&&CollectionCore.same(p.pending.backup.collections,remote.backup.collections))result=CollectionCore.reconcile(p,remote.backup,remote.sha);
   if(uid!==activeProfile&&!p.pending&&!result.saved){p.loaded=true;storeProfile(uid);if(state.manual)toast('已更新 '+uid+' 的云端收藏（只读）');return;}
   const differs=!CollectionCore.same(p.collections,remote.backup.collections);
   if(state.manual&&uid===activeProfile&&differs&&(p.dirty||p.pending)){
    p.loaded=true;offerCloudChoice(uid,remote);storeProfile(uid);return;
   }
   if(!result.saved)result=CollectionCore.reconcile(p,remote.backup,remote.sha);
   storeProfile(uid);
   if(result.saved){toast(uid+' 云端保存已确认');if(pendingSwitch&&uid===activeProfile){const next=pendingSwitch;pendingSwitch=null;if(!p.dirty)await chooseProfile(next);else toast('保存后还有本机新修改，可读取云端后选择保留版本。');}}
   else if(state.manual)toast(uid!==activeProfile?'已更新 '+uid+' 的云端收藏（只读）':p.pending?'已读取，收藏内容一致；保存请求仍等待发布确认':'已读取云端，'+(differs?'已更新本机收藏。':'收藏与本机一致。'));
  }catch(error){p.error=error.message;storeProfile(uid);if(state.manual)toast(p.error);}
  finally{delete cloudReadState[uid];delete cloudReadTasks[uid];refreshProfileView(uid);}
 })();cloudReadTasks[uid]=task;return task;
}
function chooseDialog(){$('profile-dialog').showModal();}
async function chooseProfile(uid){
 if(!CollectionCore.users.includes(uid))return;
 if(uid===activeProfile){$('profile-dialog').close();return;}
 if(activeProfile&&(profiles[activeProfile].dirty||profiles[activeProfile].pending)){pendingSwitch=uid;$('profile-dialog').close();$('switch-dialog').showModal();return;}
 activateProfile(uid);
}
function activateProfile(uid){
 if(!CollectionCore.users.includes(uid))return;for(const id of ['detail-dialog','legacy-dialog'])if($(id).open)$(id).close();
 activeProfile=uid;viewedProfile=uid;collections=profiles[uid].collections;favorites=new Set(Object.keys(collections));folder='';$('profile-dialog').close();
 profileRefresh();applyFilters();drawFolders();readProfile(uid);
 setTimeout(()=>{try{if(activeProfile!==uid)return;if(!profileStorage.getItem('vgtrace-legacy-claimed-by')&&Object.keys(legacyCollections).length){$('legacy-message').textContent=`检测到此前本机的 ${Object.keys(legacyCollections).length} 条收藏。是否导入到当前用户 ${uid}？原数据和迁移前快照均保留。`;$('legacy-dialog').showModal();}}catch{}},200);
}
function localSnapshot(uid){try{profileStorage.setItem('vgtrace-snapshot-'+uid+'-'+Date.now()+'-'+crypto.randomUUID(),JSON.stringify(CollectionCore.backup(profiles[uid].collections)));}catch{download('VGTrace_'+uid+'_合并前备份.json',JSON.stringify(CollectionCore.backup(profiles[uid].collections),null,2),'application/json');toast('本机快照空间不足，已请求下载合并前备份。');} }
async function requestSave(){
 if(!activeProfile){chooseDialog();return false;}const uid=activeProfile,p=profiles[uid];
 if(p.pending){openSaveDialog();return true;}
 if(!p.loaded||!p.sha){await readProfile(uid,true);if(!p.loaded||!p.sha){toast('请先成功读取云端版本；本机收藏不会丢失。');return false;}}
 const backup=CollectionCore.backup(p.collections),requestId=crypto.randomUUID();p.error='';p.pending={backup,requestId,baseSha:p.sha};storeProfile(uid);openSaveDialog();profileRefresh();return true;
}
function openSaveDialog(){
 const uid=activeProfile,p=profiles[uid],request={version:1,userId:uid,requestId:p.pending.requestId,baseSha:p.pending.baseSha,backup:p.pending.backup};
 let body='```vgtrace-sync\n'+JSON.stringify(request)+'\n```';let url='https://github.com/Tengfei2002/VGTrace/issues/new?title='+encodeURIComponent('VGTrace 收藏同步 · '+uid+' · '+p.pending.requestId)+'&body='+encodeURIComponent(body);
 const attachment=url.length>7000;
 if(attachment){body='```vgtrace-sync\n'+JSON.stringify({...request,backup:undefined,attachment:true})+'\n```\n\n请将刚下载的收藏JSON拖入这里，等待附件上传完成，然后提交。';url='https://github.com/Tengfei2002/VGTrace/issues/new?title='+encodeURIComponent('VGTrace 收藏同步 · '+uid+' · '+p.pending.requestId)+'&body='+encodeURIComponent(body);}
 $('save-request-text').textContent='本次提交将直接替换用户 '+uid+' 的云端收藏，自动保存，无需人工审查。'+(attachment?'收藏较多：先下载下方原格式JSON，在GitHub确认页拖入该文件后提交。':'在GitHub确认页点击“Submit new issue／Create”后，Actions会保存并发布收藏，可能需要约一分钟。只有读到发布结果才会标为已同步。');
 $('save-request-open').href=url;$('save-request-download').hidden=!attachment;$('save-request-download').onclick=()=>download(`VGTrace_${uid}_收藏备份.json`,JSON.stringify(p.pending.backup,null,2),'application/json');
 $('save-request-dialog').showModal();
}
function resolveConflict(mode){
 if(!pendingConflict)return;const {uid,remote}=pendingConflict,p=profiles[uid];localSnapshot(uid);
 let result;
 if(mode==='remote'){result=CollectionCore.parseBackup(remote.backup);p.pending=null;if(uid===activeProfile)pendingSwitch=null;}
 else if(mode==='merge'){
  const merged=CollectionCore.merge(p.base,p.collections,remote.backup.collections);result=merged.collections;
  for(const key of merged.conflicts)if(p.collections[key]!==undefined)result[key]=p.collections[key];
 }else result=CollectionCore.clean(p.collections);
 p.collections=result;p.base=CollectionCore.parseBackup(remote.backup);p.sha=remote.sha;p.loaded=true;p.error='';p.dirty=!CollectionCore.same(result,p.base);storeProfile(uid);
 pendingConflict=null;$('conflict-dialog').close();refreshProfileView(uid);
 toast(mode==='remote'?'已使用云端收藏，本机原版本已留快照。':mode==='merge'?'已合并收藏；冲突项保留本机，尚未保存到云端。':'已保留本机收藏'+(p.dirty?'，尚未保存到云端。':'，与云端一致。'));
}
function cancelCloudChoice(){if(!pendingConflict)return;pendingConflict=null;$('conflict-dialog').close();profileRefresh();toast('已取消替换，本机收藏保持不变。');}
function initProfileUI(){
 $('choose-profile').onclick=chooseDialog;$('cloud-save').onclick=requestSave;$('cloud-read').onclick=()=>{const uid=isPeerView()?viewedProfile:activeProfile;return uid?readProfile(uid,true):chooseDialog();};$('upload-collections').onclick=()=>{$('import-file').click();};
 $('profile-close').onclick=()=>$('profile-dialog').close();
 for(const uid of CollectionCore.users)$('select-'+uid).onclick=()=>chooseProfile(uid);
 $('switch-save').onclick=async()=>{const next=pendingSwitch;$('switch-dialog').close();pendingSwitch=null;if(await requestSave())pendingSwitch=next;};
 $('switch-keep').onclick=()=>{const uid=pendingSwitch;pendingSwitch=null;$('switch-dialog').close();activateProfile(uid);};
 $('switch-dialog').addEventListener('cancel',()=>{pendingSwitch=null;});
 $('switch-cancel').onclick=()=>{pendingSwitch=null;$('switch-dialog').close();};
 $('legacy-import').onclick=()=>{localSnapshot(activeProfile);collections={...legacyCollections,...collections};saveFav();try{profileStorage.setItem('vgtrace-legacy-claimed-by',activeProfile);}catch{}$('legacy-dialog').close();applyFilters();};$('legacy-skip').onclick=()=>$('legacy-dialog').close();
 $('conflict-local').onclick=()=>resolveConflict('local');$('conflict-remote').onclick=()=>resolveConflict('remote');$('conflict-merge').onclick=()=>resolveConflict('merge');$('conflict-cancel').onclick=cancelCloudChoice;$('conflict-dialog').addEventListener('cancel',cancelCloudChoice);
 $('save-request-close').onclick=()=>$('save-request-dialog').close();$('save-request-cancel').onclick=()=>{profiles[activeProfile].pending=null;pendingSwitch=null;storeProfile(activeProfile);$('save-request-dialog').close();profileRefresh();};
 $('save-request-open').onclick=()=>{if($('save-request-download').hidden===false)$('save-request-download').onclick();$('save-request-dialog').close();pollCount=0;clearTimeout(pollTimer);pollTimer=setTimeout(checkPendingSaves,6000);};
 document.addEventListener('click',e=>{const el=e.target.closest('[data-peek]');if(el){viewedProfile=el.dataset.peek;folder='';setPage('favorites');profileRefresh();readProfile(viewedProfile);}});
 window.addEventListener('focus',()=>{for(const uid of CollectionCore.users)if(profiles[uid].pending)readProfile(uid);});
 window.addEventListener('beforeunload',e=>{if(activeProfile&&(profiles[activeProfile].dirty||profiles[activeProfile].pending)){e.preventDefault();e.returnValue='';}});
 profileRefresh();chooseDialog();
}
async function checkPendingSaves(){const uids=CollectionCore.users.filter(uid=>profiles[uid].pending);if(!uids.length)return;await Promise.all(uids.map(uid=>readProfile(uid)));if(++pollCount<9)pollTimer=setTimeout(checkPendingSaves,Math.min(30000,6000*2**pollCount));else toast('尚未确认云端保存；本机修改仍保留。完成GitHub提交后可点击“读取云端”检查。');}
initProfileUI();
