/**
 * 播放器面板 —— 搜索 / 曲库 / 队列 / 账号 四 Tab + 底部正在播放控制条。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.ts'
import { Karaoke } from './Karaoke.tsx'
import { startQrLogin, useQrLogin } from './qrLogin.ts'
import {
  addToQueue,
  clearQueue,
  cycleMode,
  currentLyricLines,
  getPlayerState,
  getQualityPref,
  next,
  playAll,
  playTrack,
  prev,
  removeFromQueue,
  seek,
  setQualityPref,
  setVolume,
  startRandomMix,
  toggle,
  toggleShowLyric,
  usePlayer,
} from './player.ts'
import {
  createCustomList,
  deleteCustomList,
  exportLibrary,
  importLibraryFile,
  isFavorite,
  loadLibrary,
  removeFromList,
  toggleFavorite,
  useLibrary,
} from './library.ts'
import type { Track } from '../providers/types.ts'
import { CSS } from './styles.ts'

const REPO_URL = 'https://github.com/nxz1026/SinglePlayer'

const MODE_LABEL: Record<string, string> = { order: '顺序', repeat: '循环', one: '单曲', random: '随机' }

const QUALITY_LABEL: Record<string, string> = {
  standard: '标准 128k',
  exhigh: '较高 320k',
  lossless: '无损 FLAC',
  hires: 'Hi-Res',
}

const HISTORY_KEY = 'dshm-search-history'

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
export function Surface({ open, onClose }: { open: boolean; onClose: () => void }): React.ReactElement | null {
  const [tab, setTab] = useState<'search' | 'library' | 'queue' | 'auth' | 'settings'>('search')
  if (!open) return null
  return (
    <div className="dshm-panel">
      <style>{CSS}</style>
      <div className="dshm-head">
        <span className="dshm-logo">♪</span>
        <span className="dshm-title">单身汉播放器</span>
        <a className="dshm-gh" href={REPO_URL} target="_blank" rel="noreferrer" title="GitHub 仓库" aria-label="GitHub 仓库">
          <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
        </a>
        <button
          type="button"
          className={tab === 'settings' ? 'dshm-x dshm-gear-on' : 'dshm-x'}
          title="设置"
          aria-label="设置"
          onClick={() => setTab(value => (value === 'settings' ? 'search' : 'settings'))}
        >⚙</button>
        <button type="button" className="dshm-x" onClick={onClose} aria-label="关闭">×</button>
      </div>
      {tab !== 'settings' && (
        <div className="dshm-tabs">
          <button type="button" className={tab === 'search' ? 'dshm-tab dshm-tab-on' : 'dshm-tab'} onClick={() => setTab('search')}>搜索</button>
          <button type="button" className={tab === 'library' ? 'dshm-tab dshm-tab-on' : 'dshm-tab'} onClick={() => setTab('library')}>曲库</button>
          <button type="button" className={tab === 'queue' ? 'dshm-tab dshm-tab-on' : 'dshm-tab'} onClick={() => setTab('queue')}>
            队列{getPlayerState().queue.length > 0 ? `(${getPlayerState().queue.length})` : ''}
          </button>
          <button type="button" className={tab === 'auth' ? 'dshm-tab dshm-tab-on' : 'dshm-tab'} onClick={() => setTab('auth')}>账号</button>
        </div>
      )}
      <div className="dshm-body">
        {tab === 'search' && <SearchTab />}
        {tab === 'library' && <LibraryTab />}
        {tab === 'queue' && <QueueTab />}
        {tab === 'auth' && <AuthTab />}
        {tab === 'settings' && <SettingsView />}
      </div>
      <NowPlaying />
    </div>
  )
}

// ---------------------------------------------------------------- 设置

function SettingsView(): React.ReactElement {
  const [quality, setQuality] = useState(getQualityPref())
  const [halo, setHalo] = useState<import('./api.ts').HaloStatus | null>(null)
  const [savedNote, setSavedNote] = useState('')

  useEffect(() => {
    void api.haloStatus().then(({ halo }) => setHalo(halo)).catch(() => {})
  }, [])

  const patchHalo = useCallback((patch: Record<string, unknown>) => {
    void api.haloSetConfig(patch).then(({ config }) => {
      setHalo(previous => previous ? { ...previous, config: config as import('./api.ts').HaloStatus['config'] } : previous)
      setSavedNote('已保存')
      window.setTimeout(() => setSavedNote(''), 1500)
    }).catch(cause => setSavedNote(cause instanceof Error ? cause.message : String(cause)))
  }, [])

  const config = halo?.config

  return (
    <div className="dshm-settings">
      <div className="dshm-set-title">音质偏好</div>
      <select
        className="dshm-select"
        value={quality}
        onChange={event => {
          setQuality(event.target.value)
          setQualityPref(event.target.value)
          setSavedNote('下次播放生效')
          window.setTimeout(() => setSavedNote(''), 1500)
        }}
      >
        {Object.entries(QUALITY_LABEL).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>

      <div className="dshm-set-title">
        花再音箱（HALO PixelBar）
        <span className="dshm-set-state">{halo ? (halo.connected ? '已连接' : '未连接') : ''}</span>
      </div>
      <label className="dshm-check-row">
        <input
          type="checkbox"
          checked={halo?.enabled ?? false}
          disabled={!halo}
          onChange={event => patchHalo({ enabled: event.target.checked })}
        />
        启用歌词同步
      </label>
      <label className="dshm-check-row">
        <input
          type="checkbox"
          checked={config?.dynamicScroll ?? false}
          disabled={!halo}
          onChange={event => patchHalo({ dynamicScroll: event.target.checked })}
        />
        动态滚动歌词（长句右→左）
      </label>
      <label className="dshm-check-row">
        <input
          type="checkbox"
          checked={config?.idleClockWhenPaused ?? true}
          disabled={!halo}
          onChange={event => patchHalo({ idleClockWhenPaused: event.target.checked })}
        />
        暂停时显示时钟
      </label>
      <label className="dshm-set-row">
        歌词对齐
        <select
          className="dshm-select"
          value={config?.align ?? 'center'}
          disabled={!halo}
          onChange={event => patchHalo({ align: event.target.value })}
        >
          <option value="left">左</option>
          <option value="center">中</option>
          <option value="right">右</option>
        </select>
      </label>
      <label className="dshm-set-row">
        每行字数
        <input
          className="dshm-num"
          type="number"
          min={10}
          max={40}
          value={config?.maxCharsPerLine ?? 32}
          disabled={!halo}
          onChange={event => patchHalo({ maxCharsPerLine: Number(event.target.value) || 32 })}
        />
      </label>
      {savedNote && <div className="dshm-note dshm-note-ok">{savedNote}</div>}
    </div>
  )
}

// ---------------------------------------------------------------- 搜索

function readHistory(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter(item => typeof item === 'string').slice(0, 8) : []
  } catch {
    return []
  }
}

function saveHistory(keyword: string): string[] {
  const history = [keyword, ...readHistory().filter(item => item !== keyword)].slice(0, 8)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  return history
}

function SearchTab(): React.ReactElement {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<Track[]>([])
  const [busy, setBusy] = useState(false)
  const [mixing, setMixing] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<string[]>(readHistory)

  const doSearch = useCallback(async (kw: string) => {
    const text = kw.trim()
    if (!text) return
    setBusy(true)
    setError('')
    try {
      const { tracks } = await api.search(text, 20)
      setResults(tracks)
      setHistory(saveHistory(text))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <>
      <form
        className="dshm-search-row"
        onSubmit={event => { event.preventDefault(); void doSearch(keyword) }}
      >
        <input
          className="dshm-input"
          placeholder="搜索歌曲 / 歌手…"
          value={keyword}
          onChange={event => setKeyword(event.target.value)}
        />
        <button type="submit" className="dshm-go" disabled={busy}>{busy ? '…' : '搜'}</button>
      </form>
      <button
        type="button"
        className="dshm-lucky"
        disabled={mixing}
        title="曲库+红心 Top30 混入随机新歌，打乱开播"
        onClick={() => {
          setMixing(true)
          void startRandomMix().finally(() => setMixing(false))
        }}
      >{mixing ? '正在生成…' : '🎲 随便听听'}</button>
      {history.length > 0 && (
        <div className="dshm-history">
          {history.map(item => (
            <button
              key={item}
              type="button"
              className="dshm-chip-hist"
              onClick={() => { setKeyword(item); void doSearch(item) }}
            >{item}</button>
          ))}
          <button
            type="button"
            className="dshm-chip-hist dshm-chip-clear"
            title="清空搜索记录"
            onClick={() => { localStorage.removeItem(HISTORY_KEY); setHistory([]) }}
          >清空</button>
        </div>
      )}
      {error && <div className="dshm-err">{error}</div>}
      {results.length > 0 && (
        <div className="dshm-playall-row">
          <button type="button" className="dshm-mini" onClick={() => playAll(results)}>▶ 播放全部</button>
        </div>
      )}
      <div className="dshm-list">
        {results.map(track => (
          <Row key={track.id} track={track}>
            <button type="button" className="dshm-icon" title="加入队列"
              onClick={() => addToQueue(track)}>＋</button>
          </Row>
        ))}
        {!results.length && !busy && (
          <div className="dshm-empty">输入关键词开始搜索<br />聚合网易云 + QQ 音乐</div>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------- 行

function Row({ track, children, onRemove }: {
  track: Track
  children?: React.ReactNode
  /** 提供时显示「从列表移除」按钮（曲库自定义列表用）。 */
  onRemove?: () => void
}): React.ReactElement {
  const currentId = usePlayer(s => s.queue[s.index]?.id)
  const active = currentId === track.id
  const favKey = `${track.provider}:${track.songId}`
  const fav = isFavorite(favKey)
  return (
    <div className={active ? 'dshm-item dshm-item-active' : 'dshm-item'}>
      <button type="button" className="dshm-item-main" onClick={() => playTrack(track)}>
        <span className={`dshm-badge dshm-badge-${track.provider}`}>
          {track.provider === 'netease' ? '网' : 'Q'}
        </span>
        <span className="dshm-item-texts">
          <span className="dshm-item-name">
            {track.name}
            {track.vip && <i className="dshm-vip">VIP</i>}
          </span>
          <span className="dshm-item-sub">{track.artists.join(' / ')}</span>
        </span>
        {track.durationMs > 0 && <span className="dshm-dur">{fmt(track.durationMs / 1000)}</span>}
      </button>
      {onRemove && (
        <button type="button" className="dshm-icon" title="从列表移除" onClick={onRemove}>✕</button>
      )}
      <button
        type="button"
        className={fav ? 'dshm-heart dshm-heart-on' : 'dshm-heart'}
        title="本地红心"
        onClick={() => { void toggleFavorite(track) }}
      >{fav ? '♥' : '♡'}</button>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------- 曲库（推荐 + 多列表）

interface RecommendSection {
  source: string
  title: string
  tracks: Track[]
}

function LibraryTab(): React.ReactElement {
  const library = useLibrary()
  const [selected, setSelected] = useState('fav')
  const [newListName, setNewListName] = useState('')
  const [sections, setSections] = useState<RecommendSection[]>([])
  const [recIdx, setRecIdx] = useState(0)
  const [recLoading, setRecLoading] = useState(true)
  const [recVisible, setRecVisible] = useState(true)
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    api.recommend().then(data => {
      if (!alive) return
      setSections(data.sections)
      setRecLoading(false)
    }).catch(() => {
      if (alive) setRecLoading(false)
    })
    return () => { alive = false }
  }, [])

  // 首次进入曲库时刷新一次列表数据
  useEffect(() => { void loadLibrary() }, [])

  const selectedList = library.lists.find(list => list.id === selected)
  const recSection = sections[recIdx]

  return (
    <>
      {/* ---- 推荐区（每日推荐 + 随机轮换榜单）---- */}
      <div className="dshm-sec-head">
        <span className="dshm-sec-title">{recLoading ? '推荐加载中…' : '🎵 为你推荐'}</span>
        <button type="button" className="dshm-mini" onClick={() => setRecVisible(value => !value)}>
          {recVisible ? '收起' : '展开'}
        </button>
      </div>
      {recVisible && !recLoading && (
        <>
          <div className="dshm-libchips">
            {sections.map((section, i) => (
              <button
                key={section.source}
                type="button"
                className={i === recIdx ? 'dshm-chip-hist dshm-chip-on' : 'dshm-chip-hist'}
                title={section.source === 'netease-daily' ? '基于你的网易云口味' : '官方榜单（按日期轮换）'}
                onClick={() => setRecIdx(i)}
              >{section.title}</button>
            ))}
          </div>
          {recSection && (
            <>
              <div className="dshm-playall-row">
                <button type="button" className="dshm-mini" onClick={() => playAll(recSection.tracks)}>▶ 播放全部</button>
              </div>
              <div className="dshm-list">
                {recSection.tracks.slice(0, 10).map(track => <Row key={track.id} track={track} />)}
              </div>
            </>
          )}
        </>
      )}

      {/* ---- 列表选择器 ---- */}
      <div className="dshm-sec-head">
        <span className="dshm-sec-title">我的列表</span>
        <button type="button" className="dshm-mini" title="导出全部列表为 JSON 备份"
          onClick={() => exportLibrary(library.lists)}>导出</button>
        <button type="button" className="dshm-mini" title="从 JSON 备份导入列表"
          onClick={() => importRef.current?.click()}>导入</button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="dshm-file-hidden"
          onChange={event => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void importLibraryFile(file)
          }}
        />
        <form
          className="dshm-newlist"
          onSubmit={event => {
            event.preventDefault()
            const name = newListName.trim()
            if (!name) return
            void createCustomList(name).then(() => setNewListName(''))
          }}
        >
          <input
            className="dshm-input dshm-input-sm"
            placeholder="新列表名…"
            value={newListName}
            onChange={event => setNewListName(event.target.value)}
          />
          <button type="submit" className="dshm-mini">＋</button>
        </form>
      </div>
      <div className="dshm-libchips">
        {library.lists.map(list => (
          <button
            key={list.id}
            type="button"
            className={selected === list.id ? 'dshm-chip-hist dshm-chip-on' : 'dshm-chip-hist'}
            onClick={() => setSelected(list.id)}
          >
            {list.kind === 'favorites' ? '♥ ' : ''}{list.name} ({list.tracks.length})
          </button>
        ))}
        {library.recent.length > 0 && (
          <button
            type="button"
            className={selected === 'recent' ? 'dshm-chip-hist dshm-chip-on' : 'dshm-chip-hist'}
            onClick={() => setSelected('recent')}
          >🕘 最近播放 ({library.recent.length})</button>
        )}
      </div>

      {/* ---- 选中列表的曲目 ---- */}
      {selected === 'recent'
        ? (
            <>
              {library.recent.length > 0 && (
                <div className="dshm-playall-row">
                  <button type="button" className="dshm-mini" onClick={() => playAll(library.recent)}>▶ 播放全部</button>
                </div>
              )}
              <div className="dshm-list">
                {library.recent.map(track => <Row key={`${track.provider}:${track.songId}`} track={track} />)}
                {!library.recent.length && <div className="dshm-empty">还没有播放记录</div>}
              </div>
            </>
          )
        : (
            <>
              {selectedList && selectedList.tracks.length > 0 && (
                <div className="dshm-playall-row">
                  <button type="button" className="dshm-mini" onClick={() => playAll(selectedList.tracks)}>▶ 播放全部</button>
                  {selectedList.kind !== 'favorites' && (
                    <button
                      type="button"
                      className="dshm-mini"
                      onClick={() => { void deleteCustomList(selectedList.id); setSelected('fav') }}
                    >删除列表</button>
                  )}
                </div>
              )}
              <div className="dshm-list">
                {(selectedList?.tracks ?? []).map(track => (
                  <Row
                    key={`${track.provider}:${track.songId}`}
                    track={track}
                    onRemove={() => { void removeFromList(selectedList!.id, track) }}
                  />
                ))}
                {selectedList && !selectedList.tracks.length && (
                  <div className="dshm-empty">列表为空<br />在搜索或推荐里点 ♡ 收藏到这里</div>
                )}
              </div>
            </>
          )}
    </>
  )
}

// ---------------------------------------------------------------- 队列

function QueueTab(): React.ReactElement {
  const queue = usePlayer(s => s.queue)
  const index = usePlayer(s => s.index)
  if (!queue.length) return <div className="dshm-empty">队列为空</div>
  return (
    <>
      <div className="dshm-playall-row">
        <button type="button" className="dshm-mini" onClick={clearQueue}>清空队列</button>
      </div>
      <div className="dshm-list">
        {queue.map((track, i) => (
          <Row key={`${track.id}:${i}`} track={track}>
            <button type="button" className="dshm-icon" title="移除"
              onClick={() => removeFromQueue(i)}>✕</button>
          </Row>
        ))}
      </div>
    </>
  )
}

// ---------------------------------------------------------------- 账号

interface AuthItem {
  provider: string
  loggedIn: boolean
  nickname?: string
  vipLabel?: string
}

function AuthTab(): React.ReactElement {
  const [items, setItems] = useState<AuthItem[]>([])
  const [qqCookieText, setQqCookieText] = useState('')
  const [note, setNote] = useState('')
  const qrLogin = useQrLogin()

  const refresh = useCallback(() => {
    void api.authStatus().then(({ providers }) => setItems(providers)).catch(() => {})
  }, [])

  useEffect(refresh, [refresh])

  // 登录成功后刷新账号状态
  useEffect(() => {
    if (qrLogin.phase === 'success') {
      refresh()
      setNote('')
    }
  }, [qrLogin.phase, refresh])

  return (
    <div className="dshm-auth">
      <div className="dshm-auth-block">
        <div className="dshm-auth-name">
          网易云音乐
          <StatusChip item={items.find(i => i.provider === 'netease')} />
        </div>
        {qrLogin.phase === 'idle' || qrLogin.phase === 'given-up'
          ? (
              <button type="button" className="dshm-btn" onClick={startQrLogin}>扫码登录</button>
            )
          : (
              <div className="dshm-qr">
                {qrLogin.img && <img src={qrLogin.img} alt="网易云登录二维码" width={148} height={148} />}
                <div className="dshm-note">
                  {qrLogin.phase === 'waiting' && '请用网易云音乐 App 扫码'}
                  {qrLogin.phase === 'scanned' && '已扫码，请在手机上确认'}
                  {qrLogin.phase === 'starting' && '正在获取二维码…'}
                  {qrLogin.phase === 'success' && `登录成功：${qrLogin.nickname ?? ''}`}
                  {qrLogin.note && <><br />{qrLogin.note}</>}
                </div>
              </div>
            )}
      </div>
      <div className="dshm-auth-block">
        <div className="dshm-auth-name">
          QQ 音乐
          <StatusChip item={items.find(i => i.provider === 'qq')} />
        </div>
        <textarea
          className="dshm-textarea"
          rows={3}
          placeholder="粘贴 y.qq.com 的 Cookie（需含 uin= 与 qm_keyst=）"
          value={qqCookieText}
          onChange={event => setQqCookieText(event.target.value)}
        />
        <button type="button" className="dshm-btn" onClick={() => {
          void api.qqCookieSave(qqCookieText.trim()).then(() => {
            setNote('QQ Cookie 已保存')
            setQqCookieText('')
            refresh()
          }).catch(cause => setNote(cause instanceof Error ? cause.message : String(cause)))
        }}>保存 Cookie</button>
      </div>
      {note && <div className="dshm-note">{note}</div>}
    </div>
  )
}

function StatusChip({ item }: { item?: AuthItem }): React.ReactElement {
  if (!item) return <i className="dshm-chip">检测中</i>
  return item.loggedIn
    ? <i className="dshm-chip dshm-chip-ok">{item.nickname ?? '已登录'}{item.vipLabel && item.vipLabel !== '无VIP' ? `·${item.vipLabel}` : ''}</i>
    : <i className="dshm-chip">未登录</i>
}

// ---------------------------------------------------------------- 正在播放

function NowPlaying(): React.ReactElement | null {
  const index = usePlayer(s => s.index)
  const queue = usePlayer(s => s.queue)
  const playing = usePlayer(s => s.playing)
  const currentTime = usePlayer(s => s.currentTime)
  const duration = usePlayer(s => s.duration)
  const loadingUrl = usePlayer(s => s.loadingUrl)
  const error = usePlayer(s => s.error)
  const note = usePlayer(s => s.note)
  const volume = usePlayer(s => s.volume)
  const mode = usePlayer(s => s.mode)
  const showLyric = usePlayer(s => s.showLyric)
  const lyricCurrent = usePlayer(s => {
    if (!s.showLyric) return ''
    const lines = currentLyricLines()
    const time = s.currentTime
    let text = ''
    for (const line of lines) {
      if (line.t <= time) text = line.text
      else break
    }
    return text
  })
  const track = queue[index]
  if (!track) return null

  return (
    <div className="dshm-now">
      <div className="dshm-now-top">
        {track.cover
          ? <img className="dshm-cover" src={track.cover} alt="" width={40} height={40} />
          : <div className="dshm-cover dshm-cover-empty">♫</div>}
        <div className="dshm-now-meta">
          <div className="dshm-now-name">{track.name}</div>
          <div className="dshm-now-sub">{lyricCurrent || track.artists.join(' / ')}</div>
        </div>
        <button
          type="button"
          className={showLyric ? 'dshm-lyrbtn dshm-lyrbtn-on' : 'dshm-lyrbtn'}
          title={`界面歌词：${showLyric ? '开' : '关'}（不影响音箱同步）`}
          onClick={toggleShowLyric}
        >词</button>
        {loadingUrl && <span className="dshm-spin">◌</span>}
      </div>
      {showLyric && <Karaoke />}
      <input
        className="dshm-range"
        type="range"
        min={0}
        max={Math.max(duration, 1)}
        step={0.5}
        value={Math.min(currentTime, duration || 0)}
        onChange={event => seek(Number(event.target.value))}
      />
      <div className="dshm-times"><span>{fmt(currentTime)}</span><span>{fmt(duration)}</span></div>
      {error && <div className="dshm-err">{error}</div>}
      {!error && note && <div className="dshm-note dshm-note-ok">{note}</div>}
      <div className="dshm-controls">
        <button type="button" className="dshm-icon" onClick={cycleMode} title="播放模式">{MODE_LABEL[mode]}</button>
        <button type="button" className="dshm-icon" onClick={prev}>⏮</button>
        <button type="button" className="dshm-playbtn" onClick={toggle}>{playing ? '⏸' : '▶'}</button>
        <button type="button" className="dshm-icon" onClick={next}>⏭</button>
        <input
          className="dshm-range dshm-vol"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          title={`音量 ${Math.round(volume * 100)}%`}
          onChange={event => setVolume(Number(event.target.value))}
        />
      </div>
    </div>
  )
}


