# 单身汉（DSH）播放器

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](./LICENSE)

> 运行在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）内的插件化音乐播放器。
> 聚合网易云 / QQ 音乐、逐字卡拉OK歌词、花再（HALO PIXELBAR）音箱歌词同步，DeepSeek 可对话点歌。

架构设计与里程碑详见 [PLAN.md](./PLAN.md)。

```
┌─ dsh web (127.0.0.1:3080) ──────────────────────────────┐
│  浏览器半  React 播放面板（♪ 悬浮按钮）                    │
│  · 搜索/队列/控制条/账号    · Canvas2D 逐字卡拉OK          │
│        ▲│ 2s 轮询：上报播放状态 ← 命令队列 → 执行          │
├─────────▼──────────────────────────────────────────────┤
│  宿主半  Cordis 插件（dsh 进程内，Node）                   │
│  · 平台 BFF（网易 NCM / QQ fcg 签名直连）                  │
│  · 音频代理（Range + Referer 注入）                        │
│  · AI 工具集 ×5            · 花再 HID 驱动 ──USB──▶ 音箱   │
└─────────────────────────────────────────────────────────┘
```

## 特性

- **插件化**：标准 dsh bundle —— 一个 npm 包同时含宿主半与浏览器半
- **聚合搜索**：网易云（NeteaseCloudMusicApi）+ QQ 音乐（fcg 直连 + sha1 签名，移植自 Mineradio）；搜索历史快速重搜
- **逐字卡拉OK**：YRC/QRC 词级时间轴解析 + Canvas2D 双色填充染色；界面歌词可一键开关（关闭不影响音箱同步）
- **AI 原生**：对话"放一首晴天"即播；五个工具经桥接通道驱动浏览器播放
- **登录收藏**：网易云扫码登录、QQ Cookie 粘贴；本地 ❤ 与平台红心**双向同步**
- **随便听听**：一键生成「曲库+平台红心 Top30（按播放次数）+ 6 首随机新歌」的打乱歌单并开播
- **推荐**：曲库页多分组——登录时「每日个性化推荐」+ 官方榜单随机轮换 ×2（日期种子，每天新鲜、当天稳定）；未登录同样有随机榜单组
- **曲库多列表**：本地红心 / 自定义列表 / 最近播放，支持导入导出 JSON 备份，数据存 `$DSH_HOME` 纯本地
- **花再同步**：USB HID 驱动 HALO PIXELBAR 音箱实时显示歌词（换行推送、切歌信息、暂停回时钟）
- **四种播放模式**：顺序 / 列表循环 / 单曲循环 / 随机
- **跨平台音源回退**：取流失败自动降级音质 → 跨平台同名同歌手换源 → 队列跳歌（20s 预算 + token 防竞态，骨架移植自 Mineradio provider-fallback）
- **设置面板**：音质偏好、花再同步开关与显示参数（对齐/滚动/每行字数/暂停时钟）
- **不重复造轮子**：平台 API 层、卡拉OK算法、音源回退骨架均自 Mineradio 移植改造；插件机制完全复用 dsh Cordis 体系

## 安装

```powershell
pnpm install
pnpm build
dsh plugin --profile web add <本仓库路径>
# 重启 dsh web，刷新页面，右下角 ♪ 即播放器
```

本地开发：仓库以 `link:` 方式接入 profile。改完代码 `pnpm build`；
宿主半变更需重启 dsh web（可用 `scripts/dev-server.ps1` 启停），浏览器半变更刷新页面即可。

## 使用

1. **听歌**：点 ♪ → 搜索 → 点结果即播；或点「🎲 随便听听」一键随机开播
2. **发现**：「曲库」Tab —— 顶部推荐区含每日个性化 + 随机轮换榜单（chips 切换），下方管理你的多个列表
3. **收藏**：任意曲目行点 ♡ 存入本地红心；网易登录状态下自动同步到平台红心
4. **账号**：「账号」Tab —— 网易扫码登录 / QQ 粘贴 Cookie（需含 `uin=` 与 `qm_keyst=`）
5. **AI 点歌**：在 dsh 对话框直接说「放一首周杰伦的晴天」「下一首」「现在放的什么」
6. **花再同步**：音箱 USB 连接电脑后，在设置面板开启「启用歌词同步」（默认关闭）
7. **备份**：曲库「导出」下载全部列表 JSON，「导入」恢复

## AI 工具

| 工具 | 说明 |
|---|---|
| `music_search` | 聚合搜索，返回曲目 id 清单 |
| `music_play` | 点播：`track_id` 或裸 `query` 自动选曲 |
| `music_control` | pause / resume / next / prev |
| `music_now_playing` | 当前曲目与进度 |
| `music_lyric` | 歌词文本（LRC） |

## HTTP API（同源 `/api/dsh-music/*`）

| 路由 | 说明 |
|---|---|
| `GET /search?keyword=&limit=&offset=&providers=` | 聚合搜索 |
| `GET /url?id=netease:xx\|qq:mid&quality=&mediaMid=` | 取流（音质降级候选+可播性探测） |
| `GET /lyric?id=` | 歌词载荷 `{lrc,tlyric,yrc,roma}` |
| `GET /audio?url=` | 音频代理（Range/Referer） |
| `GET /recommend` | 推荐分组：每日推荐 + 日期轮换官方榜单 ×2 |
| `GET /shuffle-mix` | 随便听听：Top30+6随机打乱歌单 |
| `GET /lists` · `POST /list/create` · `/list/delete` | 本地曲库多列表 |
| `POST /list/add` · `POST /list/remove` · `POST /list/import` | 列表曲目增删与备份导入 |
| `POST /stats/play` | 播放统计上报（驱动随便听听 Top30 排序） |
| `POST /auth/netease/qr` · `GET …/create` · `GET …/check` | 网易扫码登录三步 |
| `POST /auth/qq` | QQ Cookie 保存 |
| `POST /like/set` · `GET /like/check` | 网易红心（双向同步用） |
| `POST /bridge/report` · `GET /bridge/poll` · `POST /bridge/command` | 浏览器↔宿主桥 |
| `GET /halo/status` · `POST /halo/config` | 花再状态/配置 |
| `POST /halo/lyric` · `/halo/song` · `/halo/state` · `/halo/command` | 花再事件与花活儿 |

数据存储：登录态、曲库列表、播放统计均在 `$DSH_HOME/dsh-music-huazai/` 下，纯本地。

## 冒烟测试

```powershell
pnpm exec tsx scripts/smoke-m2.ts   # 平台层：搜索/取流/歌词/登录态（真实API）
pnpm exec tsx scripts/smoke-m4.ts   # 歌词解析：LRC/YRC/翻译对齐（11项断言）
pnpm exec tsx scripts/smoke-m6.ts   # 花再协议：包构建/校验和/emoji清洗（无需硬件）
```

## 已知问题与对策

| 问题 | 处理 |
|---|---|
| 音箱切歌信息显示 `？？` | 固件不支持 4 字节 UTF-8（emoji），已在协议层清洗非 BMP 字符 |
| 文字颜色字节必须为 0（白） | 非 0 会触发固件复位并掉线（协议层已固化） |
| 氛围灯等 v2 特性连续失败 | 自动降级禁用该特性，保住歌词通道 |
| QQ VIP 曲目取流为空 | 属预期：在「账号」Tab 粘贴 Cookie 后重试 |

## 致谢

- **[Mineradio](https://github.com/XxHuberrr/Mineradio)** — 本项目大量源代码移植自它：平台 API 层（QQ fcg 签名直连、聚合搜索）、逐字卡拉OK同步算法（YRC/QRC 解析、词级插值）、花再音箱桥接（halo-sync 模式与 HID 协议）。感谢原作者的出色工作。
- [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) — Cordis 插件体系与 Web UI 插槽
- [HaloLyricSync](https://github.com/nxz1026/HaloLyricSync) / [HaloPixelToolBox](https://github.com/XFEstudio/HaloPixelToolBox) / Seraph310/halo-pixelbar-mcp — 花再 HID 协议
- [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) — 网易云接口封装

## 开源许可

本项目基于源代码移植自 Mineradio，依其 MIT 许可的授权条款，以 **GPL-3.0** 协议发布。

本程序为自由软件：你可以依据自由软件基金会发布的 **GNU 通用公共许可证（GPL）第 3 版**对其再次分发和/或修改。详见仓库根目录的 [LICENSE](./LICENSE) 文件，或访问 <https://www.gnu.org/licenses/>。

> This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, version 3 of the License. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
>
> Contains code ported from [Mineradio](https://github.com/XxHuberrr/Mineradio) (MIT License).
