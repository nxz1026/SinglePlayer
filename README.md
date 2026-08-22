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
- **聚合搜索**：网易云（NeteaseCloudMusicApi）+ QQ 音乐（fcg 直连 + sha1 签名，移植自 Mineradio）
- **逐字卡拉OK**：YRC/QRC 词级时间轴解析 + Canvas2D 双色填充染色（rAF 逐帧、翻译行对齐、smoothstep 行级退化）
- **AI 原生**：对话"放一首晴天"即播；五个工具经桥接通道驱动浏览器播放
- **登录收藏**：网易云扫码登录、QQ Cookie 粘贴；凭据持久化于 `$DSH_HOME/dsh-music-huazai/auth.json`
- **花再同步**：USB HID 驱动 HALO PIXELBAR 音箱实时显示歌词（换行推送、切歌信息、暂停回时钟）
- **四种播放模式**：顺序 / 列表循环 / 单曲循环 / 随机
- **设置面板**：音质偏好、花再同步开关与显示参数（对齐/滚动/每行字数/暂停时钟）
- **跨平台音源回退**：当前平台取流失败时自动搜索另一平台同名歌曲接续播放；匿名播放自动音质降档
- **不重复造轮子**：平台 API 层和卡拉OK算法自 Mineradio 移植改造；插件机制完全复用 dsh Cordis 体系

## 安装

```powershell
pnpm install
pnpm build
dsh plugin --profile web add <本仓库路径>
# 重启 dsh web，刷新页面，右下角 ♪ 即播放器
```

本地开发：仓库以 `link:` 方式接入 profile。改完代码 `pnpm build`；
宿主半变更需重启 dsh web，浏览器半变更刷新页面即可（client bundle 带 rev 热更新）。

## 使用

1. **听歌**：点 ♪ → 搜索 → 点结果即播；或"播放全部"入队
2. **账号**：面板「账号」Tab —— 网易扫码登录 / QQ 粘贴 Cookie（需含 `uin=` 与 `qm_keyst=`）
3. **AI 点歌**：在 dsh 对话框直接说「放一首周杰伦的晴天」「下一首」「现在放的什么」
4. **花再同步**：音箱 USB 连接电脑后自动启用；暂停自动回时钟界面

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
| `POST /auth/netease/qr` · `GET …/create` · `GET …/check` | 网易扫码登录三步 |
| `POST /auth/qq` | QQ Cookie 保存 |
| `POST /like/set` · `GET /like/check` | 网易红心 |
| `POST /bridge/report` · `GET /bridge/poll` · `POST /bridge/command` | 浏览器↔宿主桥 |
| `GET /halo/status` · `POST /halo/config` | 花再状态/配置 |
| `POST /halo/lyric` · `/halo/song` · `/halo/state` · `/halo/command` | 花再事件与花活儿 |

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
