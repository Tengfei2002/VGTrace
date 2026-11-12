const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const sandbox={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../src/collections-core.js'),'utf8'),sandbox);const C=sandbox.VGTraceCollections;
function parseRequest(body){const m=body.match(/```vgtrace-sync\s*([\s\S]*?)```/);if(!m)throw Error('未找到保存请求；请从网站重新发起');const r=JSON.parse(m[1]);if(r.version!==1||!C.users.includes(r.userId)||!/^[-a-zA-Z0-9]{8,80}$/.test(r.requestId)||typeof r.baseSha!=='string'||!/^[0-9a-f]{40}$/.test(r.baseSha))throw Error('请求用户或版本无效');return r;}
async function execute({github,context,core}){
 const {owner,repo}=context.repo,issue_number=context.issue.number;
 try{
  // Always reread the latest issue: an edited queued request must not replay an older body.
  const {data:issue}=await github.rest.issues.get({owner,repo,issue_number});
  if(!issue.title.startsWith('VGTrace 收藏同步 · '))return;
  if(issue.user.login.toLowerCase()!==owner.toLowerCase()&&!['OWNER','COLLABORATOR'].includes(issue.author_association))throw Error('只有仓库所有者或协作者可以保存收藏；请仓库所有者添加你的GitHub账号为协作者后重试');
  const r=parseRequest(issue.body||'');let value=r.backup;
  if(r.attachment){const links=[...(issue.body||'').matchAll(/https:\/\/github\.com\/user-attachments\/files\/\d+\/[^\s)<>]+\.json(?:\?[^\s)<>]*)?/g)].map(m=>m[0]);if(links.length!==1)throw Error('请附加一个原格式收藏JSON文件，再更新此Issue');const response=await fetch(links[0],{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('无法读取JSON附件');const declared=Number(response.headers.get('content-length')||0);if(declared>2*1024*1024)throw Error('附件超过2MB');const reader=response.body.getReader();let size=0,parts=[];while(true){const {value:chunk,done}=await reader.read();if(done)break;size+=chunk.length;if(size>2*1024*1024){await reader.cancel();throw Error('附件超过2MB');}parts.push(Buffer.from(chunk));}value=JSON.parse(Buffer.concat(parts).toString('utf8').replace(/^\uFEFF/,''));}
  const collections=C.parseBackup(value);if(value.version!==2||typeof value.date!=='string'||!Number.isFinite(Date.parse(value.date)))throw Error('保存请求必须为带日期的version 2备份');
  const path=`collections/${r.userId}.json`,ref='collections';const current=await github.rest.repos.getContent({owner,repo,path,ref});
  let content=current.data.content;if(current.data.encoding!=='base64'){const blob=await github.rest.git.getBlob({owner,repo,file_sha:current.data.sha});if(blob.data.encoding!=='base64')throw Error('云端文件格式无效');content=blob.data.content;}const previous=JSON.parse(Buffer.from(content,'base64').toString('utf8'));
  if(previous.date===value.date&&C.same(previous.collections,collections)){await github.rest.issues.update({owner,repo,issue_number,state:'closed',state_reason:'completed'});return;}
  if(current.data.sha!==r.baseSha)throw Error('云端版本已变化，本次没有覆盖。请回网站读取云端、合并或选择保留版本后重新保存');
  const payload=C.backup(collections,value.date);
  const result=await github.rest.repos.createOrUpdateFileContents({owner,repo,path,branch:ref,sha:current.data.sha,message:`Save ${r.userId} collections (${r.requestId})`,content:Buffer.from(JSON.stringify(payload,null,2)+'\n').toString('base64')});
  await github.rest.issues.createComment({owner,repo,issue_number,body:`已保存 **${r.userId}** 的 ${Object.keys(collections).length} 条收藏。其他用户文件未修改。\n\n提交：${result.data.commit.html_url}\n\n返回 VGTrace 点击“读取云端”或等待自动确认。`});
  await github.rest.issues.update({owner,repo,issue_number,state:'closed',state_reason:'completed'});
 }catch(error){await github.rest.issues.createComment({owner,repo,issue_number,body:`本次未确认保存完成：${String(error.message).slice(0,700)}。\n\n本机备份请保留。修正后更新本Issue，或从网站重新发起。`});core.setFailed(error.message);}
}
module.exports=execute;module.exports.parseRequest=parseRequest;
