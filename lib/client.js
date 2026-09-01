window.__ModuleLoader__.load({
	id: "dsh-music-huazai",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom_client = require("react-dom/client");
		let react_jsx_runtime = require("react/jsx-runtime");
		const VIEW_PAD = 8;
		const POS_KEY = "dshm-fab-pos";
		const DRAG_THRESHOLD = 4;
		/** 把坐标限制在视口内。 */
		function clampFabPos(x, y) {
			const maxX = Math.max(VIEW_PAD, window.innerWidth - 44 - VIEW_PAD);
			const maxY = Math.max(VIEW_PAD, window.innerHeight - 44 - VIEW_PAD);
			return {
				x: Math.min(Math.max(VIEW_PAD, x), maxX),
				y: Math.min(Math.max(VIEW_PAD, y), maxY)
			};
		}
		function defaultFabPos() {
			return clampFabPos(window.innerWidth - 44 - 18, window.innerHeight - 44 - 18);
		}
		function readFabPos() {
			try {
				const raw = JSON.parse(localStorage.getItem(POS_KEY) ?? "");
				if (raw && typeof raw.x === "number" && typeof raw.y === "number") return clampFabPos(raw.x, raw.y);
			} catch {}
			return defaultFabPos();
		}
		const FAB_CSS = `
.dshm-fab {
  position: fixed; z-index: 2147483000;
  width: 44px; height: 44px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,.16);
  background: linear-gradient(135deg, rgba(124,92,255,.85), rgba(56,189,248,.75));
  color: #fff; font-size: 20px; line-height: 1; cursor: grab;
  box-shadow: 0 6px 24px rgba(0,0,0,.35);
  touch-action: none; user-select: none; -webkit-user-select: none;
}
.dshm-fab:active { cursor: grabbing; }
.dshm-fab:hover { filter: brightness(1.12); }
.dshm-fab-open { background: linear-gradient(135deg, rgba(56,189,248,.8), rgba(124,92,255,.7)); }
`;
		function Fab({ open, onClick, onMove }) {
			const [pos, setPos] = (0, react.useState)(readFabPos);
			const posRef = (0, react.useRef)(pos);
			const dragRef = (0, react.useRef)(null);
			const commit = (0, react.useCallback)((next) => {
				posRef.current = next;
				setPos(next);
				onMove(next);
			}, [onMove]);
			(0, react.useEffect)(() => {
				const onResize = () => commit(clampFabPos(posRef.current.x, posRef.current.y));
				window.addEventListener("resize", onResize);
				return () => window.removeEventListener("resize", onResize);
			}, [commit]);
			const handlePointerDown = (event) => {
				if (event.button !== 0) return;
				event.currentTarget.setPointerCapture(event.pointerId);
				dragRef.current = {
					pointerX: event.clientX,
					pointerY: event.clientY,
					baseX: posRef.current.x,
					baseY: posRef.current.y,
					moved: false
				};
			};
			const handlePointerMove = (event) => {
				const drag = dragRef.current;
				if (!drag) return;
				const dx = event.clientX - drag.pointerX;
				const dy = event.clientY - drag.pointerY;
				if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
				drag.moved = true;
				commit(clampFabPos(drag.baseX + dx, drag.baseY + dy));
			};
			const handlePointerUp = () => {
				const drag = dragRef.current;
				dragRef.current = null;
				if (!drag) return;
				if (drag.moved) {
					try {
						localStorage.setItem(POS_KEY, JSON.stringify(posRef.current));
					} catch {}
					return;
				}
				onClick();
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: FAB_CSS }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: open ? "dshm-fab dshm-fab-open" : "dshm-fab",
				title: "单身汉播放器（可拖动）",
				"aria-label": "单身汉播放器",
				style: {
					left: pos.x,
					top: pos.y
				},
				onPointerDown: handlePointerDown,
				onPointerMove: handlePointerMove,
				onPointerUp: handlePointerUp,
				onPointerCancel: () => {
					dragRef.current = null;
				},
				children: open ? "×" : "♪"
			})] });
		}
		//#endregion
		//#region src/client/api.ts
		const BASE = "/api/dsh-music";
		async function requestJson(path, init) {
			const resp = await fetch(BASE + path, init);
			const payload = await resp.json().catch(() => ({}));
			if (!resp.ok || payload.ok !== true) throw new Error(typeof payload.error === "string" ? payload.error : `HTTP ${resp.status}`);
			return payload;
		}
		function get(path) {
			return requestJson(path);
		}
		function post(path, body) {
			return requestJson(path, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body)
			});
		}
		const api = {
			search(keyword, limit = 20, offset = 0) {
				return get(`/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}&offset=${offset}`);
			},
			async songUrl(id, quality = "exhigh", mediaMid) {
				const media = mediaMid ? `&mediaMid=${encodeURIComponent(mediaMid)}` : "";
				return (await get(`/url?id=${encodeURIComponent(id)}&quality=${quality}${media}`)).result ?? {
					url: "",
					reason: "空响应"
				};
			},
			lyric(id) {
				return get(`/lyric?id=${encodeURIComponent(id)}`);
			},
			authStatus() {
				return get("/auth/status");
			},
			neteaseQrStart() {
				return post("/auth/netease/qr", {});
			},
			neteaseQrCreate(key) {
				return get(`/auth/netease/qr/create?key=${encodeURIComponent(key)}`);
			},
			neteaseQrCheck(key) {
				return get(`/auth/netease/qr/check?key=${encodeURIComponent(key)}`);
			},
			qqCookieSave(cookie) {
				return post("/auth/qq", { cookie });
			},
			qqQrStart() {
				return post("/auth/qq/qr", {});
			},
			qqQrCheck(qrsig, ptLoginSig) {
				return get(`/auth/qq/qr/check?qrsig=${encodeURIComponent(qrsig)}&ptLoginSig=${encodeURIComponent(ptLoginSig)}`);
			},
			neteaseLike(songId, like) {
				return post("/like/set", {
					id: `netease:${songId}`,
					liked: like
				});
			},
			neteaseLikeCheck(songId) {
				return get(`/like/check?id=${encodeURIComponent(`netease:${songId}`)}`);
			},
			getPluginSettings() {
				return get("/settings");
			},
			savePluginSettings(patch) {
				return post("/settings/save", { settings: patch });
			},
			scheduleStatus() {
				return get("/schedule");
			},
			alarmAdd(time, keyword, label) {
				return post("/alarm/add", {
					time,
					keyword,
					label
				});
			},
			alarmRemove(id) {
				return post("/alarm/remove", { id });
			},
			sleepSet(minutes) {
				return post("/sleep/set", { minutes });
			},
			sleepClear() {
				return post("/sleep/clear", {});
			},
			async notifySoundInfo() {
				return get("/notify/sound/info");
			},
			/** 上传自定义提示音：原始二进制，服务端按魔数校验格式。 */
			async uploadNotifySound(file) {
				const ext = (file.name.split(".").pop() ?? "").toLowerCase();
				const resp = await fetch(`${BASE}/notify/sound/upload?ext=${encodeURIComponent(ext)}`, {
					method: "POST",
					headers: { "content-type": "application/octet-stream" },
					body: file
				});
				const payload = await resp.json().catch(() => ({}));
				if (!resp.ok || payload.ok !== true) throw new Error(typeof payload.error === "string" ? payload.error : `HTTP ${resp.status}`);
				return payload;
			},
			async resetNotifySound() {
				await fetch(`${BASE}/notify/sound/reset`, { method: "POST" });
			},
			shuffleMix() {
				return get("/shuffle-mix");
			},
			recommend() {
				return get("/recommend");
			},
			chartTracks(id = "3778678", limit = 50) {
				return get(`/chart?id=${encodeURIComponent(id)}&limit=${limit}`);
			},
			getLists() {
				return get("/lists");
			},
			createList(name) {
				return post("/list/create", { name });
			},
			deleteList(id) {
				return post("/list/delete", { id });
			},
			addToList(id, track) {
				return post("/list/add", {
					id,
					track
				});
			},
			removeFromList(id, trackId) {
				return post("/list/remove", {
					id,
					trackId
				});
			},
			recordPlay(track) {
				fetch(`${BASE}/stats/play`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ track })
				}).catch(() => {});
			},
			listProviders() {
				return get("/providers");
			},
			toggleProvider(id, enabled) {
				return post("/providers/toggle", {
					id,
					enabled
				});
			}
		};
		/** 经宿主代理的音频地址。 */
		function audioProxyUrl(url) {
			return `${BASE}/audio?url=${encodeURIComponent(url)}`;
		}
		async function bridgeReport(report) {
			await fetch(`${BASE}/bridge/report`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ nowPlaying: report })
			}).catch(() => {});
		}
		async function bridgePoll() {
			try {
				return (await (await fetch(`${BASE}/bridge/poll`)).json()).commands ?? [];
			} catch {
				return [];
			}
		}
		//#endregion
		//#region src/lyric/parse.ts
		function lyricTagTimeToSeconds(min, sec, frac) {
			return Number(min) * 60 + Number(sec) + Number(`0.${frac ?? "0"}`);
		}
		/** 补全每行 duration：下一行起点推断，夹在 [0.45, 12] 秒。 */
		function finalizeLyricLineDurations(lines) {
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (!line) continue;
				const next = lines[i + 1];
				const inferred = next && next.t > line.t ? next.t - line.t : 4.8;
				if (!Number.isFinite(line.duration) || line.duration <= 0) line.duration = inferred;
				line.duration = Math.max(.45, Math.min(12, line.duration));
			}
			return lines.sort((a, b) => a.t - b.t);
		}
		const LRC_TAG = /\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\]/g;
		/** LRC 行级解析（Mineradio parseLyricText 移植；跳过 JSON 元数据行）。 */
		function parseLyricText(text) {
			const lines = [];
			for (const rawLine of String(text ?? "").split(/\r?\n/)) {
				if (rawLine.trimStart().startsWith("{")) continue;
				const tags = [];
				LRC_TAG.lastIndex = 0;
				let m;
				while ((m = LRC_TAG.exec(rawLine)) !== null) {
					const min = m[1] ?? "0";
					const sec = m[2] ?? "0";
					tags.push({
						t: lyricTagTimeToSeconds(min, sec, m[3]),
						index: m.index,
						end: LRC_TAG.lastIndex
					});
				}
				if (!tags.length) continue;
				let hasInterleavedText = false;
				for (let i = 0; i < tags.length - 1; i++) {
					const left = tags[i];
					const right = tags[i + 1];
					if (left && right && rawLine.slice(left.end, right.index).trim()) {
						hasInterleavedText = true;
						break;
					}
				}
				if (hasInterleavedText) {
					for (let si = 0; si < tags.length; si++) {
						const tag = tags[si];
						if (!tag) continue;
						const nextTag = tags[si + 1];
						const segment = rawLine.slice(tag.end, nextTag ? nextTag.index : rawLine.length).trim();
						if (segment) lines.push({
							t: tag.t,
							duration: 0,
							text: segment
						});
					}
					continue;
				}
				const txt = rawLine.replace(LRC_TAG, "").trim();
				if (!txt) continue;
				for (const tag of tags) lines.push({
					t: tag.t,
					duration: 0,
					text: txt
				});
			}
			return finalizeLyricLineDurations(lines);
		}
		/**
		* 网易 YRC / QQ QRC 词级解析（Mineradio parseYrcText 移植）。
		* 格式：`[行起始ms,行时长ms](词起始ms,词时长ms,0)词文本`
		*/
		function parseYrcText(text) {
			const lines = [];
			for (const line of String(text ?? "").split(/\r?\n/)) {
				const m = line.match(/^\[(\d+),(\d+)\](.*)$/);
				if (!m) continue;
				const lineStartMs = Number.parseInt(m[1] ?? "0", 10) || 0;
				const lineDurMs = Number.parseInt(m[2] ?? "0", 10) || 0;
				const body = m[3] ?? "";
				const words = [];
				let fullText = "";
				const reg = /\((\d+),(\d+),\d+\)([^()]*)/g;
				let wm;
				while ((wm = reg.exec(body)) !== null) {
					const txt = (wm[3] ?? "").replace(/\s+/g, " ");
					if (!txt) continue;
					const rawStart = Number.parseInt(wm[1] ?? "0", 10) || 0;
					const rawDur = Number.parseInt(wm[2] ?? "0", 10) || 0;
					const absStartMs = rawStart >= lineStartMs - 500 ? rawStart : lineStartMs + rawStart;
					fullText += txt;
					words.push({
						text: txt,
						t: absStartMs / 1e3,
						d: Math.max(.06, rawDur / 1e3)
					});
				}
				if (!fullText) fullText = body.replace(/\(\d+,\d+,\d+\)/g, "").replace(/\s+/g, " ");
				fullText = fullText.replace(/\s+/g, " ").trim();
				if (!fullText) continue;
				lines.push({
					t: lineStartMs / 1e3,
					duration: lineDurMs / 1e3,
					text: fullText,
					words
				});
			}
			return finalizeLyricLineDurations(lines);
		}
		/** 翻译对齐：时间容差匹配。 */
		function attachTranslations(primary, translations, tolerance = .35) {
			if (!primary.length || !translations.length) return primary;
			let cursor = 0;
			for (const line of primary) {
				let best;
				let bestDelta = Infinity;
				for (let i = cursor; i < translations.length; i++) {
					const candidate = translations[i];
					if (!candidate) continue;
					const delta = Math.abs(candidate.t - line.t);
					if (delta < bestDelta) {
						bestDelta = delta;
						best = candidate;
					}
					if (candidate.t > line.t + tolerance && delta > 2) break;
				}
				if (best && bestDelta <= tolerance) line.translation = best.text;
			}
			return primary;
		}
		/** 组合最终卡拉OK载荷：yrc/qrc 词级优先，退化为 lrc 行级 + 翻译。 */
		function buildKaraokePayload(lyric) {
			const wordLines = parseYrcText(lyric.yrc);
			if (wordLines.some((line) => (line.words?.length ?? 0) > 0)) return {
				source: "yrc-word",
				lines: attachTranslations(wordLines, parseLyricText(lyric.tlyric))
			};
			return {
				source: "line",
				lines: attachTranslations(parseLyricText(lyric.lrc), parseLyricText(lyric.tlyric))
			};
		}
		//#endregion
		//#region src/client/player.ts
		/**
		* 播放引擎 —— 页面级单例 <audio> + 轻量发布订阅 store。
		* 音频元素独立于 React 生命周期，面板开关不影响播放。
		*/
		let state$3 = {
			queue: [],
			index: -1,
			playing: false,
			currentTime: 0,
			duration: 0,
			loadingUrl: false,
			error: "",
			note: "",
			volume: readVolume(),
			mode: readMode(),
			lyric: {
				lrc: "",
				tlyric: "",
				yrc: "",
				roma: ""
			},
			showLyric: localStorage.getItem("dshm-showlyric") !== "0"
		};
		const listeners$3 = /* @__PURE__ */ new Set();
		function emit$3() {
			for (const listener of listeners$3) listener();
		}
		function set$2(patch) {
			state$3 = {
				...state$3,
				...patch
			};
			emit$3();
		}
		function usePlayer(selector) {
			return (0, react.useSyncExternalStore)((onChange) => {
				listeners$3.add(onChange);
				return () => {
					listeners$3.delete(onChange);
				};
			}, () => selector(state$3));
		}
		function readVolume() {
			const raw = Number(localStorage.getItem("dshm-volume"));
			return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 1) : .9;
		}
		function readMode() {
			const raw = localStorage.getItem("dshm-mode");
			return raw === "repeat" || raw === "one" || raw === "random" ? raw : "order";
		}
		const audio = document.createElement("audio");
		audio.preload = "auto";
		audio.volume = state$3.volume;
		let currentTrackId = "";
		audio.addEventListener("timeupdate", () => {
			set$2({ currentTime: audio.currentTime });
		});
		audio.addEventListener("durationchange", () => set$2({ duration: audio.duration || 0 }));
		audio.addEventListener("play", () => {
			set$2({ playing: true });
		});
		audio.addEventListener("pause", () => {
			set$2({ playing: false });
		});
		audio.addEventListener("ended", () => onEnded());
		function onEnded() {
			if (state$3.mode === "one") {
				audio.currentTime = 0;
				audio.play().catch(() => {});
				return;
			}
			jumpToNext();
		}
		/** 随机模式取一个不同于当前的索引；其余模式顺序推进。 */
		function jumpToNext() {
			const queue = state$3.queue;
			if (queue.length === 0) return;
			if (state$3.mode === "random" && queue.length > 1) {
				let index = state$3.index;
				while (index === state$3.index) index = Math.floor(Math.random() * queue.length);
				jumpTo(index);
				return;
			}
			const nextIndex = state$3.index + 1;
			if (nextIndex >= queue.length) {
				if (state$3.mode === "repeat") jumpTo(0);
				else set$2({ playing: false });
				return;
			}
			jumpTo(nextIndex);
		}
		let cachedLrcText = "";
		let cachedLines = [];
		function currentLyricLines() {
			const source = state$3.lyric.lrc || "";
			if (source !== cachedLrcText) {
				cachedLrcText = source;
				cachedLines = parseLyricText(source);
			}
			return cachedLines;
		}
		/** 归一化匹配文本：去括号内容与全部标点空白（Mineradio normalizeMatchText）。 */
		function normalizeMatchText(text) {
			return String(text ?? "").toLowerCase().replace(/[（(【[].*?[）)】\]]/g, "").replace(/[\s·・\-—_.,，。:：'"“”‘’/\\|]+/g, "");
		}
		function artistNamePartsOf(artists) {
			return artists.map((name) => normalizeMatchText(name)).filter(Boolean);
		}
		/** 同名同歌手判定（Mineradio isSameTitleArtist 移植）：标题归一化相等 + 歌手交集。 */
		function isSameTitleArtist(source, candidate) {
			const titleA = normalizeMatchText(source.name);
			const titleB = normalizeMatchText(candidate.name);
			if (!titleA || !titleB || titleA !== titleB) return false;
			const a = artistNamePartsOf(source.artists);
			const b = artistNamePartsOf(candidate.artists);
			if (!a.length || !b.length) return false;
			return a.some((name) => b.includes(name));
		}
		const PROVIDER_LABEL = {
			qq: "QQ 音乐",
			netease: "网易云"
		};
		const FALLBACK_BUDGET_MS = 2e4;
		const MAX_QUEUE_ADVANCES = 2;
		const MAX_PROVIDER_ATTEMPTS = 4;
		let activeRecovery;
		let playSerial = 0;
		function keyOf(track) {
			return `${track.provider}:${normalizeMatchText(track.name)}|${artistNamePartsOf(track.artists).sort().join(",")}`;
		}
		function ensureRecovery(seedTrack) {
			if (!activeRecovery || Date.now() > activeRecovery.deadlineAt) activeRecovery = {
				deadlineAt: Date.now() + FALLBACK_BUDGET_MS,
				visited: /* @__PURE__ */ new Set([keyOf(seedTrack)]),
				advances: 0,
				attempts: 0
			};
			return activeRecovery;
		}
		function completeRecovery() {
			activeRecovery = void 0;
		}
		let platformsAt = 0;
		const platformLoggedInMap = {};
		async function refreshPlatforms() {
			try {
				const { providers } = await api.authStatus();
				for (const item of providers) platformLoggedInMap[item.provider] = item.loggedIn;
				platformsAt = Date.now();
			} catch {}
		}
		async function orderedAlternates(currentProvider) {
			if (Date.now() - platformsAt > 6e4) await refreshPlatforms();
			return (currentProvider === "qq" ? ["netease"] : ["qq"]).sort((a, b) => Number(platformLoggedInMap[b] ?? false) - Number(platformLoggedInMap[a] ?? false));
		}
		async function resolveAndPlay(track) {
			playSerial += 1;
			activeRecovery = void 0;
			await fetchAndCommit(track, { depth: 0 }, playSerial);
		}
		async function fetchAndCommit(track, opts, myToken) {
			const depth = opts.depth ?? 0;
			set$2({
				loadingUrl: true,
				error: "",
				currentTime: 0,
				duration: track.durationMs / 1e3
			});
			try {
				const quality = getQualityPref();
				let result = await api.songUrl(track.id, quality, track.mediaMid);
				if (!result.url && quality !== "standard") result = await api.songUrl(track.id, "standard", track.mediaMid);
				if (myToken !== playSerial) return false;
				if (result.url) {
					commitPlay(track, result.url);
					completeRecovery();
					return true;
				}
				if (depth > 0) return false;
				return await handleUnplayable(track, myToken, result.reason ?? "", opts);
			} catch (error) {
				if (myToken !== playSerial) return false;
				set$2({
					loadingUrl: false,
					error: error instanceof Error ? error.message : String(error)
				});
				return false;
			}
		}
		function commitPlay(track, url) {
			currentTrackId = track.id;
			audio.pause();
			audio.src = audioProxyUrl(url);
			audio.load();
			audio.play().catch(() => set$2({ error: "浏览器阻止了自动播放，请再点一次" }));
			set$2({ loadingUrl: false });
			api.recordPlay(track);
			loadLyric(track.id);
		}
		/** 随便听听：服务端合成曲库+红心 Top30 与 6 首随机的混合列表，一键替换队列并开播。 */
		async function startRandomMix() {
			set$2({
				note: "正在生成随机歌单…",
				error: ""
			});
			try {
				const { tracks } = await api.shuffleMix();
				if (!tracks.length) {
					set$2({ note: "" });
					return 0;
				}
				set$2({
					queue: [...tracks],
					index: -1
				});
				jumpTo(0);
				return tracks.length;
			} catch (error) {
				set$2({
					note: "",
					error: error instanceof Error ? error.message : String(error)
				});
				return 0;
			}
		}
		/** 热歌榜：直接拉公开榜单（匿名可用，无需登录），一键替换队列并开播。 */
		async function startChartMix(chartId = "3778678", title = "热歌榜") {
			set$2({
				note: `正在加载${title}…`,
				error: ""
			});
			try {
				const { tracks } = await api.chartTracks(chartId, 50);
				if (!tracks.length) {
					set$2({ note: "" });
					return 0;
				}
				set$2({
					queue: [...tracks],
					index: -1
				});
				jumpTo(0);
				return tracks.length;
			} catch (error) {
				set$2({
					note: "",
					error: error instanceof Error ? error.message : String(error)
				});
				return 0;
			}
		}
		function friendlyReason(reason, track) {
			if (track.vip) return `该歌曲为 VIP 专属，请先登录${PROVIDER_LABEL[track.provider] ?? track.provider}后再播放`;
			if (/VIP|未登录/.test(reason)) return `${PROVIDER_LABEL[track.provider] ?? track.provider} 曲目为 VIP/需登录：请在「账号」页登录后播放`;
			if (/NETEASE_URL/.test(reason)) return "网易云无可用音源（版权限制或已下架）";
			return reason || "无法获取播放地址";
		}
		async function handleUnplayable(failedTrack, myToken, reason, opts) {
			const recovery = ensureRecovery(failedTrack);
			const advances = opts.advances ?? 0;
			const alternates = await orderedAlternates(failedTrack.provider);
			if (myToken !== playSerial) return false;
			for (const provider of alternates) {
				if (Date.now() > recovery.deadlineAt || recovery.attempts >= MAX_PROVIDER_ATTEMPTS) break;
				recovery.attempts += 1;
				let candidate;
				try {
					const query = `${failedTrack.name} ${failedTrack.artists[0] ?? ""}`.trim();
					const { tracks } = await api.search(query, 12);
					candidate = tracks.find((item) => item.provider === provider && isSameTitleArtist(failedTrack, item));
				} catch {
					continue;
				}
				if (myToken !== playSerial) return false;
				if (!candidate || recovery.visited.has(keyOf(candidate))) continue;
				recovery.visited.add(keyOf(candidate));
				let probe = await api.songUrl(candidate.id, getQualityPref(), candidate.mediaMid);
				if (!probe.url) probe = await api.songUrl(candidate.id, "standard", candidate.mediaMid);
				if (myToken !== playSerial) return false;
				if (!probe.url) continue;
				const queue = [...state$3.queue];
				queue[state$3.index] = candidate;
				set$2({
					queue,
					note: `已自动切换音源（${PROVIDER_LABEL[provider] ?? provider}）`
				});
				return await fetchAndCommit(candidate, {
					depth: 1,
					advances
				}, myToken);
			}
			recovery.visited.add(keyOf(failedTrack));
			if (state$3.queue.length > 1 && advances < MAX_QUEUE_ADVANCES && Date.now() <= recovery.deadlineAt) for (let step = 1; step < state$3.queue.length; step++) {
				const index = (state$3.index + step) % state$3.queue.length;
				const nextTrack = state$3.queue[index];
				if (!nextTrack || recovery.visited.has(keyOf(nextTrack))) continue;
				recovery.advances = advances + 1;
				recovery.visited.add(keyOf(nextTrack));
				set$2({
					note: "已跳过不可播放歌曲",
					index
				});
				return await fetchAndCommit(nextTrack, {
					depth: 0,
					advances: advances + 1
				}, myToken);
			}
			activeRecovery = void 0;
			set$2({
				loadingUrl: false,
				error: friendlyReason(reason, failedTrack)
			});
			return false;
		}
		async function loadLyric(trackId) {
			try {
				const { lyric } = await api.lyric(trackId);
				if (currentTrackId === trackId) set$2({ lyric });
			} catch {}
		}
		function playTrack(track) {
			const existing = state$3.queue.findIndex((item) => item.id === track.id);
			if (existing >= 0) {
				jumpTo(existing);
				return;
			}
			const queue = [...state$3.queue, track];
			set$2({ queue });
			jumpTo(queue.length - 1);
		}
		function addToQueue(track) {
			if (state$3.queue.some((item) => item.id === track.id)) return;
			set$2({ queue: [...state$3.queue, track] });
		}
		function removeFromQueue(index) {
			const wasCurrent = index === state$3.index;
			const queue = state$3.queue.filter((_, i) => i !== index);
			if (wasCurrent) {
				stop();
				if (index < queue.length && queue.length > 0) jumpTo(Math.min(index, queue.length - 1));
				else set$2({
					queue,
					index: -1
				});
				return;
			}
			set$2({
				queue,
				index: index < state$3.index ? state$3.index - 1 : state$3.index
			});
		}
		function clearQueue() {
			stop();
			playSerial += 1;
			set$2({
				queue: [],
				index: -1
			});
		}
		function playAll(tracks) {
			if (!tracks.length) return;
			set$2({ queue: [...tracks] });
			jumpTo(0);
		}
		function jumpTo(index) {
			const track = state$3.queue[index];
			if (!track) return;
			set$2({ index });
			resolveAndPlay(track);
		}
		function next() {
			if (state$3.queue.length === 0) return;
			jumpToNext();
		}
		function prev() {
			if (state$3.queue.length === 0) return;
			if (state$3.mode === "random" && state$3.queue.length > 1) {
				let index = state$3.index;
				while (index === state$3.index) index = Math.floor(Math.random() * state$3.queue.length);
				jumpTo(index);
				return;
			}
			jumpTo((state$3.index - 1 + state$3.queue.length) % state$3.queue.length);
		}
		function stop() {
			audio.pause();
			audio.removeAttribute("src");
			currentTrackId = "";
			playSerial += 1;
			set$2({
				playing: false,
				currentTime: 0,
				duration: 0,
				lyric: {
					lrc: "",
					tlyric: "",
					yrc: "",
					roma: ""
				}
			});
		}
		function toggle() {
			if (state$3.index < 0) {
				if (state$3.queue.length > 0) jumpTo(Math.max(state$3.index, 0));
				return;
			}
			if (audio.paused) audio.play().catch(() => {});
			else audio.pause();
		}
		function seek(time) {
			audio.currentTime = time;
			set$2({ currentTime: time });
		}
		function setVolume(volume) {
			audio.volume = volume;
			localStorage.setItem("dshm-volume", String(volume));
			set$2({ volume });
		}
		function cycleMode() {
			const order = [
				"order",
				"repeat",
				"one",
				"random"
			];
			setMode(order[(order.indexOf(state$3.mode) + 1) % order.length] ?? "order");
		}
		/** 直接设置播放模式（AI 命令通道用）。 */
		function setMode(mode) {
			localStorage.setItem("dshm-mode", mode);
			set$2({ mode });
		}
		/** 提示音：优先用户上传的自定义音频；失败回退 Web Audio 内置双音。 */
		let chimeCtx = null;
		async function playCustomSound() {
			try {
				if (!(await (await fetch("/api/dsh-music/notify/sound/info")).json())?.exists) return false;
				const audio = new Audio(`/api/dsh-music/notify/sound/file?v=${Date.now()}`);
				audio.volume = Math.min(1, Math.max(state$3.volume, .6));
				await audio.play();
				return true;
			} catch {
				return false;
			}
		}
		function playBuiltInChime() {
			try {
				const Ctor = window.AudioContext ?? window.webkitAudioContext;
				if (!Ctor) return;
				chimeCtx = chimeCtx ?? new Ctor();
				const ctx = chimeCtx;
				if (ctx.state === "suspended") ctx.resume();
				const t0 = ctx.currentTime + .02;
				for (const [index, freq] of [880, 1174.66].entries()) {
					const osc = ctx.createOscillator();
					const gain = ctx.createGain();
					const start = t0 + index * .16;
					osc.type = "sine";
					osc.frequency.value = freq;
					gain.gain.setValueAtTime(1e-4, start);
					gain.gain.exponentialRampToValueAtTime(.22, start + .02);
					gain.gain.exponentialRampToValueAtTime(1e-4, start + .34);
					osc.connect(gain).connect(ctx.destination);
					osc.start(start);
					osc.stop(start + .38);
				}
			} catch {}
		}
		function playChime() {
			playCustomSound().then((ok) => {
				if (!ok) playBuiltInChime();
			});
		}
		/** 音质偏好（设置面板可调，默认 exhigh）。 */
		function getQualityPref() {
			return localStorage.getItem("dshm-quality") ?? "exhigh";
		}
		function setQualityPref(quality) {
			localStorage.setItem("dshm-quality", quality);
		}
		/** 歌词显示开关（仅控制界面）。 */
		function toggleShowLyric() {
			const next = !state$3.showLyric;
			localStorage.setItem("dshm-showlyric", next ? "1" : "0");
			set$2({ showLyric: next });
		}
		/** 卡拉OK逐帧渲染用的精确时间源（绕过 React 状态的 ~4Hz 节流）。 */
		function audioCurrentTime() {
			return audio.currentTime;
		}
		function isPlaying() {
			return !audio.paused && !audio.ended;
		}
		const BRIDGE_FLAG = "__dshMusicBridgeStarted";
		const POLL_MS = 2e3;
		/**
		* 启动浏览器↔宿主桥：每 2s 上报播放状态并取走 AI 下发的命令。
		* 幂等；面板是否展开不影响。
		*/
		function startAiBridge() {
			const flags = globalThis;
			if (flags[BRIDGE_FLAG] === true) return;
			flags[BRIDGE_FLAG] = true;
			refreshPlatforms();
			window.setInterval(() => {
				bridgePoll().then((commands) => {
					for (const command of commands) executeCommand(command);
				});
				if (state$3.index >= 0) {
					const track = state$3.queue[state$3.index];
					if (track) bridgeReport({
						trackId: track.id,
						name: track.name,
						artists: track.artists,
						album: track.album,
						provider: track.provider,
						positionSec: audio.currentTime,
						durationSec: audio.duration || track.durationMs / 1e3,
						playing: !audio.paused
					});
				}
			}, POLL_MS);
		}
		function executeCommand(command) {
			switch (command.type) {
				case "play":
					if (command.track) playTrack(command.track);
					else toggle();
					break;
				case "pause":
					audio.pause();
					break;
				case "resume":
					audio.play().catch(() => {});
					break;
				case "next":
					next();
					break;
				case "prev":
					prev();
					break;
				case "queue_add": {
					let added = 0;
					for (const track of command.tracks) {
						if (!state$3.queue.some((item) => item.id === track.id)) added += 1;
						addToQueue(track);
					}
					set$2({ note: `已加入队列 ${added} 首` });
					window.setTimeout(() => {
						if (state$3.note.startsWith("已加入队列")) set$2({ note: "" });
					}, 3e3);
					break;
				}
				case "queue_clear":
					clearQueue();
					break;
				case "volume": {
					const value = Math.min(1, Math.max(0, command.value));
					setVolume(value);
					set$2({ note: `音量 ${Math.round(value * 100)}%` });
					window.setTimeout(() => {
						if (state$3.note.startsWith("音量")) set$2({ note: "" });
					}, 2500);
					break;
				}
				case "seek":
					if (Number.isFinite(command.position)) seek(Math.max(0, command.position));
					break;
				case "mode":
					setMode(command.mode);
					set$2({ note: `播放模式：${command.mode}` });
					window.setTimeout(() => {
						if (state$3.note.startsWith("播放模式")) set$2({ note: "" });
					}, 2500);
					break;
				case "notify": {
					playChime();
					const text = `🔔 ${command.title}${command.text ? `：${command.text}` : ""}`;
					set$2({ note: text });
					window.setTimeout(() => {
						if (state$3.note === text) set$2({ note: "" });
					}, 6e3);
					break;
				}
			}
		}
		//#endregion
		//#region src/client/Karaoke.tsx
		/**
		* 卡拉OK歌词视图 —— Canvas2D 逐字染色（移植 Mineradio 同步算法：
		* 二分定位当前行 → 行内词级插值 → 离屏实测词宽占比 → 双色填充）。
		*/
		/** 词在整行中的像素占比区间（对齐 Mineradio lyricKaraokeWordRanges）。 */
		function measureWordRanges(line, font) {
			const ctx = document.createElement("canvas").getContext("2d");
			if (!ctx || !line.words?.length) return [];
			ctx.font = font;
			const widths = line.words.map((word) => Math.max(ctx.measureText(word.text).width, 1));
			const total = widths.reduce((sum, width) => sum + width, 0);
			let cursor = 0;
			return widths.map((width) => {
				const p0 = cursor / total;
				cursor += width;
				return {
					p0,
					p1: cursor / total
				};
			});
		}
		/** smoothstep 整行进度（无逐字数据时的退化曲线，Mineradio 同款）。 */
		function lineProgress(now, line) {
			const raw = (now - line.t) / Math.max(line.duration || .001, .001);
			const clamped = Math.max(0, Math.min(1, raw));
			return clamped * clamped * (3 - 2 * clamped);
		}
		/** 二分定位当前行索引。 */
		function findLineIndex(lines, now) {
			let lo = 0;
			let hi = lines.length - 1;
			let found = -1;
			while (lo <= hi) {
				const mid = lo + hi >> 1;
				const candidate = lines[mid];
				if (candidate && candidate.t <= now) {
					found = mid;
					lo = mid + 1;
				} else hi = mid - 1;
			}
			return found;
		}
		const FONT = "700 20px \"Segoe UI\", system-ui, -apple-system, sans-serif";
		const BASE_COLOR = "rgba(154,163,199,0.75)";
		const HI_COLOR = "#ffffff";
		function Karaoke() {
			const lyric = usePlayer((s) => s.lyric);
			const playing = usePlayer((s) => s.playing);
			const canvasRef = (0, react.useRef)(null);
			const payload = (0, react.useMemo)(() => buildKaraokePayload(lyric), [
				lyric.lrc,
				lyric.yrc,
				lyric.tlyric
			]);
			(0, react.useEffect)(() => {
				const canvas = canvasRef.current;
				if (!canvas) return void 0;
				const dpr = Math.min(window.devicePixelRatio || 1, 2);
				const cssW = canvas.clientWidth;
				const cssH = canvas.clientHeight;
				canvas.width = Math.round(cssW * dpr);
				canvas.height = Math.round(cssH * dpr);
				const ctx = canvas.getContext("2d");
				if (!ctx) return void 0;
				ctx.scale(dpr, dpr);
				let raf = 0;
				const rangesCache = /* @__PURE__ */ new Map();
				function wordRanges(index, line) {
					let ranges = rangesCache.get(index);
					if (!ranges) {
						ranges = measureWordRanges(line, FONT);
						rangesCache.set(index, ranges);
					}
					return ranges ?? [];
				}
				/** 单行卡拉OK绘制：返回实际文本宽度。 */
				function drawLine(line, index, now, y, alpha, karaoke) {
					const words = line.words ?? [];
					const hasWords = karaoke && words.length > 0;
					const metrics = ctx.measureText(line.text);
					const x = Math.max(8, (cssW - metrics.width) / 2);
					ctx.save();
					ctx.globalAlpha = alpha;
					ctx.font = FONT;
					ctx.fillStyle = BASE_COLOR;
					ctx.textBaseline = "middle";
					ctx.fillText(line.text, x, y);
					let progress;
					if (!hasWords) progress = lineProgress(now, line);
					else {
						const ranges = wordRanges(index, line);
						progress = 0;
						for (let i = 0; i < words.length; i++) {
							const word = words[i];
							const range = ranges[i];
							if (!word || !range) continue;
							if (now >= word.t + word.d) progress = range.p1;
							else if (now >= word.t) {
								const local = (now - word.t) / word.d;
								progress = range.p0 + local * (range.p1 - range.p0);
								break;
							}
						}
					}
					if (progress > .002) {
						const clipWidth = metrics.width * Math.min(progress, 1);
						ctx.save();
						ctx.beginPath();
						ctx.rect(x - 1, y - cssH, clipWidth + 2, cssH * 2);
						ctx.clip();
						ctx.fillStyle = HI_COLOR;
						ctx.fillText(line.text, x, y);
						ctx.restore();
					}
					ctx.restore();
				}
				function render() {
					const now = audioCurrentTime();
					ctx.clearRect(0, 0, cssW, cssH);
					const lines = payload.lines;
					if (!lines.length) {
						ctx.font = "500 12px system-ui";
						ctx.fillStyle = "rgba(154,163,199,0.6)";
						ctx.textAlign = "center";
						ctx.fillText(isPlaying() ? "♪ 无歌词" : "♪ 暂停中", cssW / 2, cssH / 2);
						ctx.textAlign = "left";
						return;
					}
					const index = findLineIndex(lines, now);
					const current = index >= 0 ? lines[index] : void 0;
					if (current && current.text) drawLine(current, index, now, cssH / 2, 1, payload.source === "yrc-word");
				}
				let tick = null;
				function startTick() {
					if (tick) return;
					tick = () => {
						render();
						raf = requestAnimationFrame(tick);
					};
					tick();
				}
				function stopTick() {
					if (!tick) return;
					cancelAnimationFrame(raf);
					tick = null;
				}
				if (playing && payload.lines.length > 0) startTick();
				return () => {
					stopTick();
				};
			}, [payload, playing]);
			if (!lyric.lrc && !lyric.yrc) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("canvas", {
				ref: canvasRef,
				className: "dshm-karaoke",
				title: payload.source === "yrc-word" ? "逐字卡拉OK" : "逐行歌词"
			});
		}
		//#endregion
		//#region src/client/qrLogin.ts
		/**
		* 网易扫码登录生命周期（模块级单例）——
		* 不依赖组件挂载：切页签/收起面板不中断轮询；二维码过期自动换新码。
		*/
		let state$2 = { phase: "idle" };
		const listeners$2 = /* @__PURE__ */ new Set();
		function emit$2() {
			for (const listener of listeners$2) listener();
		}
		function set$1(patch) {
			state$2 = {
				...state$2,
				...patch
			};
			emit$2();
		}
		function subscribe$2(onChange) {
			listeners$2.add(onChange);
			return () => {
				listeners$2.delete(onChange);
			};
		}
		function useQrLogin() {
			return (0, react.useSyncExternalStore)(subscribe$2, () => state$2);
		}
		const MAX_RENEWALS$1 = 3;
		/** 主动刷新兜底阈值（正常过期由后端 800 驱动；阈值过高会在死码上干等）。 */
		const QR_TTL_MS$1 = 18e4;
		let seq$1 = 0;
		let timer$1;
		let currentKey = "";
		let renewals$1 = 0;
		let qrStartAt = 0;
		/** 换新码进行中：阻断轮询重入，防止同一时刻多次触发 begin 竞态烧光重试次数。 */
		let renewing$1 = false;
		function clearTimer$1() {
			if (timer$1 !== void 0) {
				window.clearInterval(timer$1);
				timer$1 = void 0;
			}
		}
		/** 触发一次换新码（含次数预算）；期间暂停轮询。 */
		function triggerRenewal$1() {
			if (renewing$1) return;
			renewals$1 += 1;
			clearTimer$1();
			if (renewals$1 > MAX_RENEWALS$1) {
				set$1({
					phase: "given-up",
					note: "二维码多次过期，请点击重新获取"
				});
				return;
			}
			begin$1();
		}
		/** 用户点击「扫码登录」时调用。幂等：重置一切并重新开始。 */
		function startQrLogin() {
			stopQrLogin();
			seq$1 += 1;
			renewals$1 = 0;
			set$1({
				phase: "starting",
				img: void 0,
				nickname: void 0,
				note: void 0
			});
			begin$1();
		}
		/** 离开登录界面时可调用（可选；后台继续轮询也无妨）。 */
		function stopQrLogin() {
			clearTimer$1();
			currentKey = "";
		}
		async function begin$1() {
			const mySeq = seq$1;
			renewing$1 = true;
			try {
				const { key } = await api.neteaseQrStart();
				if (mySeq !== seq$1) return;
				currentKey = key;
				const { img } = await api.neteaseQrCreate(key);
				if (mySeq !== seq$1) return;
				qrStartAt = Date.now();
				set$1({
					phase: "waiting",
					img,
					note: renewals$1 > 0 ? `二维码已过期，已自动刷新（第 ${renewals$1} 次）` : void 0
				});
				clearTimer$1();
				timer$1 = window.setInterval(() => {
					poll$1();
				}, 2e3);
			} catch (cause) {
				if (mySeq !== seq$1) return;
				set$1({
					phase: "idle",
					note: cause instanceof Error ? cause.message : String(cause)
				});
			} finally {
				renewing$1 = false;
			}
		}
		async function poll$1() {
			if (renewing$1) return;
			const mySeq = seq$1;
			const key = currentKey;
			if (!key) return;
			try {
				const { qr } = await api.neteaseQrCheck(key);
				if (mySeq !== seq$1) return;
				if (qr.code === 801) {
					if (Date.now() - qrStartAt > QR_TTL_MS$1) triggerRenewal$1();
					else set$1({ phase: "waiting" });
				} else if (qr.code === 802) set$1({ phase: "scanned" });
				else if (qr.code === 803) {
					clearTimer$1();
					set$1({
						phase: "success",
						nickname: qr.nickname,
						note: qr.verified === false ? qr.message : void 0,
						verified: qr.verified
					});
				} else if (qr.code === 800) triggerRenewal$1();
			} catch {}
		}
		//#endregion
		//#region src/client/qqQrLogin.ts
		/**
		* QQ 扫码登录生命周期（模块级单例）——
		* 复用网易云扫码的状态机思路，但走腾讯 ptlogin 二维码轮询。
		* 二维码过期自动换新码（最佳努力）。
		*/
		let state$1 = { phase: "idle" };
		const listeners$1 = /* @__PURE__ */ new Set();
		function emit$1() {
			for (const listener of listeners$1) listener();
		}
		function set(patch) {
			state$1 = {
				...state$1,
				...patch
			};
			emit$1();
		}
		function subscribe$1(onChange) {
			listeners$1.add(onChange);
			return () => {
				listeners$1.delete(onChange);
			};
		}
		function useQqQrLogin() {
			return (0, react.useSyncExternalStore)(subscribe$1, () => state$1);
		}
		const MAX_RENEWALS = 3;
		/** 主动刷新兜底阈值（正常过期由后端 expired 驱动；阈值过高会在死码上干等）。 */
		const QR_TTL_MS = 18e4;
		let seq = 0;
		let timer;
		let qrsig = "";
		let ptLoginSig = "";
		let renewals = 0;
		let qqStartAt = 0;
		/** 换新码进行中：阻断轮询重入，防止同一时刻多次触发 begin 竞态烧光重试次数。 */
		let renewing = false;
		function clearTimer() {
			if (timer !== void 0) {
				window.clearInterval(timer);
				timer = void 0;
			}
		}
		/** 触发一次换新码（含次数预算）；期间暂停轮询。 */
		function triggerRenewal() {
			if (renewing) return;
			renewals += 1;
			clearTimer();
			if (renewals > MAX_RENEWALS) {
				set({
					phase: "given-up",
					note: "二维码多次过期，请点击重新获取"
				});
				return;
			}
			begin();
		}
		/** 用户点击「扫码登录」时调用。幂等：重置一切并重新开始。 */
		function startQqQrLogin() {
			stopQqQrLogin();
			seq += 1;
			renewals = 0;
			set({
				phase: "starting",
				img: void 0,
				note: void 0
			});
			begin();
		}
		/** 离开登录界面时可调用（可选）。 */
		function stopQqQrLogin() {
			clearTimer();
			qrsig = "";
			ptLoginSig = "";
		}
		async function begin() {
			const mySeq = seq;
			renewing = true;
			try {
				const { qrsig: qs, ptLoginSig: ps, img } = await api.qqQrStart();
				if (mySeq !== seq) return;
				qrsig = qs;
				ptLoginSig = ps;
				qqStartAt = Date.now();
				set({
					phase: "waiting",
					img,
					note: renewals > 0 ? `二维码已过期，已自动刷新（第 ${renewals} 次）` : void 0
				});
				clearTimer();
				timer = window.setInterval(() => {
					poll();
				}, 2e3);
			} catch (cause) {
				if (mySeq !== seq) return;
				set({
					phase: "idle",
					note: cause instanceof Error ? cause.message : String(cause)
				});
			} finally {
				renewing = false;
			}
		}
		async function poll() {
			if (renewing) return;
			const mySeq = seq;
			if (!qrsig || !ptLoginSig) return;
			try {
				const { qr } = await api.qqQrCheck(qrsig, ptLoginSig);
				if (mySeq !== seq) return;
				if (qr.phase === "waiting") {
					if (Date.now() - qqStartAt > QR_TTL_MS) triggerRenewal();
					else set({ phase: "waiting" });
				} else if (qr.phase === "scanned") set({ phase: "scanned" });
				else if (qr.phase === "success") {
					clearTimer();
					set({
						phase: "success",
						note: qr.note
					});
				} else if (qr.phase === "expired") triggerRenewal();
				else set({ note: qr.note ?? "扫码出错，将继续重试" });
			} catch {}
		}
		//#endregion
		//#region src/providers/types.ts
		/** 曲目唯一键 `${provider}:${songId}`。 */
		function trackKey(track) {
			return `${track.provider}:${track.songId}`;
		}
		//#endregion
		//#region src/client/library.ts
		/**
		* 曲库（多列表）客户端 store —— 列表数据 + 本地红心快速判定。
		* 数据源：宿主 /lists（library.json 持久化）。
		*/
		let state = {
			loaded: false,
			lists: [],
			recent: []
		};
		const listeners = /* @__PURE__ */ new Set();
		function emit() {
			for (const listener of listeners) listener();
		}
		function setLists(lists, recent) {
			state = {
				loaded: true,
				lists,
				recent: recent ?? state.recent
			};
			emit();
		}
		async function loadLibrary() {
			try {
				const data = await api.getLists();
				setLists(data.lists, data.recent);
			} catch {
				state = {
					...state,
					loaded: true
				};
				emit();
			}
		}
		/** 首次订阅时自动拉取一次。 */
		function subscribe(onChange) {
			if (!state.loaded) loadLibrary();
			listeners.add(onChange);
			return () => {
				listeners.delete(onChange);
			};
		}
		function useLibrary() {
			return (0, react.useSyncExternalStore)(subscribe, () => state);
		}
		function isFavorite(key) {
			return !!state.lists.find((list) => list.id === "fav")?.tracks.some((track) => trackKey(track) === key);
		}
		/** 切换本地红心；乐观更新，失败回滚。网易登录状态下双写平台红心。 */
		async function toggleFavorite(track) {
			const key = trackKey(track);
			const willAdd = !isFavorite(key);
			applyFavLocal(key, track, willAdd);
			try {
				if (willAdd) await api.addToList("fav", track);
				else await api.removeFromList("fav", key);
			} catch {
				applyFavLocal(key, track, !willAdd);
				return false;
			}
			if (track.provider === "netease") neteaseLoggedIn().then((loggedIn) => {
				if (!loggedIn) return;
				api.neteaseLike(track.songId, willAdd).catch(() => {});
			});
			return willAdd;
		}
		let neteaseLoginAt = 0;
		let neteaseLoginValue = false;
		async function neteaseLoggedIn() {
			if (Date.now() - neteaseLoginAt < 6e4) return neteaseLoginValue;
			try {
				const { providers } = await api.authStatus();
				neteaseLoginValue = providers.find((entry) => entry.provider === "netease")?.loggedIn === true;
				neteaseLoginAt = Date.now();
				return neteaseLoginValue;
			} catch {
				return false;
			}
		}
		/** 导出全部列表为 JSON 文件下载。 */
		function exportLibrary(lists) {
			const payload = {
				app: "dsh-music-huazai",
				exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
				lists: lists.filter((list) => list.tracks.length > 0)
			};
			const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `dsh-music-library-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
			link.click();
			URL.revokeObjectURL(url);
		}
		/** 从备份文件导入列表（新建同名自定义列表，曲目去重合并）。 */
		async function importLibraryFile(file) {
			const text = await file.text();
			const parsed = JSON.parse(text);
			if (!Array.isArray(parsed.lists)) throw new Error("备份格式不正确");
			let count = 0;
			for (const raw of parsed.lists) {
				const name = String(raw.name ?? "").trim();
				const tracks = Array.isArray(raw.tracks) ? raw.tracks : [];
				if (!name || !tracks.length) continue;
				const { list } = await api.createList(`${name} (导入)`);
				const results = await Promise.allSettled(tracks.map((track) => api.addToList(list.id, track)));
				count += results.filter((r) => r.status === "fulfilled" && r.value.added).length;
			}
			await loadLibrary();
			return count;
		}
		function applyFavLocal(key, track, add) {
			setLists(state.lists.map((list) => {
				if (list.id !== "fav") return list;
				const tracks = add ? [...list.tracks, track] : list.tracks.filter((item) => trackKey(item) !== key);
				return {
					...list,
					tracks
				};
			}));
		}
		async function createCustomList(name) {
			const { list } = await api.createList(name);
			setLists([...state.lists, list]);
		}
		async function deleteCustomList(id) {
			await api.deleteList(id);
			setLists(state.lists.filter((list) => list.id !== id));
		}
		async function removeFromList(listId, track) {
			const key = trackKey(track);
			const before = state.lists;
			setLists(before.map((list) => list.id === listId ? {
				...list,
				tracks: list.tracks.filter((item) => trackKey(item) !== key)
			} : list));
			try {
				await api.removeFromList(listId, key);
			} catch {
				setLists(before);
			}
		}
		//#endregion
		//#region src/client/styles.ts
		/**
		* 播放器面板样式 —— 从 PlayerPanel.tsx 拆分。
		*/
		const CSS = `
.dshm-panel {
  position: fixed; right: 18px; bottom: 70px; z-index: 2147483000;
  width: 340px; max-height: calc(100vh - 100px);
  display: flex; flex-direction: column;
  border-radius: 16px; overflow: hidden;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(15,17,27,.88);
  backdrop-filter: blur(18px) saturate(1.35);
  color: #eef1ff; font-size: 13px;
  box-shadow: 0 16px 48px rgba(0,0,0,.5);
  font-family: inherit;
}
.dshm-head { display:flex; align-items:center; gap:8px; padding:12px 14px 8px; }
.dshm-logo { color:#7c5cff; font-size:16px; }
.dshm-title { font-weight:700; letter-spacing:.5px; flex:1; }
.dshm-x { background:none; border:none; color:#9aa3c7; font-size:18px; cursor:pointer; }
.dshm-tabs { display:flex; gap:4px; padding:0 14px; border-bottom:1px solid rgba(255,255,255,.08); }
.dshm-tab { background:none; border:none; color:#9aa3c7; padding:6px 10px; cursor:pointer; font-size:12px; border-radius:8px 8px 0 0; }
.dshm-tab-on { color:#fff; background:rgba(124,92,255,.22); }
.dshm-body { flex:1; overflow-y:auto; padding:10px 12px; display:flex; flex-direction:column; gap:8px; scrollbar-width:thin; }
.dshm-search-row { display:flex; gap:6px; }
.dshm-input { flex:1; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.12); border-radius:10px; padding:7px 10px; color:#fff; outline:none; font-size:13px; }
.dshm-input:focus { border-color:#7c5cff; }
.dshm-go { width:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#7c5cff,#38bdf8); color:#fff; cursor:pointer; font-weight:700; }
.dshm-clear { width:30px; border:1px solid rgba(255,255,255,.12); border-radius:10px; background:rgba(255,255,255,.07); color:#cfd3e6; cursor:pointer; font-size:12px; }
.dshm-clear:hover { border-color:#7c5cff; color:#fff; }
.dshm-charts { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
.dshm-list { display:flex; flex-direction:column; gap:2px; }
.dshm-item { display:flex; align-items:center; gap:4px; border-radius:10px; }
.dshm-item:hover { background:rgba(255,255,255,.06); }
.dshm-item-active .dshm-item-name { color:#8be9fd; }
.dshm-item-main { flex:1; display:flex; align-items:center; gap:8px; padding:6px 8px; background:none; border:none; color:inherit; text-align:left; cursor:pointer; min-width:0; }
.dshm-badge { flex:none; width:18px; height:18px; border-radius:5px; font-size:11px; display:flex; align-items:center; justify-content:center; color:#fff; }
.dshm-badge-netease { background:#ec4141; }
.dshm-badge-qq { background:#31c27c; }
.dshm-item-texts { flex:1; min-width:0; display:flex; flex-direction:column; }
.dshm-item-name { font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dshm-item-sub { font-size:11px; color:#9aa3c7; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dshm-vip { font-style:normal; margin-left:6px; font-size:9px; padding:1px 4px; border-radius:4px; background:linear-gradient(135deg,#f5a623,#f76b1c); color:#fff; vertical-align:1px; }
.dshm-dur { font-size:11px; color:#9aa3c7; }
.dshm-icon { background:none; border:none; color:#9aa3c7; cursor:pointer; font-size:12px; padding:4px 6px; border-radius:8px; }
.dshm-icon:hover { color:#fff; background:rgba(255,255,255,.08); }
.dshm-empty { text-align:center; color:#9aa3c7; font-size:12px; padding:26px 0; line-height:1.9; }
.dshm-err { font-size:11.5px; color:#ff9b9b; padding:4px 2px; }
.dshm-note { font-size:11.5px; color:#8be9fd; }
.dshm-playall-row { display:flex; gap:6px; }
.dshm-mini { background:none; border:1px solid rgba(255,255,255,.16); color:#cdd4f5; border-radius:8px; padding:3px 10px; cursor:pointer; font-size:11.5px; }
.dshm-mini:hover { border-color:#7c5cff; color:#fff; }
.dshm-now { border-top:1px solid rgba(255,255,255,.09); padding:10px 14px 12px; background:rgba(10,11,20,.55); }
.dshm-now-top { display:flex; align-items:center; gap:10px; }
.dshm-cover { width:40px; height:40px; border-radius:9px; object-fit:cover; }
.dshm-cover-empty { display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#7c5cff33,#38bdf833); color:#aab; font-size:18px; }
.dshm-now-meta { flex:1; min-width:0; }
.dshm-now-name { font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dshm-now-sub { font-size:11px; color:#9aa3c7; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; }
.dshm-spin { color:#7c5cff; animation:dshm-rotate 1.2s linear infinite; }
.dshm-karaoke { width:100%; height:34px; display:block; margin-top:4px; }
@keyframes dshm-rotate { to { transform:rotate(360deg); } }
.dshm-range { width:100%; accent-color:#7c5cff; height:4px; cursor:pointer; }
.dshm-times { display:flex; justify-content:space-between; font-size:10.5px; color:#9aa3c7; margin:-2px 0 2px; }
.dshm-controls { display:flex; align-items:center; gap:6px; }
.dshm-playbtn { width:36px; height:36px; border:none; border-radius:50%; background:linear-gradient(135deg,#7c5cff,#38bdf8); color:#fff; font-size:14px; cursor:pointer; }
.dshm-vol { flex:1; }
.dshm-auth { display:flex; flex-direction:column; gap:14px; }
.dshm-auth-block { display:flex; flex-direction:column; gap:8px; }
.dshm-auth-name { display:flex; align-items:center; gap:8px; font-weight:600; font-size:12.5px; }
.dshm-chip { font-style:normal; font-size:10.5px; padding:2px 8px; border-radius:999px; background:rgba(255,255,255,.08); color:#9aa3c7; font-weight:400; }
.dshm-chip-ok { background:rgba(110,231,168,.16); color:#6ee7a8; }
.dshm-qr { display:flex; flex-direction:column; align-items:center; gap:6px; }
.dshm-qr img { border-radius:10px; background:#fff; padding:6px; }
.dshm-textarea { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); border-radius:10px; color:#cdd4f5; padding:8px; font-size:11px; resize:vertical; outline:none; }
.dshm-textarea:focus { border-color:#31c27c; }
.dshm-btn { align-self:flex-start; border:none; border-radius:9px; padding:7px 16px; background:linear-gradient(135deg,#7c5cff,#38bdf8); color:#fff; cursor:pointer; font-size:12.5px; }
.dshm-gh { display:flex; align-items:center; color:#9aa3c7; }
.dshm-gh:hover { color:#fff; }
.dshm-gear-on { color:#7c5cff !important; transform:rotate(45deg); }
.dshm-x { transition:transform .15s ease, color .15s ease; }
.dshm-settings { display:flex; flex-direction:column; gap:10px; padding-bottom:6px; }
.dshm-set-title { font-weight:700; font-size:12.5px; display:flex; align-items:center; gap:8px; margin-top:4px; }
.dshm-set-state { font-weight:400; font-size:11px; color:#9aa3c7; }
.dshm-select { background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.14); border-radius:8px; color:#eef1ff; padding:5px 8px; font-size:12px; outline:none; }
.dshm-select option { color:#111; }
.dshm-num { width:70px; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.14); border-radius:8px; color:#eef1ff; padding:5px 8px; font-size:12px; outline:none; }
.dshm-check-row { display:flex; align-items:center; gap:8px; font-size:12.5px; cursor:pointer; }
.dshm-check-row input { accent-color:#7c5cff; }
.dshm-set-row { display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:12.5px; }
.dshm-note-ok { color:#6ee7a8; }
.dshm-heart { background:none; border:none; cursor:pointer; font-size:13px; padding:4px 4px; color:#5b6488; }
.dshm-heart:hover { color:#ff6b81; }
.dshm-heart-on { color:#ff5c74 !important; }
.dshm-history { display:flex; flex-wrap:wrap; gap:4px; }
.dshm-chip-hist { background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.12); border-radius:999px; color:#cdd4f5; font-size:11px; padding:3px 9px; cursor:pointer; }
.dshm-chip-hist:hover { border-color:#7c5cff; color:#fff; }
.dshm-chip-on { background:rgba(124,92,255,.28); border-color:#7c5cff; color:#fff; }
.dshm-chip-clear { opacity:.55; }
.dshm-lyrbtn { flex:none; width:24px; height:24px; border-radius:50%; border:1px solid rgba(255,255,255,.2); background:none; color:#9aa3c7; font-size:11px; cursor:pointer; }
.dshm-lyrbtn-on { color:#fff; border-color:#38bdf8; background:rgba(56,189,248,.18); }
.dshm-karaoke-off { height:auto; padding:2px 0 4px; }
.dshm-libchips { display:flex; flex-wrap:wrap; gap:4px; }
.dshm-newlist { display:flex; gap:4px; align-items:center; margin-left:auto; }
.dshm-lucky { width:100%; border:1px solid rgba(124,92,255,.45); border-radius:10px; padding:8px 0; background:linear-gradient(135deg,rgba(124,92,255,.22),rgba(56,189,248,.18)); color:#eef1ff; font-size:13px; cursor:pointer; letter-spacing:.5px; }
.dshm-lucky:hover { filter:brightness(1.2); }
.dshm-lucky:disabled { opacity:.55; cursor:default; }
.dshm-file-hidden { display:none; }
.dshm-sec-head { display:flex; align-items:center; gap:6px; }
.dshm-alarm-list { display:flex; flex-direction:column; gap:2px; }
.dshm-alarm-form { display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:12px; color:#9aa3c7; }
.dshm-time { width:96px; }
.dshm-alarm-row { display:flex; align-items:center; gap:8px; font-size:12px; padding:2px 0; }
.dshm-alarm-time { color:#8be9fd; font-weight:600; min-width:38px; }
.dshm-alarm-kw { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#cdd4f5; }
`;
		//#endregion
		//#region src/client/PlayerPanel.tsx
		/**
		* 播放器面板 —— 搜索 / 曲库 / 队列 / 账号 四 Tab + 底部正在播放控制条。
		*/
		const REPO_URL = "https://github.com/nxz1026/SinglePlayer";
		const MODE_LABEL = {
			order: "顺序",
			repeat: "循环",
			one: "单曲",
			random: "随机"
		};
		const QUALITY_LABEL = {
			standard: "标准 128k",
			exhigh: "较高 320k",
			lossless: "无损 FLAC",
			hires: "Hi-Res"
		};
		const HISTORY_KEY = "dshm-search-history";
		/** 面板跟随悬浮球展开的几何参数。 */
		const PANEL_W = 340;
		const PANEL_GAP = 10;
		const MIN_SPACE_ABOVE = 200;
		/** 计算面板相对悬浮球的定位（上方空间不足时翻转到下方）。 */
		function panelStyleFor(anchor) {
			const maxLeft = Math.max(PANEL_GAP, window.innerWidth - PANEL_W - PANEL_GAP);
			const left = Math.min(Math.max(PANEL_GAP, anchor.x + 44 - PANEL_W), maxLeft);
			if (anchor.y - PANEL_GAP >= MIN_SPACE_ABOVE) return {
				left,
				right: "auto",
				top: "auto",
				bottom: window.innerHeight - anchor.y + PANEL_GAP
			};
			return {
				left,
				right: "auto",
				top: anchor.y + 44 + PANEL_GAP,
				bottom: "auto"
			};
		}
		function fmt(seconds) {
			if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
			const m = Math.floor(seconds / 60);
			const s = Math.floor(seconds % 60);
			return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
		}
		function Surface({ open, onClose, anchor }) {
			const [tab, setTab] = (0, react.useState)("search");
			const queueLength = usePlayer((s) => s.queue.length);
			if (!open) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dshm-panel",
				style: anchor ? panelStyleFor(anchor) : void 0,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: CSS }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshm-head",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dshm-logo",
								children: "♪"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dshm-title",
								children: "单身汉播放器"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
								className: "dshm-gh",
								href: REPO_URL,
								target: "_blank",
								rel: "noreferrer",
								title: "GitHub 仓库",
								"aria-label": "GitHub 仓库",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
									viewBox: "0 0 16 16",
									width: "15",
									height: "15",
									fill: "currentColor",
									"aria-hidden": "true",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" })
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: tab === "settings" ? "dshm-x dshm-gear-on" : "dshm-x",
								title: "设置",
								"aria-label": "设置",
								onClick: () => setTab((value) => value === "settings" ? "search" : "settings"),
								children: "⚙"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dshm-x",
								onClick: onClose,
								"aria-label": "关闭",
								children: "×"
							})
						]
					}),
					tab !== "settings" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshm-tabs",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: tab === "search" ? "dshm-tab dshm-tab-on" : "dshm-tab",
								onClick: () => setTab("search"),
								children: "搜索"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: tab === "library" ? "dshm-tab dshm-tab-on" : "dshm-tab",
								onClick: () => setTab("library"),
								children: "曲库"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: tab === "queue" ? "dshm-tab dshm-tab-on" : "dshm-tab",
								onClick: () => setTab("queue"),
								children: ["队列", queueLength > 0 ? `(${queueLength})` : ""]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: tab === "auth" ? "dshm-tab dshm-tab-on" : "dshm-tab",
								onClick: () => setTab("auth"),
								children: "账号"
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshm-body",
						children: [
							tab === "search" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SearchTab, {}),
							tab === "library" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LibraryTab, {}),
							tab === "queue" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(QueueTab, {}),
							tab === "auth" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AuthTab, {}),
							tab === "settings" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingsView, {})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(NowPlaying, {})
				]
			});
		}
		function SettingsView() {
			const [quality, setQuality] = (0, react.useState)(getQualityPref());
			const [settings, setSettings] = (0, react.useState)(null);
			const [providers, setProviders] = (0, react.useState)([]);
			const [schedule, setSchedule] = (0, react.useState)(null);
			const [savedNote, setSavedNote] = (0, react.useState)("");
			const [alarmTime, setAlarmTime] = (0, react.useState)("07:30");
			const [alarmKeyword, setAlarmKeyword] = (0, react.useState)("");
			const [alarmLabel, setAlarmLabel] = (0, react.useState)("");
			const [sleepMinutes, setSleepMinutes] = (0, react.useState)(30);
			const soundFileRef = (0, react.useRef)(null);
			const [soundInfo, setSoundInfo] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				api.getPluginSettings().then(({ settings }) => setSettings(settings)).catch(() => {});
				api.listProviders().then(({ providers }) => setProviders(providers)).catch(() => {});
				refreshSchedule();
				api.notifySoundInfo().then(setSoundInfo).catch(() => {});
			}, []);
			const refreshSchedule = (0, react.useCallback)(() => api.scheduleStatus().then(setSchedule).catch(() => {}), []);
			const patchSwitches = (0, react.useCallback)((patch) => {
				api.savePluginSettings(patch).then(({ settings }) => {
					setSettings(settings);
					setSavedNote("已保存");
					window.setTimeout(() => setSavedNote(""), 1500);
				}).catch((cause) => setSavedNote(cause instanceof Error ? cause.message : String(cause)));
			}, []);
			const noteError = (0, react.useCallback)((cause) => {
				setSavedNote(cause instanceof Error ? cause.message : String(cause));
				window.setTimeout(() => setSavedNote(""), 2500);
			}, []);
			const addAlarm = (0, react.useCallback)(() => {
				const kw = alarmKeyword.trim();
				if (!kw) return;
				api.alarmAdd(alarmTime, kw, alarmLabel.trim() || void 0).then(refreshSchedule).then(() => {
					setAlarmKeyword("");
					setAlarmLabel("");
				}).catch(noteError);
			}, [
				alarmTime,
				alarmKeyword,
				alarmLabel,
				refreshSchedule,
				noteError
			]);
			const startSleep = (0, react.useCallback)(() => {
				api.sleepSet(Math.min(720, Math.max(1, Math.round(sleepMinutes)))).then(refreshSchedule).catch(noteError);
			}, [
				sleepMinutes,
				refreshSchedule,
				noteError
			]);
			const stopSleep = (0, react.useCallback)(() => {
				api.sleepClear().then(refreshSchedule).catch(() => {});
			}, [refreshSchedule]);
			const dropAlarm = (0, react.useCallback)((id) => {
				api.alarmRemove(id).then(refreshSchedule).catch(() => {});
			}, [refreshSchedule]);
			const uploadSound = (0, react.useCallback)((file) => {
				api.uploadNotifySound(file).then((info) => {
					setSoundInfo(info);
					setSavedNote("提示音已更新");
				}).then(() => {
					window.setTimeout(() => setSavedNote(""), 1500);
				}).catch(noteError);
			}, [noteError]);
			const resetSound = (0, react.useCallback)(() => {
				api.resetNotifySound().then(() => api.notifySoundInfo()).then(setSoundInfo).catch(noteError);
			}, [noteError]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dshm-settings",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dshm-set-title",
						children: "音质偏好"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
						className: "dshm-select",
						value: quality,
						onChange: (event) => {
							setQuality(event.target.value);
							setQualityPref(event.target.value);
							setSavedNote("下次播放生效");
							window.setTimeout(() => setSavedNote(""), 1500);
						},
						children: Object.entries(QUALITY_LABEL).map(([value, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value,
							children: label
						}, value))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dshm-set-title",
						children: "通知与定时"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "dshm-check-row",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: settings?.notifySound ?? true,
							onChange: (event) => patchSwitches({ notifySound: event.target.checked })
						}), "声音提示音（浏览器）"]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "dshm-check-row",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: settings?.schedulerEnabled ?? true,
							onChange: (event) => patchSwitches({ schedulerEnabled: event.target.checked })
						}), "定时任务（闹钟 / 睡眠定时器）"]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "dshm-check-row",
						onClick: (e) => {
							if (e.target === e.currentTarget) {
								const cb = e.currentTarget.querySelector("input");
								if (cb) cb.click();
							}
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: settings?.reversePushEnabled ?? false,
							onChange: (event) => patchSwitches({ reversePushEnabled: event.target.checked })
						}), "反向推送（切歌写入会话动态）"]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dshm-set-title",
						children: "提示音"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshm-alarm-form",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								title: soundInfo?.exists ? "通知时播放你上传的音频" : "通知时播放内置「叮咚」双音",
								children: soundInfo?.exists ? `自定义 ${String(soundInfo.ext).toUpperCase()}（${Math.round((soundInfo.bytes ?? 0) / 1024)}KB）` : "内置双音"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dshm-mini",
								onClick: () => soundFileRef.current?.click(),
								children: "上传"
							}),
							soundInfo?.exists && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dshm-mini",
								onClick: resetSound,
								children: "恢复默认"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								ref: soundFileRef,
								type: "file",
								accept: ".mp3,.wav,.ogg,.m4a,.flac",
								className: "dshm-file-hidden",
								onChange: (event) => {
									const file = event.target.files?.[0];
									event.target.value = "";
									if (file) uploadSound(file);
								}
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dshm-set-title",
						children: "音乐源"
					}),
					providers.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dshm-note",
						children: "暂无可用音源"
					}) : providers.map((p) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "dshm-check-row",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: p.enabled,
								onChange: (event) => {
									const on = event.target.checked;
									api.toggleProvider(p.id, on).then(({ enabled }) => setProviders((prev) => prev.map((it) => it.id === p.id ? {
										...it,
										enabled
									} : it))).catch(noteError);
								}
							}),
							p.label,
							p.description ? `（${p.description}）` : ""
						]
					}, p.id)),
					settings?.schedulerEnabled === false ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dshm-note",
						children: "定时任务已关闭：闹钟与睡眠定时不会触发"
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dshm-set-title",
							children: ["音乐闹钟", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dshm-set-state",
								children: schedule ? `${schedule.alarms.length} 个` : ""
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dshm-alarm-form",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "dshm-num dshm-time",
									type: "time",
									value: alarmTime,
									onChange: (event) => setAlarmTime(event.target.value)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "dshm-input dshm-input-sm",
									placeholder: "到点播放的歌…",
									value: alarmKeyword,
									onChange: (event) => setAlarmKeyword(event.target.value),
									onKeyDown: (event) => {
										if (event.key === "Enter") addAlarm();
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dshm-mini",
									onClick: addAlarm,
									children: "＋添加"
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: "dshm-input dshm-input-sm",
							placeholder: "备注（可选），如 起床闹钟",
							value: alarmLabel,
							onChange: (event) => setAlarmLabel(event.target.value)
						}),
						schedule && schedule.alarms.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dshm-alarm-list",
							children: schedule.alarms.map((alarm) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dshm-alarm-row",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dshm-alarm-time",
										children: alarm.time
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dshm-alarm-kw",
										children: alarm.label || alarm.keyword
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dshm-icon",
										title: "删除闹钟",
										onClick: () => dropAlarm(alarm.id),
										children: "✕"
									})
								]
							}, alarm.id))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dshm-set-title",
							children: "睡眠定时"
						}),
						schedule && schedule.sleepRemainingSec > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dshm-note",
							children: [
								"已启动：还剩 ",
								Math.ceil(schedule.sleepRemainingSec / 60),
								" 分钟自动暂停"
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dshm-alarm-form",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "dshm-num",
									type: "number",
									min: 1,
									max: 720,
									value: sleepMinutes,
									onChange: (event) => setSleepMinutes(Number(event.target.value) || 30)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "分钟后暂停" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dshm-mini",
									onClick: startSleep,
									children: "开始"
								}),
								schedule && schedule.sleepRemainingSec > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dshm-mini",
									onClick: stopSleep,
									children: "取消"
								})
							]
						})
					] }),
					savedNote && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dshm-note dshm-note-ok",
						children: savedNote
					})
				]
			});
		}
		/** 关键词历史（localStorage 跨会话）。 */
		function readHistory() {
			try {
				const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
				return Array.isArray(raw) ? raw.filter((item) => typeof item === "string").slice(0, 8) : [];
			} catch {
				return [];
			}
		}
		function saveHistory(keyword) {
			const history = [keyword, ...readHistory().filter((item) => item !== keyword)].slice(0, 8);
			localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
			return history;
		}
		/** 快捷榜单（公开榜单，匿名可用，无需登录）。 */
		const CHART_SHORTCUTS = [
			{
				id: "3778678",
				title: "热歌榜"
			},
			{
				id: "19723756",
				title: "飙升榜"
			},
			{
				id: "3779629",
				title: "新歌榜"
			},
			{
				id: "2884035",
				title: "抖音榜"
			}
		];
		function SearchTab() {
			const [keyword, setKeyword] = (0, react.useState)("");
			const [results, setResults] = (0, react.useState)([]);
			const [busy, setBusy] = (0, react.useState)(false);
			const [mixing, setMixing] = (0, react.useState)(false);
			const [charting, setCharting] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			const [history, setHistory] = (0, react.useState)(readHistory);
			const doSearch = (0, react.useCallback)(async (kw) => {
				const text = kw.trim();
				if (!text) return;
				setBusy(true);
				setError("");
				try {
					const { tracks } = await api.search(text, 20);
					setResults(tracks);
					setHistory(saveHistory(text));
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			}, []);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
					className: "dshm-search-row",
					onSubmit: (event) => {
						event.preventDefault();
						doSearch(keyword);
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: "dshm-input",
							placeholder: "搜索歌曲 / 歌手…",
							value: keyword,
							onChange: (event) => setKeyword(event.target.value)
						}),
						keyword && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dshm-clear",
							title: "清空搜索",
							onClick: () => {
								setKeyword("");
								setResults([]);
							},
							children: "✕"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "submit",
							className: "dshm-go",
							disabled: busy,
							children: busy ? "…" : "搜"
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "dshm-lucky",
					disabled: mixing,
					title: "曲库+红心 Top30 混入随机新歌，打乱开播",
					onClick: () => {
						setMixing(true);
						startRandomMix().finally(() => setMixing(false));
					},
					children: mixing ? "正在生成…" : "🎲 随便听听"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dshm-charts",
					children: CHART_SHORTCUTS.map((chart) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dshm-chip-hist",
						disabled: charting,
						title: `播放${chart.title}（无需登录）`,
						onClick: () => {
							setCharting(true);
							startChartMix(chart.id, chart.title).finally(() => setCharting(false));
						},
						children: charting ? "…" : chart.title
					}, chart.id))
				}),
				history.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshm-history",
					children: [history.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dshm-chip-hist",
						onClick: () => {
							setKeyword(item);
							doSearch(item);
						},
						children: item
					}, item)), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dshm-chip-hist dshm-chip-clear",
						title: "清空搜索记录",
						onClick: () => {
							localStorage.removeItem(HISTORY_KEY);
							setHistory([]);
						},
						children: "清空"
					})]
				}),
				error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dshm-err",
					children: error
				}),
				results.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dshm-playall-row",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dshm-mini",
						onClick: () => playAll(results),
						children: "▶ 播放全部"
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshm-list",
					children: [results.map((track) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Row, {
						track,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dshm-icon",
							title: "加入队列",
							onClick: () => addToQueue(track),
							children: "＋"
						})
					}, track.id)), !results.length && !busy && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshm-empty",
						children: [
							"输入关键词开始搜索",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("br", {}),
							"聚合网易云 + QQ 音乐"
						]
					})]
				})
			] });
		}
		function Row({ track, children, onRemove }) {
			const active = usePlayer((s) => s.queue[s.index]?.id) === track.id;
			const fav = isFavorite(`${track.provider}:${track.songId}`);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: active ? "dshm-item dshm-item-active" : "dshm-item",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "dshm-item-main",
						onClick: () => playTrack(track),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: `dshm-badge dshm-badge-${track.provider}`,
								children: track.provider === "netease" ? "网" : track.provider === "qq" ? "Q" : "酷"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dshm-item-texts",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dshm-item-name",
									children: [track.name, track.vip && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
										className: "dshm-vip",
										children: "VIP"
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dshm-item-sub",
									children: track.artists.join(" / ")
								})]
							}),
							track.durationMs > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dshm-dur",
								children: fmt(track.durationMs / 1e3)
							})
						]
					}),
					onRemove && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dshm-icon",
						title: "从列表移除",
						onClick: onRemove,
						children: "✕"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: fav ? "dshm-heart dshm-heart-on" : "dshm-heart",
						title: "本地红心",
						onClick: () => {
							toggleFavorite(track);
						},
						children: fav ? "♥" : "♡"
					}),
					children
				]
			});
		}
		function LibraryTab() {
			const library = useLibrary();
			const [selected, setSelected] = (0, react.useState)("fav");
			const [newListName, setNewListName] = (0, react.useState)("");
			const [sections, setSections] = (0, react.useState)([]);
			const [recIdx, setRecIdx] = (0, react.useState)(0);
			const [recLoading, setRecLoading] = (0, react.useState)(true);
			const [recVisible, setRecVisible] = (0, react.useState)(true);
			const importRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				let alive = true;
				api.recommend().then((data) => {
					if (!alive) return;
					setSections(data.sections);
					setRecLoading(false);
				}).catch(() => {
					if (alive) setRecLoading(false);
				});
				return () => {
					alive = false;
				};
			}, []);
			(0, react.useEffect)(() => {
				loadLibrary();
			}, []);
			const selectedList = library.lists.find((list) => list.id === selected);
			const recSection = sections[recIdx];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshm-sec-head",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dshm-sec-title",
						children: recLoading ? "推荐加载中…" : "🎵 为你推荐"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dshm-mini",
						onClick: () => setRecVisible((value) => !value),
						children: recVisible ? "收起" : "展开"
					})]
				}),
				recVisible && !recLoading && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dshm-libchips",
					children: sections.map((section, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: i === recIdx ? "dshm-chip-hist dshm-chip-on" : "dshm-chip-hist",
						title: section.source === "netease-daily" ? "基于你的网易云口味" : "官方榜单（按日期轮换）",
						onClick: () => setRecIdx(i),
						children: section.title
					}, section.source))
				}), recSection && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dshm-playall-row",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dshm-mini",
						onClick: () => playAll(recSection.tracks),
						children: "▶ 播放全部"
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dshm-list",
					children: recSection.tracks.slice(0, 10).map((track) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Row, { track }, track.id))
				})] })] }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshm-sec-head",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dshm-sec-title",
							children: "我的列表"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dshm-mini",
							title: "导出全部列表为 JSON 备份",
							onClick: () => exportLibrary(library.lists),
							children: "导出"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dshm-mini",
							title: "从 JSON 备份导入列表",
							onClick: () => importRef.current?.click(),
							children: "导入"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							ref: importRef,
							type: "file",
							accept: "application/json,.json",
							className: "dshm-file-hidden",
							onChange: (event) => {
								const file = event.target.files?.[0];
								event.target.value = "";
								if (file) importLibraryFile(file);
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
							className: "dshm-newlist",
							onSubmit: (event) => {
								event.preventDefault();
								const name = newListName.trim();
								if (!name) return;
								createCustomList(name).then(() => setNewListName(""));
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "dshm-input dshm-input-sm",
								placeholder: "新列表名…",
								value: newListName,
								onChange: (event) => setNewListName(event.target.value)
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "submit",
								className: "dshm-mini",
								children: "＋"
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshm-libchips",
					children: [library.lists.map((list) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: selected === list.id ? "dshm-chip-hist dshm-chip-on" : "dshm-chip-hist",
						onClick: () => setSelected(list.id),
						children: [
							list.kind === "favorites" ? "♥ " : "",
							list.name,
							" (",
							list.tracks.length,
							")"
						]
					}, list.id)), library.recent.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: selected === "recent" ? "dshm-chip-hist dshm-chip-on" : "dshm-chip-hist",
						onClick: () => setSelected("recent"),
						children: [
							"🕘 最近播放 (",
							library.recent.length,
							")"
						]
					})]
				}),
				selected === "recent" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [library.recent.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dshm-playall-row",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dshm-mini",
						onClick: () => playAll(library.recent),
						children: "▶ 播放全部"
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshm-list",
					children: [library.recent.map((track) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Row, { track }, `${track.provider}:${track.songId}`)), !library.recent.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dshm-empty",
						children: "还没有播放记录"
					})]
				})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [selectedList && selectedList.tracks.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshm-playall-row",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dshm-mini",
						onClick: () => playAll(selectedList.tracks),
						children: "▶ 播放全部"
					}), selectedList.kind !== "favorites" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dshm-mini",
						onClick: () => {
							deleteCustomList(selectedList.id);
							setSelected("fav");
						},
						children: "删除列表"
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshm-list",
					children: [(selectedList?.tracks ?? []).map((track) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Row, {
						track,
						onRemove: () => {
							removeFromList(selectedList.id, track);
						}
					}, `${track.provider}:${track.songId}`)), selectedList && !selectedList.tracks.length && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshm-empty",
						children: [
							"列表为空",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("br", {}),
							"在搜索或推荐里点 ♡ 收藏到这里"
						]
					})]
				})] })
			] });
		}
		function QueueTab() {
			const queue = usePlayer((s) => s.queue);
			usePlayer((s) => s.index);
			if (!queue.length) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dshm-empty",
				children: "队列为空"
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dshm-playall-row",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "dshm-mini",
					onClick: clearQueue,
					children: "清空队列"
				})
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dshm-list",
				children: queue.map((track, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Row, {
					track,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dshm-icon",
						title: "移除",
						onClick: () => removeFromQueue(i),
						children: "✕"
					})
				}, `${track.id}:${i}`))
			})] });
		}
		function AuthTab() {
			const [items, setItems] = (0, react.useState)([]);
			const [qqCookieText, setQqCookieText] = (0, react.useState)("");
			const [note, setNote] = (0, react.useState)("");
			const qrLogin = useQrLogin();
			const qqQr = useQqQrLogin();
			const refresh = (0, react.useCallback)(() => {
				api.authStatus().then(({ providers }) => setItems(providers)).catch((err) => {
					console.error("[AuthTab] authStatus failed:", err);
					setItems([]);
				});
			}, []);
			(0, react.useEffect)(refresh, [refresh]);
			(0, react.useEffect)(() => {
				if (qrLogin.phase === "success" || qqQr.phase === "success") {
					refresh();
					setNote("");
				}
			}, [
				qrLogin.phase,
				qqQr.phase,
				refresh
			]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dshm-auth",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshm-auth-block",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dshm-auth-name",
							children: ["网易云音乐", /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusChip, { item: items.find((i) => i.provider === "netease") })]
						}), qrLogin.phase === "idle" || qrLogin.phase === "given-up" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dshm-btn",
							onClick: startQrLogin,
							children: "扫码登录"
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dshm-qr",
							children: [qrLogin.img && qrLogin.phase !== "success" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
								src: qrLogin.img,
								alt: "网易云登录二维码",
								width: 148,
								height: 148
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dshm-note",
								children: [
									qrLogin.phase === "waiting" && "请用网易云音乐 App 扫码",
									qrLogin.phase === "scanned" && "已扫码，请在手机上确认",
									qrLogin.phase === "starting" && "正在获取二维码…",
									qrLogin.phase === "success" && (qrLogin.verified === false ? qrLogin.note ?? "登录成功" : `登录成功：${qrLogin.nickname ?? ""}`),
									qrLogin.phase === "success" && qrLogin.verified === false && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("br", {}), "账号页「Cookie 粘贴」可完成登录"] }),
									qrLogin.note && qrLogin.verified !== false && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("br", {}), qrLogin.note] })
								]
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshm-auth-block",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dshm-auth-name",
								children: ["QQ 音乐", /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusChip, { item: items.find((i) => i.provider === "qq") })]
							}),
							qqQr.phase === "idle" || qqQr.phase === "given-up" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dshm-btn",
								onClick: startQqQrLogin,
								title: "实验性功能：依赖腾讯 ptlogin 接口，随时可能失效；建议改用下方 Cookie 粘贴",
								children: "扫码登录（实验性）"
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dshm-qr",
								children: [qqQr.img && qqQr.phase !== "success" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
									src: qqQr.img,
									alt: "QQ 登录二维码",
									width: 148,
									height: 148
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dshm-note",
									children: [
										(qqQr.phase === "waiting" || qqQr.phase === "scanned") && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
											qqQr.phase === "waiting" && "请用手机 QQ 扫一扫",
											qqQr.phase === "scanned" && "已扫码，请在手机上确认",
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("br", {}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: {
													fontSize: "11px",
													opacity: .7
												},
												children: "实验性功能，易失效；推荐用下方 Cookie 粘贴"
											})
										] }),
										qqQr.phase === "starting" && "正在获取二维码…",
										qqQr.phase === "success" && (qqQr.note ?? "登录成功"),
										qqQr.phase === "error" && (qqQr.note ?? "扫码失败"),
										qqQr.note && qqQr.phase !== "success" && qqQr.phase !== "waiting" && qqQr.phase !== "scanned" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("br", {}), qqQr.note] })
									]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								className: "dshm-textarea",
								rows: 3,
								placeholder: "粘贴 y.qq.com 的 Cookie（需含 uin= 与 qm_keyst=）",
								value: qqCookieText,
								onChange: (event) => setQqCookieText(event.target.value)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dshm-btn",
								onClick: () => {
									api.qqCookieSave(qqCookieText.trim()).then(() => {
										setNote("QQ Cookie 已保存");
										setQqCookieText("");
										refresh();
									}).catch((cause) => setNote(cause instanceof Error ? cause.message : String(cause)));
								},
								children: "保存 Cookie"
							})
						]
					}),
					note && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dshm-note",
						children: note
					})
				]
			});
		}
		function StatusChip({ item }) {
			if (!item) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
				className: "dshm-chip",
				children: "检测中"
			});
			return item.loggedIn ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("i", {
				className: "dshm-chip dshm-chip-ok",
				children: [item.nickname ?? "已登录", item.vipLabel && item.vipLabel !== "无VIP" ? `·${item.vipLabel}` : ""]
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
				className: "dshm-chip",
				children: "未登录"
			});
		}
		function NowPlaying() {
			const index = usePlayer((s) => s.index);
			const queue = usePlayer((s) => s.queue);
			const playing = usePlayer((s) => s.playing);
			const currentTime = usePlayer((s) => s.currentTime);
			const duration = usePlayer((s) => s.duration);
			const loadingUrl = usePlayer((s) => s.loadingUrl);
			const error = usePlayer((s) => s.error);
			const note = usePlayer((s) => s.note);
			const volume = usePlayer((s) => s.volume);
			const mode = usePlayer((s) => s.mode);
			const showLyric = usePlayer((s) => s.showLyric);
			const lyricCurrent = usePlayer((s) => {
				if (!s.showLyric) return "";
				const lines = currentLyricLines();
				const time = s.currentTime;
				let text = "";
				for (const line of lines) if (line.t <= time) text = line.text;
				else break;
				return text;
			});
			const track = queue[index];
			if (!track) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dshm-now",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshm-now-top",
						children: [
							track.cover ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
								className: "dshm-cover",
								src: track.cover,
								alt: "",
								width: 40,
								height: 40
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dshm-cover dshm-cover-empty",
								children: "♫"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dshm-now-meta",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dshm-now-name",
									children: track.name
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dshm-now-sub",
									children: lyricCurrent || track.artists.join(" / ")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: showLyric ? "dshm-lyrbtn dshm-lyrbtn-on" : "dshm-lyrbtn",
								title: `界面歌词：${showLyric ? "开" : "关"}（不影响音箱同步）`,
								onClick: toggleShowLyric,
								children: "词"
							}),
							loadingUrl && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dshm-spin",
								children: "◌"
							})
						]
					}),
					showLyric && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Karaoke, {}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						className: "dshm-range",
						type: "range",
						min: 0,
						max: Math.max(duration, 1),
						step: .5,
						value: Math.min(currentTime, duration || 0),
						onChange: (event) => seek(Number(event.target.value))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshm-times",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: fmt(currentTime) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: fmt(duration) })]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dshm-err",
						children: error
					}),
					!error && note && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dshm-note dshm-note-ok",
						children: note
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshm-controls",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dshm-icon",
								onClick: cycleMode,
								title: "播放模式",
								children: MODE_LABEL[mode]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dshm-icon",
								onClick: prev,
								children: "⏮"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dshm-playbtn",
								onClick: toggle,
								children: playing ? "⏸" : "▶"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dshm-icon",
								onClick: next,
								children: "⏭"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "dshm-range dshm-vol",
								type: "range",
								min: 0,
								max: 1,
								step: .05,
								value: volume,
								title: `音量 ${Math.round(volume * 100)}%`,
								onChange: (event) => setVolume(Number(event.target.value))
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.tsx
		/**
		* 单身汉（DSH）播放器 —— 浏览器半。
		* 挂载全局悬浮播放器（宿主全局，跨会话存活，与 dsh-pet 同款挂载策略）。
		* @module dsh-music-huazai/client
		*/
		/** 浏览器半依赖的服务。 */
		const inject = [];
		function App() {
			const [open, setOpen] = (0, react.useState)(false);
			const [fabPos, setFabPos] = (0, react.useState)(readFabPos);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Fab, {
				open,
				onClick: () => setOpen((value) => !value),
				onMove: setFabPos
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Surface, {
				open,
				onClose: () => setOpen(false),
				anchor: fabPos
			})] });
		}
		/** 页面级单例守卫（HMR / 重复激活时防重复挂载）。 */
		const MOUNT_FLAG = "__dshMusicHuazaiMounted";
		function apply(ctx) {
			const globalFlags = globalThis;
			if (globalFlags[MOUNT_FLAG] === true) return;
			globalFlags[MOUNT_FLAG] = true;
			const container = document.createElement("div");
			container.dataset.dshPlugin = "dsh-music-huazai";
			document.body.appendChild(container);
			startAiBridge();
			const root = (0, react_dom_client.createRoot)(container);
			root.render(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(App, {}));
			ctx.effect(() => () => {
				root.unmount();
				container.remove();
				globalFlags[MOUNT_FLAG] = false;
			}, "music: surface");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map