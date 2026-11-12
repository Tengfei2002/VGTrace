import fs from 'node:fs';
const meta=JSON.parse(fs.readFileSync('data/meta.json','utf8'));
const pending=(meta.maintenancePending||[]).map((p,i)=>`${i+1}. ${p.name}｜稳定ID：${p.id}｜未完成：${p.action}｜阻塞：${p.reason}｜核查日期：${p.checked}｜再次处理条件：${p.condition}｜依据：${p.source}`).join('\n')||'（暂无待办）';
meta.maintenancePrompt=fs.readFileSync('src/maintenance-prompt.txt','utf8').replaceAll('{{DATE}}',meta.generated).replaceAll('{{COUNT}}',String(meta.count)).replaceAll('{{INTRO_COVERAGE}}',String(meta.introCoverage)).replaceAll('{{PENDING_LIST}}',pending);
meta.project={name:'VGTrace',fullName:'Video Game Trace',repository:'https://github.com/Tengfei2002/VGTrace',site:'https://tengfei2002.github.io/VGTrace/'};
fs.writeFileSync('data/meta.json',JSON.stringify(meta));
