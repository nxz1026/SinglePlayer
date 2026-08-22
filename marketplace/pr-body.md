<!--
PR 投稿草稿 —— awesome-dsh-plugin/awesome-dsh-plugin
用法：运行 marketplace/submit.ps1 推送分支后，到 compare 页面把下方正文粘贴进 PR 描述。
暂不创建 PR，仅存档备用。
-->

## Add nxz1026/SinglePlayer

**AI-native music player for DeepSeek Harness (dsh)** — a standard dsh bundle that ships a Cordis host half (Node BFF + AI tools + USB-HID driver) and a browser half (React player panel) in one npm package.

### Why it fits this marketplace

- **Standard dsh bundle**: `package.json` declares the `dsh.bundle` manifest (`cordis.patch.yml` included); install with `dsh plugin --profile web add https://github.com/nxz1026/SinglePlayer`
- **Deep plugin integration**: registers 12 model-facing tools via the dsh tools service (`music_search / play / control / queue / volume / favorite / halo / sleep_timer / alarm / now_playing / lyric`) — DeepSeek discovers and calls them by JSON schema, no glue code needed
- **Host↔browser bridge**: AI tool calls land in an in-process command queue; the browser half polls every 2s and drives real `<audio>` playback, while reporting now-playing state back so tools can answer "what's playing?"
- **Unique hardware angle**: word-level karaoke lyrics synced live to a HALO PIXELBAR speaker over USB HID; config changes apply instantly and the device restores its clock face on plugin unload / process exit

### Feature highlights

- Aggregated NetEase + QQ Music search with cross-provider source fallback and quality ladder
- Canvas2D word-by-word karaoke (YRC/QRC), single-line mode for narrow panels
- Conversational control: song requests, seek/volume/queue/favorites, "play something at 7:30 tomorrow" alarm, "pause in 30 minutes" sleep timer
- Dual-channel notifications (browser chime + speaker text) with independent switches
- Music alarm clock + sleep timer, reverse push of track changes into the session feed — all toggleable in settings
- Multi-list library with bidirectional favorite sync, JSON import/export, daily recommendations

Repo: platform API layer / karaoke engine / fallback skeleton ported from Mineradio (MIT), released under GPL-3.0 · topic `dsh-plugin` added · category `fun`
