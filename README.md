# 单身汉（DSH）播放器

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](./LICENSE)
![dsh-plugin](https://img.shields.io/badge/dsh-plugin-7c5cff)
[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

> 运行在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）内的 **AI 原生插件化音乐播放器**。
> 聚合网易云 / QQ 音乐、逐字卡拉OK歌词、花再（HALO PIXELBAR）音箱歌词同步；DeepSeek 全程对话操控——点歌、进度音量、队列收藏、音箱场景、闹钟提醒，一个插件全包。

架构设计与里程碑详见 [PLAN.md](./PLAN.md)。

```
┌─ dsh web (127.0.0.1:3080) ──────────────────────────────┐
│  浏览器半  React 播放面板（♪ 可拖动悬浮球）                 │
│  · 搜索/曲库/队列/账号     · Canvas2D 逐字卡拉OK           │
│        ▲│ 2s 轮询：上报播放状态 ← 命令队列 → 执行          │
├─────────▼──────────────────────────────────────────────┤
│  宿主半  Cordis 插件（dsh 进程内，Node）                   │
│  · 平台 BFF（网易 NCM / QQ fcg 签名直连 / 酷狗移动端搜索）                  │
│  · 音频代理（Range + Referer 注入）                        │
│  · AI 工具集 ×12 · 定时调度 · 通知分发                      │
│  · 花再 HID 驱动 ──USB──▶ 音箱（歌词/时钟/场景/频谱）        │
└─────────────────────────────────────────────────────────┘
```

## 特性

- **标准 dsh bundle**：一个 npm 包同时含宿主半（Cordis 插件）与浏览器半（React UI），`dsh plugin add` 即装即用；工具经 dsh tools 服务注册，模型自动发现调用
- **AI 原生 ×12 工具**：对话「放一首晴天」「下一首」「音量调到40%」「把稻香加进队列」「明早7点半放歌叫我起床」「30分钟后暂停」「换个赛博朋克场景」——搜索、播放、进度、音量、队列、收藏、睡眠定时、音乐闹钟、音箱屏控全部可说
- **通知双通道**：声音提示音与花再音箱文字提醒**相互独立**，各自开关；任何外部系统可 `POST /notify` 触发
  - **自定义提示音**：设置页上传 mp3/wav/ogg/m4a/flac（服务端魔数校验防伪装，≤3MB），可一键恢复内置「叮咚」
  - **音箱文字置顶**：通知默认置顶常驻，直到手动消除（`/halo/notify/dismiss`）或切歌；也可设为 N 秒自动让位歌词，暂停状态下到点回时钟
- **定时任务**：设置页可视化配置——音乐闹钟（时间+关键词+备注，随时增删）与睡眠定时器（分钟数启停+倒计时）；每日到点搜歌开播并做双通道提醒，持久化本地；总开关一键停用
- **反向推送**：切歌事件以折叠通知写入最近活跃的会话动态（不唤醒模型、零 token）；需至少一个已打开的对话，开关可控
  - **聚合搜索**：网易云（原生 weapi/eapi 复刻，零依赖）+ QQ 音乐（fcg 直连 + sha1 签名，移植自 Mineradio）+ 酷狗（移动端搜索直连，仅搜索发现、播放受限）；关键词历史与最近结果跨开关保留
- **逐字卡拉OK**：YRC/QRC 词级时间轴解析 + Canvas2D 双色填充染色；单行精简模式适配窄界面；界面歌词可一键开关（关闭不影响音箱同步）
- **登录收藏**：网易云 / QQ 扫码登录（二维码过期自动换新；扫码确认返回 502 带 Cookie 时也按成功处理）、QQ Cookie 粘贴兜底；本地 ❤ 与平台红心**双向同步**
- **随便听听**：一键生成「曲库+平台红心 Top30（按播放次数）+ 6 首随机新歌」的打乱歌单并开播
- **推荐**：曲库页多分组——登录时「每日个性化推荐」+ 官方榜单随机轮换 ×2（日期种子，每天新鲜、当天稳定）；未登录同样有随机榜单组
- **曲库多列表**：本地红心 / 自定义列表 / 最近播放，支持导入导出 JSON 备份，数据存 `$DSH_HOME` 纯本地
- **花再同步**：USB HID 驱动 HALO PIXELBAR 音箱实时显示歌词（换行推送、切歌信息、暂停回时钟）；配置改动即时下发；取消勾选同步或退出时自动恢复时钟界面；node-hid 加载失败/设备未找到等原因直接显示在设置页
- **四种播放模式**：顺序 / 列表循环 / 单曲循环 / 随机
- **跨平台音源回退**：取流失败自动降级音质 → 跨平台同名同歌手换源 → 队列跳歌（20s 预算 + token 防竞态，骨架移植自 Mineradio provider-fallback）
- **设置面板**：音质偏好、「通知与定时」四开关 + 自定义提示音上传、闹钟/睡眠定时可视化配置、花再同步开关与显示参数（对齐/滚动/每行字数/通知时长/暂停时钟）
- **可插拔音源架构**：`MusicProvider` 合同 + `ProviderRegistry`（对标 HaloLyricSync factory.py）。新增平台只需在 `providers/<x>.ts` 实现合同、`installBuiltinProviders()` 注册一次，`routes/tools/merge` 自动适配，无需改动消费方
  - **用户侧音源管理**：设置面板「音乐源」分组可实时启停各平台（`GET /providers` + `POST /providers/toggle`），状态持久化；停用后聚合搜索仅走启用源
  - **酷狗音源（搜索发现）**：`providers/kugou.ts` 实现 `MusicProvider` 合同、零依赖直连移动端搜索，作为首个新增第三方源；其播放接口需签名/dfid，轻量手段取不到直链，故仅作搜索扩源，点播回退至网易云/QQ
- **不重复造轮子**：平台 API 层、卡拉OK算法、音源回退骨架均自 Mineradio 移植改造；插件机制完全复用 dsh Cordis 体系

## 安装

本插件 **运行时零 npm 依赖**：网易云为原生 `weapi/eapi` 复刻（仅 `node:crypto` + `fetch`），
框架（`@deepseek-ai/*`）由 dsh 宿主在运行时提供，不再作为 peerDependency 被 pnpm 自动安装。
因此从 dsh 市场安装**不会再触发 symlink 权限错误（EPERM）**；`pnpm pack` 后安装实测仅装 0 个依赖。

- **从 dsh 市场安装（推荐）**：在插件市场搜索 `dsh-music-huazai` 一键安装，重启 dsh web 即可。
- **本地开发 / 手动安装**：

  ```powershell
  pnpm install
  pnpm build
  dsh plugin --profile web add <本仓库路径>
  # 重启 dsh web，刷新页面，右下角 ♪ 即播放器
  ```

本地开发：仓库以 `link:` 方式接入 profile。改完代码 `pnpm build`；
宿主半变更需重启 dsh web（可用 `scripts/dev-server.ps1` 启停），浏览器半变更刷新页面即可。

## 使用

1. **听歌**：点 ♪（悬浮球可拖到任意位置）→ 搜索 → 点结果即播；或点「🎲 随便听听」一键随机开播
2. **发现**：「曲库」Tab —— 顶部推荐区含每日个性化 + 随机轮换榜单（chips 切换），下方管理你的多个列表
3. **收藏**：任意曲目行点 ♡ 存入本地红心；网易登录状态下自动同步到平台红心
4. **账号**：「账号」Tab —— 网易云 / QQ 均支持扫码登录（请用对应手机 App 的扫一扫），QQ 也可粘贴 Cookie（需含 `uin=` 与 `qm_keyst=`）
5. **AI 全程操控**：在 dsh 对话框直接说——
   - 「放一首周杰伦的晴天」「下一首」「现在放的什么」「跳到1分30秒」
   - 「把稻香加进队列，然后单曲循环」「音量调到40%」「收藏这首歌」
   - 「明早7点半放首轻音乐叫我起床」「30分钟后暂停」（睡眠定时）
   - 「音箱换个赛博朋克场景」「显示频谱样式2」「屏色改成 #3366ff」
6. **花再同步**：音箱 USB 连接电脑后，在设置面板开启「启用歌词同步」（默认关闭）；取消勾选或退出/停服时自动恢复时钟界面
7. **备份**：曲库「导出」下载全部列表 JSON，「导入」恢复

## AI 工具

全部经 dsh tools 服务注册，模型按 JSON schema 自动调用；播放执行经桥接命令队列下发浏览器半。

| 工具 | 说明 |
|---|---|
| `music_search` | 聚合搜索，返回曲目 id 清单 |
| `music_play` | 点播：`track_id` 或裸 `query` 自动选曲 |
| `music_control` | pause / resume / next / prev / **seek 跳转进度** |
| `music_queue` | 队列：add 加入（不打断当前）/ clear 清空 / mode 播放模式 |
| `music_volume` | 音量 0-100 |
| `music_favorite` | 当前歌收藏/取消本地红心（可自动切换） |
| `music_halo` | 音箱屏幕：scene 场景 / spectrum 频谱 / clock 时钟样式 / color 屏色 |
| `music_sleep_timer` | 睡眠定时器：N 分钟后自动暂停并提醒 |
| `music_alarm` | 音乐闹钟：每日 HH:mm 搜歌开播 + 双通道提醒 |
| `music_now_playing` | 当前曲目与进度 |
| `music_lyric` | 歌词文本（LRC） |

> 通知入口：`POST /api/dsh-music/notify {title, text}` —— 按设置分发声音提示音与音箱文字，供外部脚本/其他插件触发提醒。

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
| `GET /settings` · `POST /settings/save` | 插件设置：声音通知 / 音箱文字 / 定时任务 / 反向推送 四开关 |
| `GET /providers` | 列出已注册音源及其启用态（id / label / enabled） |
| `POST /providers/toggle` | 运行时启停某音源 `{id, enabled}`，持久化后聚合搜索仅走启用源 |
| `GET /schedule` | 定时任务快照（闹钟列表 + 睡眠剩余） |
| `POST /alarm/add` · `POST /alarm/remove` | 音乐闹钟管理 |
| `POST /sleep/set` · `POST /sleep/clear` | 睡眠定时器 |
| `POST /notify` | 触发双通道提醒（按开关分发） |
| `POST /halo/notify/dismiss` | 消除置顶通知（恢复歌词/时钟） |
| `POST /notify/sound/upload` · `GET /notify/sound/info` | 自定义提示音：上传（魔数校验）与状态查询 |
| `GET /notify/sound/file` · `POST /notify/sound/reset` | 取回音频本体 / 恢复内置提示音 |
| `GET /halo/status` · `POST /halo/config` | 花再状态/配置 |
| `POST /halo/lyric` · `/halo/song` · `/halo/state` · `/halo/command` | 花再事件与花活儿 |

数据存储：登录态、曲库列表、播放统计、插件设置、闹钟均在 `$DSH_HOME/dsh-music-huazai/` 下，纯本地。

## 冒烟测试

```powershell
pnpm exec tsx scripts/smoke-m2.ts   # 平台层：搜索/取流/歌词/登录态（真实API）
pnpm exec tsx scripts/smoke-m4.ts   # 歌词解析：LRC/YRC/翻译对齐（21项断言）
pnpm exec tsx scripts/smoke-m6.ts   # 花再协议：包构建/校验/emoji清洗（无需硬件）
```

诊断脚本（登录/音箱排障时用）：

```powershell
pnpm exec tsx scripts/diag-qr.ts          # 网易/QQ 扫码三步链路（无需扫码）
pnpm exec tsx scripts/diag-qq-prod.ts     # QQ 扫码生产路径轮询状态
pnpm exec tsx scripts/diag-netease-auth.ts # 已存网易云 Cookie 有效性核验
pnpm exec tsx scripts/diag-halo-sync.ts   # 花再全链路：加载→连接→下发文字（真实硬件）
```

> 无头浏览器综合 E2E（需先 `pnpm build` 并 `powershell -File scripts/dev-server.ps1` 启动 dsh web）：
> ```powershell
> pnpm exec tsx scripts/e2e-all.ts   # Playwright 无头 Chrome 全功能自测：面板/搜索/播放/音乐源开关/闹钟/推荐，
>                                     # 并捕获 console.error、pageerror 与 >=400 失败请求，用于发现回归
> ```

## 已知问题与对策

| 问题 | 处理 |
|---|---|
| 音箱切歌信息显示 `？？` | 固件不支持 4 字节 UTF-8（emoji），已在协议层清洗非 BMP 字符 |
| 文字颜色字节必须为 0（白） | 非 0 会触发固件复位并掉线（协议层已固化） |
| 氛围灯等 v2 特性连续失败 | 自动降级禁用该特性，保住歌词通道 |
| 音箱状态一直「未连接」 | 设置页会显示具体原因（node-hid 加载失败/未找到设备/打开失败）；依赖 node-hid ≥3（自带预编译二进制，旧版 1.x 在无构建工具的机器上枚举必败） |
| QQ 扫码手机端提示已过期 | 请用**手机QQ**的扫一扫（互联授权码仅手机QQ可弹确认页）；二维码生成时已绑定 `pt_login_sig` 会话，若仍过期点重新获取或改粘贴 Cookie |
| QQ VIP 曲目取流为空 | 属预期：在「账号」Tab 粘贴 Cookie 后重试 |
| 酷狗曲目可搜不可播 | 其播放接口需签名/dfid，轻量手段无法取直链；酷狗仅作搜索发现源，播放回退至网易云/QQ |

## 致谢

- **[Mineradio](https://github.com/XxHuberrr/Mineradio)** — 本项目大量源代码移植自它：平台 API 层（QQ fcg 签名直连、聚合搜索）、逐字卡拉OK同步算法（YRC/QRC 解析、词级插值）、花再音箱桥接（halo-sync 模式与 HID 协议）。感谢原作者的出色工作。
- [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) — Cordis 插件体系与 Web UI 插槽
- [HaloLyricSync](https://github.com/nxz1026/HaloLyricSync) / [HaloPixelToolBox](https://github.com/XFEstudio/HaloPixelToolBox) / Seraph310/halo-pixelbar-mcp — 花再 HID 协议
- [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) — 网易云 weapi/eapi 协议参考（本项目已原生复刻其加密与请求约定，零运行时依赖）

## 开源许可

本项目基于源代码移植自 Mineradio，依其 MIT 许可的授权条款，以 **GPL-3.0** 协议发布。

本程序为自由软件：你可以依据自由软件基金会发布的 **GNU 通用公共许可证（GPL）第 3 版**对其再次分发和/或修改。详见仓库根目录的 [LICENSE](./LICENSE) 文件，或访问 <https://www.gnu.org/licenses/>。

> This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, version 3 of the License. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
>
> Contains code ported from [Mineradio](https://github.com/XxHuberrr/Mineradio) (MIT License).
