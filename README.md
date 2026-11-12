# VGTrace · Video Game Trace

A searchable multi-platform video game atlas with curated recommendations, playtime guides, and personal collections.

多平台中文游戏图鉴，当前收录 **11,102 款游戏**。游戏资料整理于 **2026-11-03**；仓库迁移与改名不代表对全库重新核验。

## 功能

- 按名称、玩法、平台代际、厂商、体验预算与游玩模式搜索和组合筛选。
- 卡片／表格切换、随机推荐、CSV 导出、逐款介绍与来源说明。
- 已通关、正在游玩、计划中、未游玩、已弃坑五种收藏状态，支持 JSON 备份和恢复。
- 成人向专区独立保留题材、玩法和非露骨内容说明，不由年龄分级或单一标签自动归组。
- 网页底部可复制的维护提示词直接引导更新本 GitHub 仓库，并检查 Actions 发布结果。

收藏保存在当前浏览器。换设备或从原离线文件迁移时，请先备份收藏，再在新网站恢复；GitHub Pages 不自动同步个人收藏。

## 网站与首次启用

目标地址：https://tengfei2002.github.io/VGTrace/

在仓库 Settings → Pages，将 Source 设为 **GitHub Actions**。推送 main 后运行 `.github/workflows/pages.yml`，检查成功的 Actions 部署；若首次推送早于 Pages 启用，可在 Actions 中重新运行 Publish VGTrace。地址是否已发布以部署实际结果为准。

## 本地构建和维护

使用 Node.js 24，无需安装第三方依赖：

```sh
npm run build
npm run check
```

- `data/manifest.json`：有序游戏分片清单与总数。
- `data/games-*.json`：完整游戏资料，保留原有稳定 key。
- `data/meta.json`：统计、待办和解析后的维护提示词。
- `src/maintenance-prompt.txt`：维护提示词模板，构建时同步数量、日期、覆盖率和待办。
- `src/template.html`、`src/client.js`：页面与交互源码。
- `src/bootstrap.js`：带错误重试的分片加载器，兼容 `/VGTrace/` 子路径。
- `dist/`：构建产生的网站，部署时上传。
- `offline/VGTrace.html`：构建同时保留的离线单文件产物，不提交至仓库。

修改游戏资料后同步 manifest、meta 统计和相应来源日期，运行构建与检查，再提交并推送 main。发布检查必须对应本次提交，不将仅生成本地文件视为线上更新。

## 资料口径

来源和原始链接保留在各游戏详情及“来源与方法”中。主要包括 Steam 公开元数据、Nintendo、PlayStation、Xbox 和发行商官方页面，以及标明日期的公开历史数据集与社区时长归档。简介覆盖率 91.33%。未核实字段保留未知；类型预算不等于逐款通关实测，历史评测不等于实时口碑。

本项目未宣称覆盖全部游戏。维护提示词本身不会后台联网；游戏资料更新需实际执行维护任务。资料和第三方作品的权利及许可仍归各来源与权利人，不因发布本仓库而转移。
