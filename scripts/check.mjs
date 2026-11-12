import fs from 'node:fs';import assert from 'node:assert/strict';import vm from 'node:vm';
const manifest=JSON.parse(fs.readFileSync('data/manifest.json','utf8')),meta=JSON.parse(fs.readFileSync('data/meta.json','utf8')),games=manifest.chunks.flatMap(p=>JSON.parse(fs.readFileSync('data/'+p,'utf8')));
assert.equal(games.length,11102);assert.equal(meta.count,games.length);assert.equal(manifest.count,games.length);
assert.equal(new Set(games.map(g=>g.key)).size,games.length);const appids=games.map(g=>g.appid).filter(Boolean);assert.equal(new Set(appids).size,appids.length);
assert.ok(games.filter(g=>g.hasSourceIntro&&g.synopsis&&g.synopsisSource).length/games.length>=0.9);assert.equal(games.filter(g=>g.adultFocused).length,201);
for(const p of manifest.chunks){assert.ok(fs.statSync('data/'+p).size<25*1024*1024);assert.deepEqual(JSON.parse(fs.readFileSync('dist/data/'+p,'utf8')),JSON.parse(fs.readFileSync('data/'+p,'utf8')));}
const html=fs.readFileSync('dist/index.html','utf8'),offline=fs.readFileSync('offline/VGTrace.html','utf8');assert.ok(html.includes('<title>VGTrace'));assert.ok(!/\{\{CATALOG_|__BRAND_ICON_DATA__|\/\*__DATA__\*\//.test(html));assert.ok(!/<(?:script|link)[^>]+(?:src|href)="https?:/i.test(html));
new vm.Script(fs.readFileSync('dist/client.js','utf8'));new vm.Script(fs.readFileSync('src/client.js','utf8'));
assert.ok(!/<script[^>]+src=/.test(offline));assert.deepEqual(JSON.parse(offline.match(/<script id="catalog-data" type="application\/json">([\s\S]*?)<\/script>/)[1]),{meta,games});
for(const key of ['next-game-atlas-favorites-v1','next-game-atlas-collections-v2'])assert.ok(fs.readFileSync('dist/client.js','utf8').includes(key));
assert.ok(meta.maintenancePrompt.includes('VGTrace')&&meta.maintenancePrompt.includes(String(games.length)));
assert.ok(meta.maintenancePrompt.startsWith('请直接维护 VGTrace'));
for(const text of ['https://github.com/Tengfei2002/VGTrace','.github/workflows/pages.yml','npm run build','npm run check','本次提交SHA','maintenancePending','至少90%','已弃坑','成人内容体现'])assert.ok(meta.maintenancePrompt.includes(text),text);
assert.ok(!/\{\{[A-Z_]+\}\}/.test(meta.maintenancePrompt));assert.ok(!meta.maintenancePrompt.includes('返回可下载的完整、自包含 HTML'));
for(const p of meta.maintenancePending)assert.ok(meta.maintenancePrompt.includes(p.id));
assert.ok(html.includes('直接维护 VGTrace 仓库'));assert.ok(!html.includes('并同时提供当前 HTML 文件'));
const client=fs.readFileSync('src/client.js','utf8');assert.ok(!client.includes('请同时提供当前HTML文件'));assert.ok(client.includes('VGTrace 的 GitHub 仓库继续维护'));
assert.ok(client.includes("box.value")&&client.includes("$('maintenance-prompt').value"));
console.log('Passed: count, deduplication, source coverage, 201 adult profiles, all chunks, branding, JavaScript syntax, original collection keys and self-contained offline data.');
