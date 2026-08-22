# 单身汉（DSH）播放器

> 运行在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）内的插件化音乐播放器。
> 聚合网易云 / QQ 音乐、逐字卡拉OK歌词、花再（HALO PIXELBAR）音箱同步，DeepSeek 可对话点歌。

架构与里程碑详见 [PLAN.md](./PLAN.md)。

## 特性

- **插件化**：标准 dsh bundle —— 宿主半（平台 BFF / 音频代理 / AI 工具）+ 浏览器半（React 播放面板）
- **聚合搜索**：网易云（NeteaseCloudMusicApi）+ QQ 音乐（fcg 直连 + sha1 签名，移植自 Mineradio）
- **逐字卡拉OK**：YRC/QRC 词级时间轴解析 + Canvas2D 双色填充染色（rAF 逐帧、翻译行对齐）
- **AI 原生**：对话"放一首晴天"即播 —— `music_search / music_play / music_control / music_now_playing / music_lyric` 五个工具经桥接通道驱动浏览器播放
- **登录收藏**：网易云扫码登录、QQ Cookie 粘贴；Cookie 持久化于 `$DSH_HOME/dsh-music-huazai/auth.json`
- **花再同步**（M6）：USB HID 驱动 HALO PIXELBAR 音箱实时显示歌词

## 安装

```powershell
pnpm install
pnpm build
dsh plugin --profile web add E:\2026Workplace\Code\DSH_music_Huazai
# 重启 dsh web 后刷新页面，右下角 ♪ 即播放器
```

本地开发：仓库以 `link:` 方式接入 profile，改完代码 `pnpm build`（宿主半需重启 dsh；浏览器半刷新页面即可）。

## AI 工具

| 工具 | 说明 |
|---|---|
| `music_search` | 聚合搜索，返回曲目 id 列表 |
| `music_play` | 点播：传 `track_id` 或直接 `query` 自动选曲 |
| `music_control` | pause / resume / next / prev |
| `music_now_playing` | 当前曲目与进度 |
| `music_lyric` | 歌词文本 |

示例对话：

> 「放一首周杰伦的晴天」→ DeepSeek 调 `music_play {query: "周杰伦 晴天"}` → 浏览器 2 秒内开播。

## 冒烟测试

```powershell
pnpm exec tsx scripts/smoke-m2.ts   # 平台层：搜索/取流/歌词/登录态
pnpm exec tsx scripts/smoke-m4.ts   # 歌词解析：LRC/YRC/翻译对齐
```

## 致谢

- [Mineradio](E:\2026Workplace\Code\Mineradio) — 平台 API 层、卡拉OK同步算法、花再桥接的参考实现
- [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) — Cordis 插件体系与 Web UI 插槽
- [HaloLyricSync](https://github.com/nxz1026/HaloLyricSync) / [HaloPixelToolBox](https://github.com/XFEstudio/HaloPixelToolBox) — 花再 HID 协议
