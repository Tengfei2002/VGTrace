# VGTrace · Video Game Trace

A searchable multi-platform video game atlas with curated recommendations, playtime guides, and personal collections.

多平台中文游戏图鉴，当前收录 **11,102 款游戏**。游戏资料整理于 **2026-11-03**；仓库迁移与改名不代表对全库重新核验。

## 功能

- 按名称、玩法、平台代际、厂商、体验预算与游玩模式搜索和组合筛选。
- 卡片／表格切换、随机推荐、CSV 导出、逐款介绍与来源说明。
- 0731、0425 两个独立收藏档案，各有已通关、正在游玩、计划中、未游玩、已弃坑五种状态；可只读查看对方。
- GitHub Actions 云端保存、跨设备读取，支持原格式 JSON 上传与下载，以及 CSV 收藏导入。
- 成人向专区独立保留题材、玩法和非露骨内容说明，不由年龄分级或单一标签自动归组。
- 网页底部可复制的维护提示词直接引导更新本 GitHub 仓库，并检查 Actions 发布结果。

## 收藏使用方式

1. 每次打开选择 **0731** 或 **0425**，自动从本站已发布的静态快照读取该用户云端收藏；顶栏随时切换。用户编号是收藏档案选择，不是身份认证。
2. 修改先保存到所选用户的浏览器缓存。点击 **保存到云端 → 前往 GitHub 确认**，在已预填的 Issue 页面点击 Submit new issue／Create。Actions 保存后自动发布最新收藏快照，通常需等待几十秒至数分钟；网页会检查发布结果，也可点击 **读取云端**。打开确认页本身不算保存成功。
3. 保存需要登录仓库所有者或协作者的 GitHub 账号。若另一人用自己的账号保存，所有者需在仓库 Settings → Collaborators 添加其账号并接受邀请；仅查看不需要登录。选择 0731／0425 不会改变 GitHub 写入权限，协作者可主动选择任一档案。
4. 在收藏页点击用户标签查看双方五类收藏；对方视图只读。切换当前用户时，如有未上传修改，会询问先保存，或保留本机修改后切换。
5. **上传收藏 CSV / JSON** 位于 **导出结果** 左侧。上传与下载沿用原 `{version:2,date,collections,keys}` 格式，也接受 version 1 的 keys 数组并归入未游玩。CSV 可使用“导出结果”生成的文件，在“收藏夹”列填写五种状态；也支持“收藏状态”列。新导出包含游戏标识与Steam AppID，旧导出按编号匹配，只有名称时采用唯一的已有名称精确匹配。空状态跳过、不删除原收藏，未匹配或重名条目会报告并跳过，异常状态、不同状态的重复游戏会拒绝整个文件。推荐使用 UTF-8 CSV（Excel 中选择 CSV UTF-8）。上传合并到当前用户，同一游戏采用导入状态；之后点击保存才会写入云端。收藏较多时确认链接改用 JSON 附件，按弹窗提示把下载的原格式文件拖入 Issue，待上传完成后提交。

当前公开仓库使用标准 Linux Actions runner，按 [GitHub 的公开仓库计费规则](https://docs.github.com/en/billing/concepts/product-billing/github-actions) 免费，无需额外部署服务、购买域名或配置个人访问令牌。两位用户的收藏文件及同步 Issue 都是公开信息。

### 存储与防覆盖

- 云端唯一数据位置为 **collections 分支**的 `collections/0731.json` 和 `collections/0425.json`；main 中同名空文件仅作初始结构示例，不代表最新收藏。每次保存只改当前用户文件，Git 提交历史保留旧版本。保存成功后复用 `.github/workflows/deploy-pages.yml` 网站发布流程，更新供浏览器读取的静态快照。
- `.github/workflows/save-collections.yml` 接收 Issue 事件，由 `.github/scripts/save-collections.cjs` 验证作者、用户和数据格式后自动更新，无需人工审查。用户提交的收藏会完整替换所选用户的云端文件，客户端旧SHA不再阻止保存；最后处理的有效保存生效。需要默认分支保留此工作流，以及仓库允许 Actions 运行；工作流显式申请 contents／issues 写权限，不需要新增 Secret。
- 页面读取同一 GitHub Pages 站点的 `cloud-collections.json`，无需登录，不调用 GitHub REST API。安卓 Chrome、Edge 等现代浏览器可直接使用，无需安装 Git 或填写令牌。两位用户共用一次文件读取；自动读取缓存20秒，并合并同时发出的请求。手动读取与保存结果检查会获取新快照。网络失败保留本机修改，并短暂冷却；若静态站点返回429，会遵守 Retry-After。未确认发布不会显示“已同步”。
- 云端版本有变化时保留本机草稿，手动读取会合并互不冲突的修改；同一游戏状态冲突时由用户选择。点击保存时按所选用户直接替换，Git提交历史保留旧文件；后端使用当时最新SHA进行原子写入，遇到并发冲突自动重试，不要求用户审查或处理旧版本。
- 旧本机键 `next-game-atlas-favorites-v1`、`next-game-atlas-collections-v2` 不覆盖。首次读取时留原始快照 `vgtrace-legacy-snapshot-v1`，经确认只导入一个用户。导入或处理冲突前另留本机快照；这些快照仍依赖该浏览器存储，应另下载 JSON 备份。
- 两套缓存分别使用 `vgtrace-profile-0731-v1`、`vgtrace-profile-0425-v1`。已发起但未确认的保存请求也保留在各自缓存；停止本机等待不会撤销已在 GitHub 提交的 Issue。

旧离线文件与 GitHub Pages 属于不同浏览器来源，网站不能直接读取离线文件收藏。请在旧页面下载收藏 JSON，再在新网站选择用户上传；不要清理旧浏览器数据，直到确认备份和云端保存成功。

## 网站与首次启用

目标地址：https://tengfei2002.github.io/VGTrace/

在仓库 Settings → Pages，将 Source 设为 **GitHub Actions**。推送 main 后运行 `.github/workflows/pages.yml`，检查成功的 Actions 部署；若首次推送早于 Pages 启用，可在 Actions 中重新运行 Publish VGTrace。地址是否已发布以部署实际结果为准。

## 本地构建和维护

使用 Node.js 24，无需安装第三方依赖。构建必须先取得真实收藏分支（不存在时构建会失败，避免用空示例覆盖网站收藏）：

```sh
git fetch --no-tags origin collections:refs/remotes/origin/collections
npm run build
npm run check
npm test
```

- `data/manifest.json`：有序游戏分片清单与总数。
- `data/games-*.json`：完整游戏资料，保留原有稳定 key。
- `data/meta.json`：统计、待办和解析后的维护提示词。
- `src/maintenance-prompt.txt`：维护提示词模板，构建时同步数量、日期、覆盖率和待办。
- `src/template.html`、`src/client.js`：页面与交互源码。
- `src/collections-core.js`、`src/collections-ui.js`：收藏格式、合并及双用户云端交互。
- `src/collections-cloud.js`：同源静态快照读取、请求合并、缓存与重试控制。
- `scripts/collection-snapshot.mjs`：从真实收藏分支的同一次提交读取双方文件与Git blob SHA，构建 `dist/cloud-collections.json`；该文件随Pages统一发布。
- `.github/workflows/save-collections.yml`、`.github/scripts/save-collections.cjs`：云端保存流程。
- `tests/`：收藏隔离、迁移、上传下载、冲突、保存权限和页面交互验证。
- `src/bootstrap.js`：带错误重试的分片加载器，兼容 `/VGTrace/` 子路径。
- `dist/`：构建产生的网站，部署时上传。
- `offline/VGTrace.html`：构建同时保留的离线单文件产物，不提交至仓库。

修改游戏资料后同步 manifest、meta 统计和相应来源日期，运行构建与检查，再提交并推送 main。发布检查必须对应本次提交，不将仅生成本地文件视为线上更新。

保存脚本更新或手动运行 Save collections 时，会自动重试尚未完成的授权保存请求并发布快照，重复请求按相同内容处理，不要求重新提交。主分支发布与收藏保存共用 `deploy-pages.yml`，统一读取最新main和collections并串行部署。日常图鉴维护不得重建、重置或强推 collections 分支；不要用 main 的初始空文件覆盖实际收藏。首次启用仅在该分支不存在时创建；后续收藏交给保存工作流维护。

## 免费复用

保留 GitHub Actions 与 GitHub Pages 即可，不部署额外服务。复制或 Fork 项目时，将 `src/collections-ui.js` 中的保存仓库地址、离线读取网站地址，以及README和维护提示词中的链接改为自己的仓库与Pages地址；保留 main 与 collections 两个分支。仅在 collections 分支不存在时用初始结构创建，不要重置已有数据。将 Pages Source 设为 GitHub Actions，允许保存工作流所声明的写入和发布权限；安卓只需访问网站。当前库仍使用0731与0425档案，修改用户编号时也需同步种子文件、校验和界面配置。

“我的收藏”和“分类总览”不显示维护提示词模块，探索页及原有其他入口保留；不增加日期轨迹或画廊模块。

## 资料口径

来源和原始链接保留在各游戏详情及“来源与方法”中。主要包括 Steam 公开元数据、Nintendo、PlayStation、Xbox 和发行商官方页面，以及标明日期的公开历史数据集与社区时长归档。简介覆盖率 91.33%。未核实字段保留未知；类型预算不等于逐款通关实测，历史评测不等于实时口碑。

本项目未宣称覆盖全部游戏。维护提示词本身不会后台联网；游戏资料更新需实际执行维护任务。资料和第三方作品的权利及许可仍归各来源与权利人，不因发布本仓库而转移。
