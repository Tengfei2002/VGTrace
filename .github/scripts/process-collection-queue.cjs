const save=require('./save-collections.cjs');
module.exports=async function({github,context,core}){
 const {owner,repo}=context.repo;
 const issues=await github.paginate(github.rest.issues.listForRepo,{owner,repo,state:'open',per_page:100});
 const pending=issues.filter(i=>!i.pull_request&&i.title.startsWith('VGTrace 收藏同步 · ')&&(i.user.login.toLowerCase()===owner.toLowerCase()||['OWNER','COLLABORATOR'].includes(i.author_association))).sort((a,b)=>a.number-b.number);
 for(const issue of pending){
  // Retry user-submitted requests with current code; one malformed request must
  // not prevent other users' valid saves from being written and published.
  await save({github,context:{repo:context.repo,issue:{number:issue.number}},core:{setFailed:message=>core.warning('Issue #'+issue.number+': '+message)}});
 }
 core.info('已处理 '+pending.length+' 条待保存请求；具体结果见各请求反馈。');
};
