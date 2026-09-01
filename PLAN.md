# 单身汉（DSH）播放器 — 架构方案

> 一个运行在 DeepSeek Harness（dsh）内的插件化音乐播放器，具备聚合平台搜索、
> 登录收藏、逐字卡拉OK歌词同步显示等能力。

## 1. 定位

- **形态**：标准 dsh bundle（npm 包），含「宿主半」+「浏览器半」
- **宿主半**（Node，dsh 进程内）：平台 API BFF、音频代理、登录态存储、AI 工具注册
- **浏览器半**（React，注入 dsh Web UI）：播放器面板、逐字卡拉OK歌词渲染
- **AI 原生**：DeepSeek 可通过工具直接搜索/播放/控制，对话即点歌

## 2. 参考项目复用策略（不重复造轮子）

| 能力 | 来源 | 方式 |
|---|---|---|
| 网易云 API | Mineradio → `NeteaseCloudMusicApi` npm 包 | 直接依赖，进程内调用 |
| QQ 音乐 API | Mineradio `server.js` 的 fcg 直连+签名 | 抽取改造为 TS 模块 |
| 聚合搜索去重打分 | Mineradio `scoreSongSearchResult` | 算法移植 |
| LRC/YRC/QRC 解析 | Mineradio `00-lyrics-fetch-parse.js` | 纯函数移植 |
| 卡拉OK同步算法 | Mineradio 二分定位+词级插值+词宽测量 | Canvas2D 重写渲染（不搬 Three.js） |
| 插件机制/UI插槽 | dsh Cordis + slots 体系 | 原生使用 |

## 3. 目录结构

```
├─ package.json            # "dsh": { bundle.patch, client } 双半声明
├─ cordis.patch.yml        # 本地开发补丁（insert 插件）
├─ src/                    # 宿主半
│  ├─ index.ts             # apply(ctx)：服务+工具注册
│  ├─ bridge.ts            # 浏览器↔宿主桥（命令队列+上报）
│  ├─ log.ts               # 统一日志
│  ├─ routes.ts            # HTTP 路由（BFF、音频代理、登录、推荐）
│  ├─ tools.ts             # AI 工具集（5 个工具）
│  ├─ providers/
│  │  ├─ types.ts          # 统一模型与桥类型
│  │  ├─ netease.ts        # 搜索/取流/YRC/扫码登录
│  │  ├─ qq.ts             # fcg 直连/Cookie 登录/QRC
│  │  └─ merge.ts          # 聚合搜索合并去重
│  ├─ lyric/parse.ts       # LRC/YRC/QRC 解析（纯函数）
│  ├─ proxy/audio.ts       # /audio 代理：Range + Referer 注入
│  ├─ store/
│  │  ├─ auth.ts           # 登录态持久化（$DSH_HOME 下）
│  │  └─ library.ts        # 本地曲库多列表 + 播放统计
├─ client/                 # 浏览器半
│  ├─ index.tsx            # 入口：挂载悬浮按钮 + 启动桥
│  ├─ PlayerPanel.tsx      # 主面板（搜索/曲库/队列/账号/设置 Tab）
│  ├─ Karaoke.tsx          # Canvas2D 逐字卡拉OK染色
│  ├─ player.ts            # HTMLAudio 引擎 + 播放队列 + 音源回退
│  ├─ api.ts               # 类型化 fetch 封装
│  ├─ library.ts           # 曲库客户端 store
│  └─ qrLogin.ts           # 网易扫码登录生命周期
```

## 4. 关键设计

### 4.1 宿主↔浏览器通信
- 工具调用结果经 session/event SSE 自动到达前端；UI 面板数据走 API Gateway Remote 方法
- 音频一律 `<audio src="宿主音频代理路由">`，由宿主转发 Range、注入 Referer

### 4.2 歌词同步（M4 核心）
1. `parseYrcText` 解析出每行 `words[] = {text, t, d}`（词级时间轴）
2. 离屏 canvas `measureText` 实测每个词像素宽度占比（128px 基准）
3. 每帧：二分查找当前行 → 行内按词插值得 0~1 进度 → Canvas2D 双色填充染色
4. 支持翻译行对齐显示；无逐字数据时退化为 smoothstep 整行进度

### 4.3 AI 工具集（M5）
`music_search` / `music_play` / `music_control`（合并 pause/resume/next/prev）/
`music_now_playing` / `music_lyric`

## 5. 里程碑

| 里程碑 | 内容 | 验收 |
|---|---|---|
| M1 | bundle 骨架 + 空 panel 注入 | `--dump-config` 出现插件层，Web UI 见面板 |
| M2 | 平台层（网易+QQ）+ 音频代理 + 登录 | 能搜到歌、能拿到直链与歌词、能扫码/贴 Cookie |
| M3 | 播放器 UI | 搜索→点播→队列→控制条可用 |
| M4 | 逐字卡拉OK歌词 | YRC/QRC 逐字染色滚动 |
| M5 | AI 工具集 + README | 对话"放一首XX"可播 |

## 6. v1 范围

- ✅ 网易云 + QQ 音乐（搜索/取流/歌词/登录/红心收藏）
- ✅ 扫码（网易）/Cookie 粘贴（QQ）登录
- ✅ 逐字卡拉OK + 翻译
- ❌ 酷狗/汽水/Spotify（v2）、桌面歌词窗口（v2）、音源回退（v2）
