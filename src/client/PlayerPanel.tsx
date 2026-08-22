/**
 * 播放器面板 —— 搜索 / 队列 / 登录 三 Tab + 底部正在播放控制条。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.ts'
import { Karaoke } from './Karaoke.tsx'
import {
  addToQueue,
  clearQueue,
  cycleMode,
  currentLyricLines,
  currentTrack,
  getPlayerState,
  next,
  playAll,
  playTrack,
  prev,
  removeFromQueue,
  seek,
  setVolume,
  toggle,
  usePlayer,
} from './player.ts'
import type { Track } from '../providers/types.ts'

const MODE_LABEL: Record<string, string> = { order: '顺序', repeat: '列表循环', one: '单曲循环' }

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function Surface({ open, onClose }: { open: boolean; onClose: () => void }): React.ReactElement | null {  const [tab, setTab] = useState<'search' | 'queue' | 'auth'>('search')
  if (!open) return null
  return (
    <div className="dshm-panel">
      <style>{CSS}</style>
      <div className="dshm-head">
        <span className="dshm-logo">♪</span>
        <span className="dshm-title">单身汉播放器</span>
        <button type="button" className="dshm-x" onClick={onClose} aria-label="关闭">×</button>
      </div>
      <div className="dshm-tabs">
        <button type="button" className={tab === 'search' ? 'dshm-tab dshm-tab-on' : 'dshm-tab'} onClick={() => setTab('search')}>搜索</button>
        <button type="button" className={tab === 'queue' ? 'dshm-tab dshm-tab-on' : 'dshm-tab'} onClick={() => setTab('queue')}>
          队列{getPlayerState().queue.length > 0 ? `(${getPlayerState().queue.length})` : ''}
        </button>
        <button type="button" className={tab === 'auth' ? 'dshm-tab dshm-tab-on' : 'dshm-tab'} onClick={() => setTab('auth')}>账号</button>
      </div>
      <div className="dshm-body">
        {tab === 'search' && <SearchTab />}
        {tab === 'queue' && <QueueTab />}
        {tab === 'auth' && <AuthTab />}
      </div>
      <NowPlaying />
    </div>
  )
}

// ---------------------------------------------------------------- 搜索

function SearchTab(): React.ReactElement {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<Track[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const doSearch = useCallback(async (kw: string) => {
    const text = kw.trim()
    if (!text) return
    setBusy(true)
    setError('')
    try {
      const { tracks } = await api.search(text, 20)
      setResults(tracks)
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
          ref={inputRef}
          className="dshm-input"
          placeholder="搜索歌曲 / 歌手…"
          value={keyword}
          onChange={event => setKeyword(event.target.value)}
        />
        <button type="submit" className="dshm-go" disabled={busy}>{busy ? '…' : '搜'}</button>
      </form>
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

function Row({ track, children }: { track: Track; children?: React.ReactNode }): React.ReactElement {
  const currentId = usePlayer(s => s.queue[s.index]?.id)
  const active = currentId === track.id
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
      {children}
    </div>
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
  const [qr, setQr] = useState<{ key: string; img: string } | null>(null)
  const [qrMessage, setQrMessage] = useState('')
  const [qqCookieText, setQqCookieText] = useState('')
  const [note, setNote] = useState('')

  const refresh = useCallback(() => {
    void api.authStatus().then(({ providers }) => setItems(providers)).catch(() => {})
  }, [])

  useEffect(refresh, [refresh])

  useEffect(() => {
    if (!qr) return
    let alive = true
    const timer = setInterval(() => {
      void api.neteaseQrCheck(qr.key).then(({ qr: result }) => {
        if (!alive) return
        if (result.code === 801) setQrMessage('等待扫码…')
        else if (result.code === 802) setQrMessage('已扫码，请在手机上确认')
        else if (result.code === 803) {
          setQrMessage(`登录成功：${result.nickname ?? ''}`)
          setQr(null)
          refresh()
        } else if (result.code === 800) {
          setQrMessage('二维码已过期')
          clearInterval(timer)
        }
      }).catch(() => {})
    }, 2000)
    return () => { alive = false; clearInterval(timer) }
  }, [qr, refresh])

  return (
    <div className="dshm-auth">
      <div className="dshm-auth-block">
        <div className="dshm-auth-name">
          网易云音乐
          <StatusChip item={items.find(i => i.provider === 'netease')} />
        </div>
        {qr === null
          ? (
              <button type="button" className="dshm-btn" onClick={() => {
                void api.neteaseQrStart().then(({ key }) =>
                  api.neteaseQrCreate(key).then(({ img }) => { setQr({ key, img }); setQrMessage('等待扫码…') }))
                  .catch(cause => setNote(String(cause)))
              }}>扫码登录</button>
            )
          : (
              <div className="dshm-qr">
                <img src={qr.img} alt="网易云登录二维码" width={148} height={148} />
                <div className="dshm-note">{qrMessage}</div>
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
  const volume = usePlayer(s => s.volume)
  const mode = usePlayer(s => s.mode)
  const lyricCurrent = usePlayer(s => {
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
        {loadingUrl && <span className="dshm-spin">◌</span>}
      </div>
      <Karaoke />
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

// ---------------------------------------------------------------- 样式

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
.dshm-karaoke { width:100%; height:64px; display:block; margin-top:6px; }
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
`
