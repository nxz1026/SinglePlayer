/**
 * 播放器面板 —— 搜索 / 曲库 / 队列 / 账号 四 Tab + 底部正在播放控制条。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FabPos } from './Fab.tsx'
import { FAB_SIZE } from './Fab.tsx'
import { api } from './api.ts'
import { Karaoke } from './Karaoke.tsx'
import { startQrLogin, useQrLogin } from './qrLogin.ts'
import { startQqQrLogin, useQqQrLogin } from './qqQrLogin.ts'
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
  startChartMix,
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

/** 面板跟随悬浮球展开的几何参数。 */
const PANEL_W = 340
const PANEL_GAP = 10
const MIN_SPACE_ABOVE = 200

/** 计算面板相对悬浮球的定位（上方空间不足时翻转到下方）。 */
function panelStyleFor(anchor: FabPos): React.CSSProperties {
  const maxLeft = Math.max(PANEL_GAP, window.innerWidth - PANEL_W - PANEL_GAP)
  const left = Math.min(Math.max(PANEL_GAP, anchor.x + FAB_SIZE - PANEL_W), maxLeft)
  if (anchor.y - PANEL_GAP >= MIN_SPACE_ABOVE) {
    return { left, right: 'auto', top: 'auto', bottom: window.innerHeight - anchor.y + PANEL_GAP }
  }
  return { left, right: 'auto', top: anchor.y + FAB_SIZE + PANEL_GAP, bottom: 'auto' }
}

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
export function Surface({ open, onClose, anchor }: {
  open: boolean
  onClose: () => void
  /** 悬浮球位置：面板跟随其展开。 */
  anchor?: FabPos
}): React.ReactElement | null {
  const [tab, setTab] = useState<'search' | 'library' | 'queue' | 'auth' | 'settings'>('search')
  if (!open) return null
  return (
    <div className="dshm-panel" style={anchor ? panelStyleFor(anchor) : undefined}>
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
  const [settings, setSettings] = useState<import('./api.ts').PluginSettings | null>(null)
  const [providers, setProviders] = useState<import('./api.ts').ProviderInfo[]>([])
  const [schedule, setSchedule] = useState<import('./api.ts').ScheduleStatus | null>(null)
  const [savedNote, setSavedNote] = useState('')
  const [alarmTime, setAlarmTime] = useState('07:30')
  const [alarmKeyword, setAlarmKeyword] = useState('')
  const [alarmLabel, setAlarmLabel] = useState('')
  const [sleepMinutes, setSleepMinutes] = useState(30)
  const soundFileRef = useRef<HTMLInputElement>(null)
  const [soundInfo, setSoundInfo] = useState<Awaited<ReturnType<typeof api.notifySoundInfo>> | null>(null)

  useEffect(() => {
    void api.haloStatus().then(({ halo }) => setHalo(halo)).catch(() => {})
    void api.getPluginSettings().then(({ settings }) => setSettings(settings)).catch(() => {})
    void api.listProviders().then(({ providers }) => setProviders(providers)).catch(() => {})
    void refreshSchedule()
    void api.notifySoundInfo().then(setSoundInfo).catch(() => {})
  }, [])

  const refreshSchedule = useCallback(() =>
    api.scheduleStatus().then(setSchedule).catch(() => {}), [])

  const patchHalo = useCallback((patch: Record<string, unknown>) => {
    // 保存后重新拉取完整 status：顶层 enabled / connected 才会同步更新
    // （此前只合并 config 子对象，导致「启用歌词同步」勾选框永远弹回）。
    void api.haloSetConfig(patch)
      .then(() => api.haloStatus())
      .then(({ halo }) => {
        setHalo(halo)
        setSavedNote('已保存')
        window.setTimeout(() => setSavedNote(''), 1500)
      })
      .catch(cause => setSavedNote(cause instanceof Error ? cause.message : String(cause)))
  }, [])

  const patchSwitches = useCallback((patch: Partial<import('./api.ts').PluginSettings>) => {
    void api.savePluginSettings(patch).then(({ settings }) => {
      setSettings(settings)
      setSavedNote('已保存')
      window.setTimeout(() => setSavedNote(''), 1500)
    }).catch(cause => setSavedNote(cause instanceof Error ? cause.message : String(cause)))
  }, [])

  const noteError = useCallback((cause: unknown) => {
    setSavedNote(cause instanceof Error ? cause.message : String(cause))
    window.setTimeout(() => setSavedNote(''), 2500)
  }, [])

  const addAlarm = useCallback(() => {
    const kw = alarmKeyword.trim()
    if (!kw) return
    void api.alarmAdd(alarmTime, kw, alarmLabel.trim() || undefined)
      .then(refreshSchedule)
      .then(() => { setAlarmKeyword(''); setAlarmLabel('') })
      .catch(noteError)
  }, [alarmTime, alarmKeyword, alarmLabel, refreshSchedule, noteError])

  const startSleep = useCallback(() => {
    void api.sleepSet(Math.min(720, Math.max(1, Math.round(sleepMinutes))))
      .then(refreshSchedule)
      .catch(noteError)
  }, [sleepMinutes, refreshSchedule, noteError])

  const stopSleep = useCallback(() => {
    void api.sleepClear().then(refreshSchedule).catch(() => {})
  }, [refreshSchedule])

  const dropAlarm = useCallback((id: string) => {
    void api.alarmRemove(id).then(refreshSchedule).catch(() => {})
  }, [refreshSchedule])

  const uploadSound = useCallback((file: File) => {
    void api.uploadNotifySound(file)
      .then(info => { setSoundInfo(info); setSavedNote('提示音已更新') })
      .then(() => { window.setTimeout(() => setSavedNote(''), 1500) })
      .catch(noteError)
  }, [noteError])

  const resetSound = useCallback(() => {
    void api.resetNotifySound()
      .then(() => api.notifySoundInfo())
      .then(setSoundInfo)
      .catch(noteError)
  }, [noteError])

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

      <div className="dshm-set-title">通知与定时</div>
      <label className="dshm-check-row">
        <input
          type="checkbox"
          checked={settings?.notifySound ?? true}
          onChange={event => patchSwitches({ notifySound: event.target.checked })}
        />
        声音提示音（浏览器）
      </label>
      <label className="dshm-check-row">
        <input
          type="checkbox"
          checked={settings?.notifyHaloText ?? true}
          disabled={settings ? !halo?.enabled : false}
          title="依赖花再音箱连接"
          onChange={event => patchSwitches({ notifyHaloText: event.target.checked })}
        />
        音箱文字提醒{halo?.connected ? '' : '（花再未连接）'}
      </label>
      <label className="dshm-check-row">
        <input
          type="checkbox"
          checked={settings?.schedulerEnabled ?? true}
          onChange={event => patchSwitches({ schedulerEnabled: event.target.checked })}
        />
        定时任务（闹钟 / 睡眠定时器）
      </label>
      <label className="dshm-check-row">
        <input
          type="checkbox"
          checked={settings?.reversePushEnabled ?? false}
          onChange={event => patchSwitches({ reversePushEnabled: event.target.checked })}
        />
        反向推送（切歌写入会话动态）
      </label>
      <div className="dshm-set-title">提示音</div>
      <div className="dshm-alarm-form">
        <span title={soundInfo?.exists ? '通知时播放你上传的音频' : '通知时播放内置「叮咚」双音'}>
          {soundInfo?.exists
            ? `自定义 ${String(soundInfo.ext).toUpperCase()}（${Math.round((soundInfo.bytes ?? 0) / 1024)}KB）`
            : '内置双音'}
        </span>
        <button type="button" className="dshm-mini" onClick={() => soundFileRef.current?.click()}>上传</button>
        {soundInfo?.exists && (
          <button type="button" className="dshm-mini" onClick={resetSound}>恢复默认</button>
        )}
        <input
          ref={soundFileRef}
          type="file"
          accept=".mp3,.wav,.ogg,.m4a,.flac"
          className="dshm-file-hidden"
          onChange={event => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) uploadSound(file)
          }}
        />
      </div>

      <div className="dshm-set-title">音乐源</div>
      {providers.length === 0 ? (
        <div className="dshm-note">暂无可用音源</div>
      ) : providers.map(p => (
        <label className="dshm-check-row" key={p.id}>
          <input
            type="checkbox"
            checked={p.enabled}
            onChange={event => {
              const on = event.target.checked
              void api.toggleProvider(p.id, on)
                .then(({ enabled }) => setProviders(prev => prev.map(it => it.id === p.id ? { ...it, enabled } : it)))
                .catch(noteError)
            }}
          />
          {p.label}{p.description ? `（${p.description}）` : ''}
        </label>
      ))}
      {settings?.schedulerEnabled === false ? (
        <div className="dshm-note">定时任务已关闭：闹钟与睡眠定时不会触发</div>
      ) : (
        <>
          <div className="dshm-set-title">
            音乐闹钟
            <span className="dshm-set-state">{schedule ? `${schedule.alarms.length} 个` : ''}</span>
          </div>
          <div className="dshm-alarm-form">
            <input
              className="dshm-num dshm-time"
              type="time"
              value={alarmTime}
              onChange={event => setAlarmTime(event.target.value)}
            />
            <input
              className="dshm-input dshm-input-sm"
              placeholder="到点播放的歌…"
              value={alarmKeyword}
              onChange={event => setAlarmKeyword(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') addAlarm() }}
            />
            <button type="button" className="dshm-mini" onClick={addAlarm}>＋添加</button>
          </div>
          <input
            className="dshm-input dshm-input-sm"
            placeholder="备注（可选），如 起床闹钟"
            value={alarmLabel}
            onChange={event => setAlarmLabel(event.target.value)}
          />
          {schedule && schedule.alarms.length > 0 && (
            <div className="dshm-alarm-list">
              {schedule.alarms.map(alarm => (
                <div key={alarm.id} className="dshm-alarm-row">
                  <span className="dshm-alarm-time">{alarm.time}</span>
                  <span className="dshm-alarm-kw">{alarm.label || alarm.keyword}</span>
                  <button type="button" className="dshm-icon" title="删除闹钟" onClick={() => dropAlarm(alarm.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="dshm-set-title">睡眠定时</div>
          {schedule && schedule.sleepRemainingSec > 0 && (
            <div className="dshm-note">
              已启动：还剩 {Math.ceil(schedule.sleepRemainingSec / 60)} 分钟自动暂停
            </div>
          )}
          <div className="dshm-alarm-form">
            <input
              className="dshm-num"
              type="number"
              min={1}
              max={720}
              value={sleepMinutes}
              onChange={event => setSleepMinutes(Number(event.target.value) || 30)}
            />
            <span>分钟后暂停</span>
            <button type="button" className="dshm-mini" onClick={startSleep}>开始</button>
            {schedule && schedule.sleepRemainingSec > 0 && (
              <button type="button" className="dshm-mini" onClick={stopSleep}>取消</button>
            )}
          </div>
        </>
      )}

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
        <button
          type="button"
          className="dshm-mini"
          disabled={!halo?.enabled}
          onClick={() => {
            void api.haloLyric('花再歌词同步测试 123').then(() => {
              setSavedNote('已发送测试歌词到音响')
              window.setTimeout(() => setSavedNote(''), 1500)
            })
          }}
        >发送测试歌词</button>
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
      <label className="dshm-set-row">
        通知时长(秒)
        <input
          className="dshm-num dshm-time"
          type="number"
          min={0}
          max={120}
          value={config?.notifyDurationSec ?? 0}
          title="音箱文字提醒的停留时长；0 = 置顶，直到手动消除或切歌"
          disabled={!halo}
          onChange={event => patchHalo({ notifyDurationSec: Math.max(0, Math.trunc(Number(event.target.value) || 0)) })}
        />
      </label>
      {savedNote && <div className="dshm-note dshm-note-ok">{savedNote}</div>}
    </div>
  )
}

// ---------------------------------------------------------------- 搜索

/** 关键词历史（localStorage 跨会话）。 */
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

/** 快捷榜单（公开榜单，匿名可用，无需登录）。 */
const CHART_SHORTCUTS = [
  { id: '3778678', title: '热歌榜' },
  { id: '19723756', title: '飙升榜' },
  { id: '3779629', title: '新歌榜' },
  { id: '2884035', title: '抖音榜' },
]

function SearchTab(): React.ReactElement {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<Track[]>([])
  const [busy, setBusy] = useState(false)
  const [mixing, setMixing] = useState(false)
  const [charting, setCharting] = useState(false)
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
        {keyword && (
          <button
            type="button"
            className="dshm-clear"
            title="清空搜索"
            onClick={() => { setKeyword(''); setResults([]) }}
          >✕</button>
        )}
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
      <div className="dshm-charts">
        {CHART_SHORTCUTS.map(chart => (
          <button
            key={chart.id}
            type="button"
            className="dshm-chip-hist"
            disabled={charting}
            title={`播放${chart.title}（无需登录）`}
            onClick={() => {
              setCharting(true)
              void startChartMix(chart.id, chart.title).finally(() => setCharting(false))
            }}
          >{charting ? '…' : chart.title}</button>
        ))}
      </div>
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
  const qqQr = useQqQrLogin()

  const refresh = useCallback(() => {
    void api.authStatus().then(({ providers }) => setItems(providers)).catch(() => {})
  }, [])

  useEffect(refresh, [refresh])

  // 登录成功后刷新账号状态
  useEffect(() => {
    if (qrLogin.phase === 'success' || qqQr.phase === 'success') {
      refresh()
      setNote('')
    }
  }, [qrLogin.phase, qqQr.phase, refresh])

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
                {qrLogin.img && qrLogin.phase !== 'success' && <img src={qrLogin.img} alt="网易云登录二维码" width={148} height={148} />}
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
        {qqQr.phase === 'idle' || qqQr.phase === 'given-up'
          ? (
              <button type="button" className="dshm-btn" onClick={startQqQrLogin}>扫码登录</button>
            )
          : (
              <div className="dshm-qr">
                {qqQr.img && qqQr.phase !== 'success' && <img src={qqQr.img} alt="QQ 登录二维码" width={148} height={148} />}
                <div className="dshm-note">
                  {qqQr.phase === 'waiting' && '请用手机 QQ 扫一扫'}
                  {qqQr.phase === 'scanned' && '已扫码，请在手机上确认'}
                  {qqQr.phase === 'starting' && '正在获取二维码…'}
                  {qqQr.phase === 'success' && (qqQr.note ?? '登录成功')}
                  {qqQr.phase === 'error' && (qqQr.note ?? '扫码失败')}
                  {qqQr.note && qqQr.phase !== 'success' && <><br />{qqQr.note}</>}
                </div>
              </div>
            )}
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


