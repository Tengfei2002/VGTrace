(function(root){
 'use strict';
 const C=root.VGTraceCollections;
 const norm=s=>String(s??'').normalize('NFKC').trim().toLowerCase();
 function csvRows(text){
  text=text.replace(/^\uFEFF/,'');let separator=',';
  const directive=text.match(/^sep=([,;\t])\r?\n/i);if(directive){separator=directive[1];text=text.slice(directive[0].length);}
  const rows=[];let row=[],field='',quoted=false,closed=false;
  function cell(){row.push(field);field='';closed=false;}
  function end(){cell();if(row.some(s=>s.trim()))rows.push(row);row=[];}
  for(let i=0;i<text.length;i++){
   const c=text[i];
   if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
   if(c===separator){cell();continue;}
   if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;end();continue;}
   if(closed){if(c===' '||c==='\t')continue;throw Error('CSV 引号后的内容无效，请检查文件格式。');}
   if(c==='"'){if(field!=='')throw Error('CSV 引号格式无效。');quoted=true;}else field+=c;
  }
  if(quoted)throw Error('CSV 存在未闭合的引号。');if(field||row.length||closed)end();return rows;
 }
 function parseCSV(text,games){
  const rows=csvRows(text);if(rows.length<2)throw Error('CSV 需要表头和至少一条游戏记录。');
  const headers=rows.shift().map(norm);if(new Set(headers).size!==headers.length)throw Error('CSV 存在重复列名。');
  const find=names=>headers.findIndex(h=>names.map(norm).includes(h));
  const columns={key:find(['游戏标识','稳定key','key','game key']),appid:find(['Steam AppID','AppID','steam_appid']),id:find(['编号','id']),status:find(['收藏夹','收藏状态','状态','status']),name:find(['显示名称','中文名','原名','游戏名称','名称','name','title'])};
  if(columns.status<0)throw Error('CSV 缺少“收藏夹”或“收藏状态”列。');
  if([columns.key,columns.appid,columns.id,columns.name].every(i=>i<0))throw Error('CSV 需要游戏标识、Steam AppID、编号或游戏名称列。');
  const keys=new Map(games.map(g=>[g.key,g])),ids=new Map(games.map(g=>[String(g.id),g])),apps=new Map(games.filter(g=>g.appid).map(g=>[String(g.appid),g])),names=new Map();
  for(const g of games)for(const name of [g.name,g.zh,g.displayName,...(Array.isArray(g.aliases)?g.aliases:[])])if(name){const n=norm(name);if(!names.has(n))names.set(n,new Set());names.get(n).add(g.key);}
  const collections={},stats={empty:0,unknown:0,ambiguous:0,duplicates:0};
  for(let i=0;i<rows.length;i++){
   const row=rows[i];if(row.length!==headers.length)throw Error(`CSV 第 ${i+1} 条记录的列数与表头不一致。`);
   const get=type=>columns[type]<0?'':row[columns[type]].trim(),status=get('status');
   if(!status){stats.empty++;continue;}
   if(!C.states.includes(status))throw Error(`CSV 第 ${i+1} 条记录的收藏状态“${status.slice(0,24)}”无效，请使用五种收藏状态。`);
   let game;
   if(get('key'))game=keys.get(get('key'));
   else if(get('appid'))game=apps.get(get('appid'));
   else if(get('id'))game=ids.get(get('id'));
   else {const value=get('name'),matches=names.get(norm(value))||(/^'[=+@-]/.test(value)?names.get(norm(value.slice(1))):null);if(matches?.size>1){stats.ambiguous++;continue;}if(matches?.size===1)game=keys.get([...matches][0]);}
   if(!game){stats.unknown++;continue;}
   if(get('key')&&get('appid')&&String(game.appid)!==get('appid'))throw Error(`CSV 第 ${i+1} 条记录的游戏标识与 AppID 不一致。`);
   if(Object.hasOwn(collections,game.key)){if(collections[game.key]!==status)throw Error(`CSV 中同一游戏有不同收藏状态，请先去重。`);stats.duplicates++;continue;}
   collections[game.key]=status;
  }
  return {format:'CSV',collections:C.clean(collections),stats};
 }
 function parse(text,games,filename=''){
  text=text.replace(/^\uFEFF/,'');
  if(/\.csv$/i.test(filename)||(!/\.json$/i.test(filename)&&!/^\s*[{[]/.test(text)))return parseCSV(text,games);
  return {format:'JSON',collections:C.parseBackup(JSON.parse(text)),stats:{}};
 }
 function summary(result){const s=result.stats;return [s.empty?`跳过 ${s.empty} 条空状态`:'',s.unknown?`${s.unknown} 条游戏未匹配`:'',s.ambiguous?`${s.ambiguous} 条同名游戏无法唯一匹配`:'',s.duplicates?`合并 ${s.duplicates} 条重复记录`:''].filter(Boolean).join('；');}
 root.VGTraceCollectionImport={parse,parseCSV,csvRows,summary};
})(globalThis);
